import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { affiliateConfig, affiliateReport } from "@/lib/affiliates";
import { validAffiliateRates, validFixedAffiliateRewards } from "@/lib/affiliate-policy";
import { AffiliateCommission, AffiliateConfig, AffiliatePayoutProfile } from "@/models/Affiliate";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { connectDB } from "@/lib/db";
import { getGateway, gatewayReady } from "@/lib/payment-gateways";
import { SecurityAttempt } from "@/models/SecurityAttempt";

async function rateLimit(actorId: string) {
  const bucket = Math.floor(Date.now() / 60_000);
  const key = "affiliate-admin:" + actorId + ":" + bucket;
  const row = await SecurityAttempt.findOneAndUpdate({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 60_000) } }, { upsert: true, returnDocument: "after" });
  return (row?.count ?? 0) <= 30;
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), enabled: z.boolean(), rewardType: z.enum(["percentage", "fixed"]).default("percentage"), rates: z.array(z.number().int()).refine(validAffiliateRates, "Use 1–5 levels with total commission no higher than 100%."), fixedRewardsMinor: z.array(z.number().int()).refine(validFixedAffiliateRewards, "Use 1–5 valid fixed reward amounts."), fixedCurrency: z.enum(["USD", "NGN", "GHS", "ZAR", "KES"]), cookieDays: z.number().int().min(1).max(90), holdDays: z.number().int().min(0).max(90), reason: z.string().trim().min(8).max(300) }),
  z.object({ action: z.enum(["pay", "reverse"]), id: z.string().regex(/^[a-f0-9]{24}$/), channel: z.enum(["paystack", "nowpayments", "external"]).default("external"), reference: z.string().trim().max(150).default(""), reason: z.string().trim().min(8).max(300) }),
]);
export async function GET(request: Request) {
  const actor = await workspaceActor();
  if (actor?.organizationKind !== "platform" || !actor.can("affiliates:read")) return NextResponse.json({ error: "Affiliate reporting permission required." }, { status: 403 });
  const page = Math.floor(Math.max(1, Math.min(10000, Number(new URL(request.url).searchParams.get("page")) || 1)));
  const canPayout = actor.can("affiliates:payout");
  return NextResponse.json({ ...await affiliateReport(actor.id, actor.isDemo, true, page, canPayout), canUpdate: actor.can("affiliates:update"), canPayout }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check your values and provide an audit reason of at least eight characters." }, { status: 400 });
  const input = parsed.data;
  if (actor?.organizationKind !== "platform" || !actor.can(input.action === "settings" ? "affiliates:update" : "affiliates:payout")) return NextResponse.json({ error: "Affiliate management permission required." }, { status: 403 });
  try {
    await connectDB();
    if (!await rateLimit(actor.id)) return NextResponse.json({ error: "Too many sensitive affiliate changes. Wait one minute and retry." }, { status: 429 });
    if (input.action === "settings") {
      if (input.rewardType === "percentage" && !validAffiliateRates(input.rates)) return NextResponse.json({ error: "Percentage rewards require 1–5 levels totaling no more than 100%." }, { status: 400 });
      if (input.rewardType === "fixed" && !validFixedAffiliateRewards(input.fixedRewardsMinor)) return NextResponse.json({ error: "Fixed rewards require 1–5 valid level amounts." }, { status: 400 });
    }
    if (input.action === "pay" && input.channel !== "external") {
      const gateway = await getGateway(input.channel, actor.isDemo);
      if (!gateway.enabled || !gatewayReady(gateway)) return NextResponse.json({ error: "Enable and verify the selected payment gateway before recording settlement through it." }, { status: 409 });
    }
    const db = await connectDB();
    await db.connection.transaction(async session => {
      if (input.action === "settings") {
        const before = await affiliateConfig(actor.isDemo, session);
        const after = { enabled: input.enabled, rewardType: input.rewardType, rates: input.rates, fixedRewardsMinor: input.fixedRewardsMinor, fixedCurrency: input.fixedCurrency, cookieDays: input.cookieDays, holdDays: input.holdDays };
        await AffiliateConfig.updateOne({ key: actor.isDemo ? "demo" : "global" }, { $set: after }, { upsert: true, session });
        await AdminAuditEvent.create([{ actorId: actor.id, targetType: "platform", targetId: `affiliates:${actor.isDemo ? "demo" : "global"}`, action: "affiliate_settings", before: JSON.stringify(before), after: JSON.stringify(after), reason: input.reason, status: "applied" }], { session });
      } else {
        const row = await AffiliateCommission.findOne({ _id: input.id, isDemo: actor.isDemo }).session(session);
        if (!row) throw new Error("Commission not found.");
        if (row.status !== "earned") throw new Error("This commission has already been settled or reversed.");
        if (input.action === "pay" && (row.availableAt > new Date() || input.reference.length < 4)) throw new Error("Wait for the hold period and enter the completed payout reference.");
        if (input.action === "pay" && input.channel !== "external" && !await AffiliatePayoutProfile.exists({ userId: row.beneficiaryId, isDemo: actor.isDemo, method: input.channel }).session(session)) throw new Error("The affiliate has not configured the selected payout method.");
        const before = row.toJSON();
        row.status = input.action === "pay" ? "paid" : "reversed";
        row.payoutReference = input.reference;
        row.settlementChannel = input.action === "pay" ? input.channel : "";
        row.reason = input.reason;
        row.set("updatedBy", actor.id);
        row.paidAt = input.action === "pay" ? new Date() : null;
        await row.save({ session });
        await AdminAuditEvent.create([{ actorId: actor.id, targetType: "platform", targetId: String(row._id), action: `affiliate_${input.action}`, before: JSON.stringify(before), after: JSON.stringify(row.toJSON()), reason: input.reason, status: "applied" }], { session });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Affiliate update failed", error);
    return NextResponse.json({ error: error instanceof Error && /Commission not found|already been|hold period|not configured/.test(error.message) ? error.message : "Affiliate update failed. Please refresh and retry." }, { status: 409 });
  }
}

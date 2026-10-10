import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { affiliateReport } from "@/lib/affiliates";
import { isSameOrigin } from "@/lib/request-origin";
import { connectDB } from "@/lib/db";
import { encryptAffiliatePayoutDetails } from "@/lib/affiliate-payout-crypto";
import { AffiliatePayoutProfile } from "@/models/Affiliate";
import { SecurityAttempt } from "@/models/SecurityAttempt";
import { writeSecurityAudit } from "@/lib/access-control";

const base = { revision: z.number().int().min(0) };
const payoutSchema = z.discriminatedUnion("method", [
  z.object({ ...base, method: z.literal("paystack"), accountName: z.string().trim().min(2).max(100), bankName: z.string().trim().min(2).max(100), accountNumber: z.string().trim().regex(/^\d{6,20}$/) }),
  z.object({ ...base, method: z.literal("nowpayments"), asset: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,15}$/), network: z.string().trim().min(2).max(60), address: z.string().trim().min(10).max(160).regex(/^[A-Za-z0-9:_-]+$/) }),
  z.object({ ...base, method: z.literal("external"), label: z.string().trim().min(2).max(100), instructions: z.string().trim().min(5).max(300) }),
]);

async function rateLimit(userId: string) {
  const bucket = Math.floor(Date.now() / 60_000);
  const key = "affiliate-payout-profile:" + userId + ":" + bucket;
  const row = await SecurityAttempt.findOneAndUpdate({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 60_000) } }, { upsert: true, returnDocument: "after" });
  return (row?.count ?? 0) <= 10;
}

export async function GET(request: Request) {
  const actor = await workspaceActor();
  if (!actor) return NextResponse.json({ error: "Sign in to view your affiliates." }, { status: 401 });
  const page = Math.max(1, Math.min(10000, Number(new URL(request.url).searchParams.get("page")) || 1));
  return NextResponse.json(await affiliateReport(actor.id, actor.isDemo, false, Math.floor(page)), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor) return NextResponse.json({ error: "Sign in to configure affiliate payouts." }, { status: 401 });
  const parsed = payoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review your payout method and destination." }, { status: 400 });
  await connectDB();
  await AffiliatePayoutProfile.init();
  if (!await rateLimit(actor.id)) return NextResponse.json({ error: "Too many payout-profile changes. Wait one minute and retry." }, { status: 429 });
  const input = parsed.data;
  const details: Record<string, string> = input.method === "paystack" ? { accountName: input.accountName, bankName: input.bankName, accountNumber: input.accountNumber } : input.method === "nowpayments" ? { asset: input.asset, network: input.network, address: input.address } : { label: input.label, instructions: input.instructions };
  const label = input.method === "paystack" ? input.accountName + " · " + input.bankName : input.method === "nowpayments" ? input.asset + " · " + input.network : input.label;
  const destination = input.method === "paystack" ? "Account ending " + input.accountNumber.slice(-4) : input.method === "nowpayments" ? input.address.slice(0, 6) + "…" + input.address.slice(-6) : "Manual payout instructions saved";
  const encrypted = encryptAffiliatePayoutDetails(actor.id, details);
  try {
    const existing = await AffiliatePayoutProfile.findOne({ userId: actor.id, isDemo: actor.isDemo }).lean();
    if (existing && existing.revision !== input.revision) return NextResponse.json({ error: "Your payout profile changed elsewhere. Refresh and retry." }, { status: 409 });
    if (!existing && input.revision !== 0) return NextResponse.json({ error: "Refresh your payout profile before saving." }, { status: 409 });
    if (existing) {
      const updated = await AffiliatePayoutProfile.updateOne({ _id: existing._id, userId: actor.id, isDemo: actor.isDemo, revision: input.revision }, { $set: { method: input.method, label, maskedDestination: destination, detailsEncrypted: encrypted }, $inc: { revision: 1 } });
      if (!updated.modifiedCount) return NextResponse.json({ error: "Your payout profile changed elsewhere. Refresh and retry." }, { status: 409 });
    } else {
      await AffiliatePayoutProfile.create({ userId: actor.id, isDemo: actor.isDemo, method: input.method, label, maskedDestination: destination, detailsEncrypted: encrypted, revision: 1 });
    }
    await writeSecurityAudit({ actor, action: "affiliate.payout_profile.updated", resource: "affiliates", targetType: "user", targetId: actor.id, newValue: { method: input.method, maskedDestination: destination }, outcome: "success", request });
    return NextResponse.json({ ok: true, ...await affiliateReport(actor.id, actor.isDemo, false, 1) });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "Your payout profile changed elsewhere. Refresh and retry." }, { status: 409 });
    console.error("Affiliate payout profile update failed", error);
    return NextResponse.json({ error: "The payout profile could not be saved." }, { status: 503 });
  }
}

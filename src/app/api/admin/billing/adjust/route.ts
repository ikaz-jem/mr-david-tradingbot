import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isShowcaseAccount } from "@/lib/demo-policy";
import { connectDB } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platform-config";
import { notifyUser } from "@/lib/notifications";
import { isSameOrigin } from "@/lib/request-origin";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { CreditEntry } from "@/models/CreditEntry";
import { User } from "@/models/User";
import { ensureDemoWorkspace } from "@/lib/demo-workspace";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { consumeAdminMutationLimit } from "@/lib/admin-mutation-limit";
import { writeSecurityAudit } from "@/lib/access-control";

export const runtime = "nodejs";
const schema = z.object({ targetUserId: z.string().regex(/^[a-f0-9]{24}$/i), action: z.enum(["credit_adjustment", "activate_account"]), amount: z.number().int().min(-5000).max(5000).optional(), reason: z.string().trim().min(12).max(300) }).refine(value => value.action !== "credit_adjustment" || (value.amount !== undefined && value.amount !== 0));

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor?.can("billing:update") || actor.organizationKind !== "platform") {
    await writeSecurityAudit({ actor, action: "billing.adjust", resource: "billing", targetType: "User", outcome: "denied", reason: "Billing update permission required", request }).catch(() => undefined);
    return NextResponse.json({ error: "Billing update permission required." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid account action and reason of at least 12 characters." }, { status: 400 });
  try {
    const db = await connectDB();
    if (!await consumeAdminMutationLimit(actor.id, "billing:adjust", 15)) return NextResponse.json({ error: "Too many billing changes. Wait one minute and retry." }, { status: 429 });
    const config = await getPlatformConfig(actor.isDemo);
    const operationId = randomUUID();
    if (actor.isDemo) {
      const target = await User.findOne({ _id: parsed.data.targetUserId, isDemo: true, status: "active", role: { $ne: "admin" } });
      if (!target || isShowcaseAccount(target.email) || String(target._id) === actor.id) return NextResponse.json({ error: "Choose an active, non-protected demo customer." }, { status: 403 });
      const workspace = await ensureDemoWorkspace(String(target._id));
      if (!workspace) return NextResponse.json({ error: "Demo workspace unavailable." }, { status: 503 });
      const amount = parsed.data.action === "credit_adjustment" ? parsed.data.amount! : config.activationCredits;
      if (parsed.data.action === "credit_adjustment" && workspace.creditBalance + amount < 0) return NextResponse.json({ error: "Adjustment would create a negative balance." }, { status: 400 });
      if (parsed.data.action === "activate_account" && workspace.activatedAt) return NextResponse.json({ error: "Account is already activated." }, { status: 409 });
      const before = JSON.stringify({ activated: Boolean(workspace.activatedAt), credits: workspace.creditBalance });
      const update = parsed.data.action === "activate_account" ? { $set: { activatedAt: new Date() }, $inc: { creditBalance: amount, revision: 1 } } : { $inc: { creditBalance: amount, revision: 1 } };
      const audit = await AdminAuditEvent.create({ actorId: actor.id, targetUserId: target._id, targetType: "user", targetId: String(target._id), action: parsed.data.action, before, after: JSON.stringify({ activated: parsed.data.action === "activate_account" || Boolean(workspace.activatedAt), credits: workspace.creditBalance + amount }), reason: parsed.data.reason, status: "pending" });
      const result = await DemoWorkspace.updateOne({ _id: workspace._id, revision: workspace.revision }, update);
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: result.modifiedCount ? "applied" : "failed" } });
      if (!result.modifiedCount) return NextResponse.json({ error: "Account changed. Reload and try again." }, { status: 409 });
      await notifyUser({ userId: String(target._id), kind: "billing", title: parsed.data.action === "activate_account" ? "Demo account activated" : "Demo credits adjusted", body: parsed.data.reason, href: "/dashboard/credits", sourceKey: `demo-adjustment:${audit._id}` }).catch(console.error);
      await writeSecurityAudit({ actor, action: `billing.${parsed.data.action}`, resource: "billing", targetType: "User", targetId: String(target._id), previousValue: JSON.parse(before), newValue: { activated: parsed.data.action === "activate_account" || Boolean(workspace.activatedAt), credits: workspace.creditBalance + amount }, outcome: "success", reason: parsed.data.reason, request, metadata: { scope: "demo", operationId } }).catch(() => undefined);
      return NextResponse.json({ ok: true, simulated: true });
    }

    const target = await User.findOne({ _id: parsed.data.targetUserId, status: "active", isDemo: { $ne: true }, role: { $ne: "admin" } }).select("_id creditBalance activatedAt").lean();
    if (!target || String(target._id) === actor.id) return NextResponse.json({ error: "Choose another active, non-protected live account." }, { status: 400 });
    const amount = parsed.data.action === "credit_adjustment" ? parsed.data.amount! : config.activationCredits;
    if (parsed.data.action === "credit_adjustment" && target.creditBalance + amount < 0) return NextResponse.json({ error: "Adjustment would create a negative balance." }, { status: 400 });
    if (parsed.data.action === "activate_account" && target.activatedAt) return NextResponse.json({ error: "Account is already activated." }, { status: 409 });
    await db.connection.transaction(async mongoSession => {
      const before = JSON.stringify({ activated: Boolean(target.activatedAt), credits: target.creditBalance });
      const filter = parsed.data.action === "activate_account" ? { _id: target._id, activatedAt: null } : { _id: target._id, creditBalance: { $gte: Math.max(0, -amount) } };
      const update = parsed.data.action === "activate_account" ? { $set: { activatedAt: new Date(), activationReference: `admin:${operationId}` }, $inc: { creditBalance: amount } } : { $inc: { creditBalance: amount } };
      const updated = await User.findOneAndUpdate(filter, update, { returnDocument: "after", session: mongoSession });
      if (!updated) throw new Error("Account changed before the adjustment was applied");
      await CreditEntry.create([{ userId: target._id, productId: "platform", amount, kind: "adjustment", sourceKey: `admin:${operationId}`, note: parsed.data.reason }], { session: mongoSession });
      await AdminAuditEvent.create([{ actorId: actor.id, targetUserId: target._id, targetType: "user", targetId: String(target._id), action: parsed.data.action, before, after: JSON.stringify({ activated: Boolean(updated.activatedAt), credits: updated.creditBalance }), reason: parsed.data.reason, status: "applied" }], { session: mongoSession });
    });
    await notifyUser({ userId: String(target._id), kind: "billing", title: parsed.data.action === "activate_account" ? "Account activated" : "Credit balance adjusted", body: `An Enrivea administrator updated your account. Reason: ${parsed.data.reason}`, href: "/dashboard/credits", sourceKey: `admin-billing:${operationId}` }).catch(error => console.error("Billing adjustment notification failed", error));
    await writeSecurityAudit({ actor, action: `billing.${parsed.data.action}`, resource: "billing", targetType: "User", targetId: String(target._id), previousValue: { activated: Boolean(target.activatedAt), credits: target.creditBalance }, newValue: { creditDelta: amount }, outcome: "success", reason: parsed.data.reason, request, metadata: { scope: "live", operationId } }).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    await writeSecurityAudit({ actor, action: `billing.${parsed.data.action}`, resource: "billing", targetType: "User", targetId: parsed.data.targetUserId, outcome: "failed", reason: parsed.data.reason, request, metadata: { error: error instanceof Error ? error.message : "unknown" } }).catch(() => undefined);
    console.error("Admin billing adjustment failed", error);
    return NextResponse.json({ error: "Adjustment failed. Check account state and database transaction support before retrying." }, { status: 503 });
  }
}

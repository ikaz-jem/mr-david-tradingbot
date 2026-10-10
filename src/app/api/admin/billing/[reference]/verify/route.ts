import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { connectDB } from "@/lib/db";
import { consumeAdminMutationLimit } from "@/lib/admin-mutation-limit";
import { writeSecurityAudit } from "@/lib/access-control";
import { verifyPayment } from "@/lib/payment-verification";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { BillingPurchase } from "@/models/BillingPurchase";

export const runtime = "nodejs";
const input = z.object({ reason: z.string().trim().min(8).max(300) });
const referenceSchema = z.string().regex(/^[a-z0-9:_-]{8,160}$/i);

export async function POST(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor?.can("billing:update") || actor.organizationKind !== "platform" || actor.isDemo) {
    await writeSecurityAudit({ actor, action: "billing.verify", resource: "billing", targetType: "BillingPurchase", outcome: "denied", reason: "Live billing update permission required", request }).catch(() => undefined);
    return NextResponse.json({ error: "Live billing update permission required." }, { status: 403 });
  }
  const referenceResult = referenceSchema.safeParse((await params).reference);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!referenceResult.success || !parsed.success) return NextResponse.json({ error: "Enter a valid purchase and audit reason of at least eight characters." }, { status: 400 });
  await connectDB();
  if (!await consumeAdminMutationLimit(actor.id, "billing:verify", 10)) return NextResponse.json({ error: "Too many provider checks. Wait one minute and retry." }, { status: 429 });
  const reference = referenceResult.data;
  const purchase = await BillingPurchase.findOne({ reference, isDemo: { $ne: true }, mode: { $ne: "demo" } }).lean();
  if (!purchase) return NextResponse.json({ error: "Live purchase not found." }, { status: 404 });
  const before = { status: purchase.status, providerStatus: purchase.providerStatus, providerTransactionId: purchase.providerTransactionId, verifiedAt: purchase.verifiedAt };
  try {
    const status = await verifyPayment(reference);
    const updated = await BillingPurchase.findOne({ reference, isDemo: { $ne: true } }).select("status providerStatus providerTransactionId verifiedAt").lean();
    await AdminAuditEvent.create({ actorId: actor.id, targetUserId: purchase.userId, targetType: "platform", targetId: reference, action: "verify_billing_purchase", before: JSON.stringify(before), after: JSON.stringify(updated), reason: parsed.data.reason, status: "applied" });
    await writeSecurityAudit({ actor, action: "billing.verify", resource: "billing", targetType: "BillingPurchase", targetId: reference, previousValue: before, newValue: updated, outcome: "success", reason: parsed.data.reason, request, metadata: { provider: purchase.provider } }).catch(() => undefined);
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    await writeSecurityAudit({ actor, action: "billing.verify", resource: "billing", targetType: "BillingPurchase", targetId: reference, previousValue: before, outcome: "failed", reason: parsed.data.reason, request, metadata: { provider: purchase.provider, error: error instanceof Error ? error.message : "unknown" } }).catch(() => undefined);
    console.error("Admin payment verification failed", error);
    return NextResponse.json({ error: "The payment provider could not verify this purchase. No credits were changed." }, { status: 503 });
  }
}

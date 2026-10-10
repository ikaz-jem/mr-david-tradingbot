import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { connectDB } from "@/lib/db";
import { consumeAdminMutationLimit } from "@/lib/admin-mutation-limit";
import { writeSecurityAudit } from "@/lib/access-control";
import { ApprovalExecutionError, reconcileApprovalOrder } from "@/lib/approval-execution";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { Order } from "@/models/Order";
import { User } from "@/models/User";

export const runtime = "nodejs";
const input = z.object({ reason: z.string().trim().min(8).max(300) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor?.can("orders:update") || actor.organizationKind !== "platform") {
    await writeSecurityAudit({ actor, action: "orders.reconcile", resource: "orders", targetType: "Order", outcome: "denied", reason: "Order update permission required", request }).catch(() => undefined);
    return NextResponse.json({ error: "Order update permission required." }, { status: 403 });
  }
  if (actor.isDemo) return NextResponse.json({ error: "Demo orders are synthetic and cannot be queried at an exchange." }, { status: 409 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a reconciliation reason of at least eight characters." }, { status: 400 });
  await connectDB();
  if (!await consumeAdminMutationLimit(actor.id, "orders:reconcile", 10)) return NextResponse.json({ error: "Too many order queries. Wait one minute and retry." }, { status: 429 });
  const order = await Order.findById(id).lean();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const owner = await User.findOne({ _id: order.userId, isDemo: false }).select("_id").lean();
  if (!owner) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const before = { status: order.status, exchangeOrderId: order.exchangeOrderId, filledQuantity: order.filledQuantity, filledQuoteAmount: order.filledQuoteAmount };
  try {
    const result = await reconcileApprovalOrder(id, String(owner._id));
    await AdminAuditEvent.create({ actorId: actor.id, targetUserId: owner._id, targetType: "platform", targetId: id, action: "reconcile_order", before: JSON.stringify(before), after: JSON.stringify(result), reason: parsed.data.reason, status: "applied" });
    await writeSecurityAudit({ actor, action: "orders.reconcile", resource: "orders", targetType: "Order", targetId: id, previousValue: before, newValue: result, outcome: "success", reason: parsed.data.reason, request }).catch(() => undefined);
    return NextResponse.json({ ok: true, status: result.state });
  } catch (error) {
    await writeSecurityAudit({ actor, action: "orders.reconcile", resource: "orders", targetType: "Order", targetId: id, previousValue: before, outcome: "failed", reason: parsed.data.reason, request, metadata: { error: error instanceof Error ? error.message : "unknown" } }).catch(() => undefined);
    const status = error instanceof ApprovalExecutionError ? error.status : 503;
    return NextResponse.json({ error: error instanceof ApprovalExecutionError ? error.message : "Exchange reconciliation is temporarily unavailable." }, { status });
  }
}

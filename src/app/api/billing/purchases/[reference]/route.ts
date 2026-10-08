import { NextResponse } from "next/server";
import { workspaceActor } from "@/lib/workspace-access";
import { BillingPurchase } from "@/models/BillingPurchase";
import { verifyPayment } from "@/lib/payment-verification";
import { fulfillPayment } from "@/lib/payment-fulfillment";
import { isSameOrigin } from "@/lib/request-origin";
import { getPlatformConfig } from "@/lib/platform-config";
import { getGateway } from "@/lib/payment-gateways";

type Context = { params: Promise<{ reference: string }> };
export async function GET(_request: Request, context: Context) {
  const actor = await workspaceActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { reference } = await context.params;
  const row = await BillingPurchase.findOne({ reference, userId: actor.id, isDemo: actor.isDemo }).select("reference kind credits expectedAmount currency status mode provider authorizationUrl payAddress payAmount payCurrency payNetwork payExtraId providerStatus providerPaymentId failureCode createdAt").lean();
  if (!row) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  return NextResponse.json({ purchase: row }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request, context: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { reference } = await context.params;
  const row = await BillingPurchase.findOne({ reference, userId: actor.id, isDemo: actor.isDemo }).lean();
  if (!row) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  const body = await request.json().catch(() => null);
  try {
    if (body?.action === "simulate") {
      if (!actor.isDemo || row.mode !== "demo") return NextResponse.json({ error: "Simulation is limited to demo purchases." }, { status: 403 });
      const config = await getPlatformConfig(true);
      const gateway = await getGateway(row.provider, true);
      if (!config.billingOpen || config.maintenanceMode || !gateway.enabled) return NextResponse.json({ error: "Billing or this payment method is paused." }, { status: 503 });
      return NextResponse.json({ status: await fulfillPayment(reference, `demo:${reference}`) });
    }
    if (body?.action !== "verify") return NextResponse.json({ error: "Invalid payment action." }, { status: 400 });
    const claim = await BillingPurchase.updateOne({ _id: row._id, $or: [{ lastCheckedAt: null }, { lastCheckedAt: { $lt: new Date(Date.now() - 15000) } }] }, { $set: { lastCheckedAt: new Date() } });
    if (!claim.modifiedCount) return NextResponse.json({ error: "Please wait 15 seconds before checking again." }, { status: 429 });
    return NextResponse.json({ status: await verifyPayment(reference) });
  } catch { return NextResponse.json({ error: "Verification is unavailable. Your payment has not been discarded; retry shortly." }, { status: 503 }); }
}

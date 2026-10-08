import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { ensureDemoWorkspace } from "@/lib/demo-workspace";
import { getPlatformConfig } from "@/lib/platform-config";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { notifyUser } from "@/lib/notifications";
import { getGateway, gatewayReady } from "@/lib/payment-gateways";

export async function GET() {
  const actor = await workspaceActor();
  if (!actor?.isDemo) return NextResponse.json({ error: "Demo accounts only." }, { status: 403 });
  const [workspace, config] = await Promise.all([ensureDemoWorkspace(actor.id), getPlatformConfig(true)]);
  return NextResponse.json({ workspace: workspace?.toObject({ flattenMaps: true }), config: { activationOpen: config.activationOpen, activationPriceMinor: config.activationPriceMinor, activationCredits: config.activationCredits, creditPacks: config.creditPacks, billingOpen: !config.maintenanceMode && config.billingOpen, billingMessage: config.maintenanceMode ? config.maintenanceMessage : config.billingPausedMessage } });
}

const input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("activation"), requestId: z.uuid() }),
  z.object({ kind: z.literal("topup"), itemId: z.string().min(2).max(40), requestId: z.uuid() }),
  z.object({ kind: z.literal("reset"), requestId: z.uuid() }),
]);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor?.isDemo) return NextResponse.json({ error: "Demo accounts only." }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid demo billing action." }, { status: 400 });
  const data = parsed.data;
  const [workspace, config] = await Promise.all([ensureDemoWorkspace(actor.id), getPlatformConfig(true)]);
  if (!workspace) return NextResponse.json({ error: "Workspace unavailable." }, { status: 503 });
  if (data.kind !== "reset" && config.maintenanceMode) return NextResponse.json({ error: config.maintenanceMessage }, { status: 503 });
  if (data.kind !== "reset" && !config.billingOpen) return NextResponse.json({ error: config.billingPausedMessage }, { status: 503 });
  if (data.kind !== "reset") {
    const gateways = await Promise.all([getGateway("paystack", true), getGateway("nowpayments", true)]);
    if (!gateways.some(gateway => gateway.enabled && gateway.mode === "demo" && gatewayReady(gateway))) return NextResponse.json({ error: "Demo payment simulation is unavailable. Use the configured checkout." }, { status: 503 });
  }
  if (workspace.receipts.some(item => item.requestId === data.requestId)) return NextResponse.json({ ok: true, duplicate: true });
  if (workspace.receipts.length >= 500) return NextResponse.json({ error: "Demo activity limit reached." }, { status: 409 });
  const now = new Date();
  let amount = 0; let credits = 0; let itemId: string = data.kind;
  const fields: Record<string, unknown> = {};
  if (data.kind === "activation") {
    if (workspace.activatedAt) return NextResponse.json({ error: "This demo account is already activated." }, { status: 409 });
    if (!config.activationOpen) return NextResponse.json({ error: "Demo activation is paused." }, { status: 503 });
    amount = config.activationPriceMinor / 100; credits = config.activationCredits; itemId = "account_activation"; fields.activatedAt = now;
  } else if (data.kind === "topup") {
    if (!workspace.activatedAt) return NextResponse.json({ error: "Activate the account before refilling credits." }, { status: 403 });
    const pack = config.creditPacks.find(entry => entry.id === data.itemId && entry.enabled);
    if (!pack) return NextResponse.json({ error: "This credit pack is unavailable." }, { status: 400 });
    amount = pack.priceMinor / 100; credits = pack.credits; itemId = pack.id;
  } else {
    fields.activatedAt = null; fields.creditBalance = 0;
  }
  const update = data.kind === "reset" ? { $set: fields, $inc: { revision: 1 }, $push: { receipts: { requestId: data.requestId, kind: data.kind, productId: "platform", itemId, amount, credits, createdAt: now } } } : { $set: fields, $inc: { creditBalance: credits, revision: 1 }, $push: { receipts: { requestId: data.requestId, kind: data.kind, productId: "platform", itemId, amount, credits, createdAt: now }, activity: { $each: [{ productId: "platform", amount: credits, note: data.kind === "activation" ? "Simulated account activation grant" : "Simulated platform credit refill", createdAt: now }], $slice: -200 } } };
  const result = await DemoWorkspace.updateOne({ _id: workspace._id, revision: workspace.revision }, update);
  if (!result.modifiedCount) return NextResponse.json({ error: "Your balance changed. Refresh and try again." }, { status: 409 });
  await notifyUser({ userId: actor.id, kind: "billing", title: data.kind === "activation" ? "Demo account activated" : data.kind === "topup" ? "Demo credits added" : "Demo activation reset", body: data.kind === "reset" ? "Use the billing page to test activation from zero." : `${credits} shared platform credits were added. No money was charged.`, href: "/dashboard/credits", sourceKey: "demo-payment:" + data.requestId }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

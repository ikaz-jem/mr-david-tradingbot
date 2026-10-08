import { NextResponse } from "next/server";
import { workspaceActor } from "@/lib/workspace-access";
import { getGateway, publicGateway } from "@/lib/payment-gateways";
import { getPlatformConfig } from "@/lib/platform-config";
import { getAccountCreditState } from "@/lib/credits";
import { BillingPurchase } from "@/models/BillingPurchase";

export async function GET() {
  const actor = await workspaceActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const [gateways, config, account, purchases] = await Promise.all([
    Promise.all([getGateway("paystack", actor.isDemo), getGateway("nowpayments", actor.isDemo)]),
    getPlatformConfig(actor.isDemo), getAccountCreditState(actor.id),
    BillingPurchase.find({ userId: actor.id }).sort({ createdAt: -1 }).limit(30).select("reference provider mode kind credits expectedAmount currency status createdAt").lean(),
  ]);
  return NextResponse.json({ gateways: gateways.map(publicGateway), config: { activationOpen: config.activationOpen, activationPriceMinor: config.activationPriceMinor, activationCredits: config.activationCredits, creditPacks: config.creditPacks, billingOpen: config.billingOpen && !config.maintenanceMode, message: config.maintenanceMode ? config.maintenanceMessage : config.billingPausedMessage }, account, purchases, isDemo: actor.isDemo }, { headers: { "Cache-Control": "no-store" } });
}

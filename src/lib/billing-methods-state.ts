import "server-only";
import { getGateway, publicGateway } from "@/lib/payment-gateways";
import { getPlatformConfig } from "@/lib/platform-config";
import { getAccountCreditState } from "@/lib/credits";
import { BillingPurchase } from "@/models/BillingPurchase";
import type { workspaceActor } from "@/lib/workspace-access";

type Actor = NonNullable<Awaited<ReturnType<typeof workspaceActor>>>;

export async function billingMethodsState(actor: Actor) {
  const [gateways, config, account, purchases] = await Promise.all([
    Promise.all([getGateway("paystack", actor.isDemo), getGateway("nowpayments", actor.isDemo)]),
    getPlatformConfig(actor.isDemo),
    getAccountCreditState(actor.id),
    BillingPurchase.find({ userId: actor.id }).sort({ createdAt: -1 }).limit(30).select("reference provider mode kind credits expectedAmount currency status createdAt").lean(),
  ]);
  return {
    gateways: gateways.map(publicGateway),
    config: {
      activationOpen: config.activationOpen,
      activationPriceMinor: config.activationPriceMinor,
      activationCredits: config.activationCredits,
      creditPacks: config.creditPacks,
      billingOpen: config.billingOpen && !config.maintenanceMode,
      message: config.maintenanceMode ? config.maintenanceMessage : config.billingPausedMessage,
    },
    account,
    purchases: purchases.map(purchase => ({
      reference: purchase.reference,
      provider: purchase.provider,
      mode: purchase.mode,
      kind: purchase.kind,
      credits: purchase.credits,
      expectedAmount: purchase.expectedAmount,
      currency: purchase.currency,
      status: purchase.status,
      createdAt: purchase.createdAt.toISOString(),
    })),
    isDemo: actor.isDemo,
    accountEmail: actor.email,
  };
}

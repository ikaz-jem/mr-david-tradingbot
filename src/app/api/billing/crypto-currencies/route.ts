import { NextResponse } from "next/server";
import { workspaceActor } from "@/lib/workspace-access";
import { getGateway, gatewayReady, PaymentProviderError } from "@/lib/payment-gateways";
import { cryptoPaymentCurrencies } from "@/lib/crypto-payment-currencies";

export async function GET() {
  const actor = await workspaceActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const gateway = await getGateway("nowpayments", actor.isDemo);
    if (!gateway.enabled || !gatewayReady(gateway)) return NextResponse.json({ error: "Crypto checkout is not enabled or configured." }, { status: 503 });
    return NextResponse.json({ currencies: await cryptoPaymentCurrencies(gateway) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof PaymentProviderError ? error.message : "Cannot load payment assets. Please try again." }, { status: 503 }); }
}

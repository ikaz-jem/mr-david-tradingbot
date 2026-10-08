import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { ExchangeApiError, getExchangeBalances, verifyExchangeConnection } from "@/lib/exchange-adapters";
import { getExchangeProvider, isExchangeProvider } from "@/lib/exchange-catalog";
import { decryptExchangeCredential } from "@/lib/exchange-credentials";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { ExchangeConnectionEvent } from "@/models/ExchangeConnectionEvent";
import { User } from "@/models/User";
import type { ExchangeMarket } from "@/lib/exchange-futures-policy";

export const runtime = "nodejs";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function credentialContext(userId: string, provider: string, market: ExchangeMarket, field: string) {
  return market === "spot" ? `${userId}:${provider}:${field}` : `${userId}:${provider}:futures:${field}`;
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!isExchangeProvider(provider)) return reply({ error: "This exchange is not supported." }, 404);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return reply({ error: "Sign in first." }, 401);
  await connectDB();
  const user = await User.findOne({ _id: session.user.id, status: "active", isDemo: false }).select("_id").lean();
  if (!user) return reply({ error: "This account cannot load a live exchange connection." }, 403);
  const market: ExchangeMarket = new URL(request.url).searchParams.get("market") === "futures" ? "futures" : "spot";
  const connection = await ExchangeConnection.findOne({ userId: user._id, provider, market, environment: "live" }).select("+apiKeyCiphertext +apiSecretCiphertext +apiPassphraseCiphertext");
  if (!connection) return reply({ error: `Connect ${getExchangeProvider(provider).name} first.` }, 404);
  try {
    const userId = String(user._id);
    const credentials = {
      apiKey: decryptExchangeCredential(connection.apiKeyCiphertext, credentialContext(userId, provider, market, "apiKey")),
      apiSecret: decryptExchangeCredential(connection.apiSecretCiphertext, credentialContext(userId, provider, market, "apiSecret")),
      passphrase: connection.apiPassphraseCiphertext ? decryptExchangeCredential(connection.apiPassphraseCiphertext, credentialContext(userId, provider, market, "passphrase")) : undefined,
      keyVersion: connection.apiKeyVersion ?? undefined,
    };
    const verification = await verifyExchangeConnection(provider, credentials, connection.access, market);
    const balances = await getExchangeBalances(provider, credentials, market);
    const checkedAt = new Date();
    await ExchangeConnection.updateOne({ _id: connection._id }, { $set: { status: "connected", ipRestricted: verification.ipRestricted, accountLabel: verification.accountLabel ?? connection.accountLabel, lastCheckedAt: checkedAt, lastError: null } });
    await ExchangeConnectionEvent.create({ userId: user._id, provider, action: "checked", detail: "Read-only account check completed" }).catch(() => undefined);
    return reply({ balances, checkedAt: checkedAt.toISOString() });
  } catch (error) {
    const message = error instanceof ExchangeApiError ? error.message : `Stored ${getExchangeProvider(provider).name} credentials could not be read. Reconnect this exchange.`;
    await ExchangeConnection.updateOne({ _id: connection._id }, { $set: { status: "attention", lastCheckedAt: new Date(), lastError: message } }).catch(() => undefined);
    await ExchangeConnectionEvent.create({ userId: user._id, provider, action: "check_failed", detail: message }).catch(() => undefined);
    return reply({ error: message }, error instanceof ExchangeApiError ? error.status : 503);
  }
}

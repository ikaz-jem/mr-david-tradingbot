import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { assertReadOnlyBinancePermissions, BinanceApiError, getBinancePermissions, getBinanceSpotBalances } from "@/lib/binance-spot";
import { connectDB } from "@/lib/db";
import { decryptExchangeCredential } from "@/lib/exchange-credentials";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { ExchangeConnectionEvent } from "@/models/ExchangeConnectionEvent";
import { User } from "@/models/User";

export const runtime = "nodejs";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return reply({ error: "Sign in first." }, 401);
  await connectDB();
  const user = await User.findOne({ _id: session.user.id, status: "active", isDemo: false }).select("_id").lean();
  if (!user) return reply({ error: "This account cannot load a live exchange connection." }, 403);
  const connection = await ExchangeConnection.findOne({ userId: user._id, provider: "binance", market: "spot", environment: "live" }).select("+apiKeyCiphertext +apiSecretCiphertext");
  if (!connection) return reply({ error: "Connect Binance Spot first." }, 404);
  try {
    const userId = String(user._id);
    const apiKey = decryptExchangeCredential(connection.apiKeyCiphertext, `${userId}:binance:apiKey`);
    const secret = decryptExchangeCredential(connection.apiSecretCiphertext, `${userId}:binance:apiSecret`);
    const permissions = await getBinancePermissions(apiKey, secret);
    assertReadOnlyBinancePermissions(permissions);
    const balances = await getBinanceSpotBalances(apiKey, secret);
    await ExchangeConnection.updateOne({ _id: connection._id }, { $set: { status: "connected", ipRestricted: permissions.ipRestrict, lastCheckedAt: new Date(), lastError: null } });
    await ExchangeConnectionEvent.create({ userId: user._id, provider: "binance", action: "checked", detail: "Read-only Spot account check completed" }).catch(() => undefined);
    return reply({ balances, checkedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof BinanceApiError ? error.message : "Stored exchange credentials could not be read. Reconnect Binance Spot.";
    await ExchangeConnection.updateOne({ _id: connection._id }, { $set: { status: "attention", lastCheckedAt: new Date(), lastError: message } }).catch(() => undefined);
    await ExchangeConnectionEvent.create({ userId: user._id, provider: "binance", action: "check_failed", detail: message }).catch(() => undefined);
    return reply({ error: message }, error instanceof BinanceApiError ? error.status : 503);
  }
}

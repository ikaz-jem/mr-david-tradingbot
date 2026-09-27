import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { assertReadOnlyBinancePermissions, BinanceApiError, getBinancePermissions } from "@/lib/binance-spot";
import { connectDB } from "@/lib/db";
import { encryptExchangeCredential, exchangeEncryptionReady } from "@/lib/exchange-credentials";
import { isSameOrigin } from "@/lib/request-origin";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { ExchangeConnectionEvent } from "@/models/ExchangeConnectionEvent";
import { User } from "@/models/User";
import { notifyUser } from "@/lib/notifications";
import { getPlatformConfig } from "@/lib/platform-config";

export const runtime = "nodejs";
const input = z.object({
  apiKey: z.string().trim().regex(/^[A-Za-z0-9]{20,256}$/),
  apiSecret: z.string().trim().regex(/^[A-Za-z0-9]{20,256}$/),
});
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  await connectDB();
  return User.findOne({ _id: session.user.id, status: "active" }).select("_id isDemo").lean();
}

export async function GET() {
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in first." }, 401);
  const connection = await ExchangeConnection.findOne({ userId: user._id, provider: "binance", market: "spot", environment: "live" }).lean();
  return reply({ configured: exchangeEncryptionReady(), demo: user.isDemo, connection: connection ? {
    provider: connection.provider, market: connection.market, status: connection.status, access: connection.access,
    keyLast4: connection.keyLast4, ipRestricted: connection.ipRestricted,
    lastCheckedAt: connection.lastCheckedAt, lastError: connection.lastError, createdAt: connection.createdAt,
  } : null });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return reply({ error: "Invalid request origin." }, 403);
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in first." }, 401);
  if (user.isDemo) return reply({ error: "Demo accounts cannot connect real exchange credentials." }, 403);
  if (!(await getPlatformConfig()).exchangeConnectionsOpen) return reply({ error: "New exchange connections are temporarily paused by operations." }, 503);
  if (!exchangeEncryptionReady()) return reply({ error: "Exchange encryption is not configured. Ask the platform administrator to enable it." }, 503);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply({ error: "Enter a Binance HMAC API key and secret." }, 400);
  try {
    const permissions = await getBinancePermissions(parsed.data.apiKey, parsed.data.apiSecret);
    assertReadOnlyBinancePermissions(permissions);
    const userId = String(user._id);
    const existing = await ExchangeConnection.findOne({ userId: user._id, provider: "binance", market: "spot", environment: "live" }).select("_id").lean();
    await ExchangeConnection.updateOne(
      { userId: user._id, provider: "binance", market: "spot", environment: "live" },
      { $set: {
        apiKeyCiphertext: encryptExchangeCredential(parsed.data.apiKey, `${userId}:binance:apiKey`),
        apiSecretCiphertext: encryptExchangeCredential(parsed.data.apiSecret, `${userId}:binance:apiSecret`),
        keyLast4: parsed.data.apiKey.slice(-4), status: "connected", access: "read_only", ipRestricted: permissions.ipRestrict,
        lastCheckedAt: new Date(), lastError: null,
      }, $setOnInsert: { userId: user._id, provider: "binance", market: "spot", environment: "live" } },
      { upsert: true },
    );
    await ExchangeConnectionEvent.create({ userId: user._id, provider: "binance", action: existing ? "replaced" : "connected", detail: `Read-only Spot key ending ${parsed.data.apiKey.slice(-4)}` }).catch(() => undefined);
    await notifyUser({ userId, kind: "exchange", title: existing ? "Binance connection replaced" : "Binance Spot connected", body: `Read-only API key ending ${parsed.data.apiKey.slice(-4)} is connected.`, href: "/dashboard/exchanges", sourceKey: `exchange:${userId}:${Date.now()}` }).catch(error => console.error("Exchange notification failed", error));
    return reply({ ok: true, message: "Binance Spot connected with read-only access." });
  } catch (error) {
    if (error instanceof BinanceApiError) return reply({ error: error.message }, error.status);
    return reply({ error: "The connection could not be confirmed. Refresh the page before retrying." }, 503);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return reply({ error: "Invalid request origin." }, 403);
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in first." }, 401);
  const removed = await ExchangeConnection.findOneAndDelete({ userId: user._id, provider: "binance", market: "spot", environment: "live" }).select("keyLast4").lean();
  if (removed) await ExchangeConnectionEvent.create({ userId: user._id, provider: "binance", action: "disconnected", detail: `Removed Spot key ending ${removed.keyLast4}` }).catch(() => undefined);
  if (removed) await notifyUser({ userId: String(user._id), kind: "exchange", title: "Binance Spot disconnected", body: `API key ending ${removed.keyLast4} was removed from this workspace.`, href: "/dashboard/exchanges", sourceKey: `exchange-disconnected:${user._id}:${Date.now()}` }).catch(error => console.error("Exchange notification failed", error));
  return reply({ ok: true });
}

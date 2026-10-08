import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { ExchangeApiError, verifyExchangeConnection } from "@/lib/exchange-adapters";
import { getExchangeProvider, isExchangeProvider } from "@/lib/exchange-catalog";
import { encryptExchangeCredential, exchangeEncryptionReady } from "@/lib/exchange-credentials";
import { notifyUser } from "@/lib/notifications";
import { getPlatformConfig } from "@/lib/platform-config";
import { isSameOrigin } from "@/lib/request-origin";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { ExchangeConnectionEvent } from "@/models/ExchangeConnectionEvent";
import { User } from "@/models/User";
import { resolveEffectivePermissions, writeSecurityAudit } from "@/lib/access-control";
import { exchangeMarkets, type ExchangeMarket } from "@/lib/exchange-futures-policy";

export const runtime = "nodejs";
const input = z.object({
  apiKey: z.string().trim().min(8).max(512),
  apiSecret: z.string().trim().min(8).max(4096),
  passphrase: z.preprocess(value => value === "" ? undefined : value, z.string().trim().min(1).max(512).optional()),
  keyVersion: z.enum(["2", "3"]).optional(),
  market: z.enum(exchangeMarkets).default("spot"),
  access: z.enum(["read_only", "spot_trade", "futures_trade"]).default("read_only"),
}).superRefine((value, context) => {
  if (value.market === "spot" && value.access === "futures_trade") context.addIssue({ code: "custom", message: "Futures access requires the Futures market." });
  if (value.market === "futures" && value.access === "spot_trade") context.addIssue({ code: "custom", message: "Spot access requires the Spot market." });
});
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  await connectDB();
  return User.findOne({ _id: session.user.id, status: "active" }).select("_id isDemo").lean();
}

function marketFrom(request: Request): ExchangeMarket {
  return new URL(request.url).searchParams.get("market") === "futures" ? "futures" : "spot";
}

function credentialContext(userId: string, provider: string, market: ExchangeMarket, field: string) {
  return market === "spot" ? `${userId}:${provider}:${field}` : `${userId}:${provider}:futures:${field}`;
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!isExchangeProvider(provider)) return reply({ error: "This exchange is not supported." }, 404);
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in first." }, 401);
  const market = marketFrom(request);
  const connection = await ExchangeConnection.findOne({ userId: user._id, provider, market, environment: "live" }).lean();
  return reply({ configured: exchangeEncryptionReady(), demo: user.isDemo, connection: connection ? {
    provider: connection.provider, market: connection.market, status: connection.status, access: connection.access,
    keyLast4: connection.keyLast4, accountLabel: connection.accountLabel, ipRestricted: connection.ipRestricted,
    lastCheckedAt: connection.lastCheckedAt, lastError: connection.lastError, createdAt: connection.createdAt,
  } : null });
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  if (!isSameOrigin(request)) return reply({ error: "Invalid request origin." }, 403);
  const { provider } = await context.params;
  if (!isExchangeProvider(provider)) return reply({ error: "This exchange is not supported." }, 404);
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in first." }, 401);
  if (user.isDemo) return reply({ error: "Demo accounts cannot store real exchange credentials." }, 403);
  const operations = await getPlatformConfig();
  if (operations.maintenanceMode) return reply({ error: operations.maintenanceMessage }, 503);
  if (!operations.exchangeConnectionsOpen) return reply({ error: operations.exchangeConnectionsPausedMessage }, 503);
  if (!exchangeEncryptionReady()) return reply({ error: "Exchange encryption is not configured. Ask the platform administrator to enable it." }, 503);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply({ error: "Enter all credentials exactly as shown by the exchange." }, 400);
  const definition = getExchangeProvider(provider);
  if (definition.credentialFields.some((field) => field.key === "passphrase") && !parsed.data.passphrase) return reply({ error: `${definition.name} requires the API passphrase.` }, 400);
  try {
    const market = parsed.data.market;
    const verification = await verifyExchangeConnection(provider, parsed.data, parsed.data.access, market);
    const userId = String(user._id);
    const existing = await ExchangeConnection.findOne({ userId: user._id, provider, market, environment: "live" }).select("_id").lean();
    const set: Record<string, unknown> = {
      apiKeyCiphertext: encryptExchangeCredential(parsed.data.apiKey, credentialContext(userId, provider, market, "apiKey")),
      apiSecretCiphertext: encryptExchangeCredential(parsed.data.apiSecret, credentialContext(userId, provider, market, "apiSecret")),
      apiPassphraseCiphertext: parsed.data.passphrase ? encryptExchangeCredential(parsed.data.passphrase, credentialContext(userId, provider, market, "passphrase")) : null,
      apiKeyVersion: verification.keyVersion ?? parsed.data.keyVersion ?? null,
      keyLast4: parsed.data.apiKey.slice(-4), accountLabel: verification.accountLabel ?? null,
      status: "connected", access: verification.access, ipRestricted: verification.ipRestricted,
      lastCheckedAt: new Date(), lastError: null,
    };
    await ExchangeConnection.updateOne(
      { userId: user._id, provider, market, environment: "live" },
      { $set: set, $setOnInsert: { userId: user._id, provider, market, environment: "live" } },
      { upsert: true },
    );
    const actor = await resolveEffectivePermissions(userId);
    await writeSecurityAudit({ actor, action: existing ? "exchange.connection.replace" : "exchange.connection.create", resource: "exchange-connections", targetType: "ExchangeConnection", targetId: `${userId}:${provider}:${market}`, previousValue: existing ? { configured: true } : null, newValue: { provider, market, access: verification.access, keyLast4: parsed.data.apiKey.slice(-4), ipRestricted: verification.ipRestricted }, outcome: "success", reason: verification.access === "futures_trade" ? `User authorized ${definition.name} Futures execution` : verification.access === "spot_trade" ? `User authorized ${definition.name} Spot execution` : `User connected read-only ${market} access`, request });
    const accessLabel = verification.access === "futures_trade" ? "Futures execution" : verification.access === "spot_trade" ? "Spot execution" : `Read-only ${market}`;
    await ExchangeConnectionEvent.create({ userId: user._id, provider, action: existing ? "replaced" : "connected", detail: `${accessLabel} key ending ${parsed.data.apiKey.slice(-4)}` }).catch(() => undefined);
    await notifyUser({ userId, kind: "exchange", title: existing ? `${definition.name} connection replaced` : `${definition.name} connected`, body: `${accessLabel} API key ending ${parsed.data.apiKey.slice(-4)} is connected.`, href: "/dashboard/exchanges", sourceKey: `exchange:${provider}:${userId}:${Date.now()}` }).catch((error) => console.error("Exchange notification failed", error));
    return reply({ ok: true, message: `${definition.name} connected with ${accessLabel.toLowerCase()} access.` });
  } catch (error) {
    if (error instanceof ExchangeApiError) return reply({ error: error.message }, error.status);
    console.error(`Exchange connection failed for ${provider}`, error);
    return reply({ error: "The connection could not be confirmed. Check the credentials and try again." }, 503);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ provider: string }> }) {
  if (!isSameOrigin(request)) return reply({ error: "Invalid request origin." }, 403);
  const { provider } = await context.params;
  if (!isExchangeProvider(provider)) return reply({ error: "This exchange is not supported." }, 404);
  const user = await currentUser();
  if (!user) return reply({ error: "Sign in first." }, 401);
  if (user.isDemo) return reply({ error: "Demo connections are managed in the preview workspace." }, 403);
  const market = marketFrom(request);
  const removed = await ExchangeConnection.findOneAndDelete({ userId: user._id, provider, market, environment: "live" }).select("keyLast4").lean();
  const definition = getExchangeProvider(provider);
  if (removed) {
    await ExchangeConnectionEvent.create({ userId: user._id, provider, action: "disconnected", detail: `Removed ${market} key ending ${removed.keyLast4}` }).catch(() => undefined);
    await notifyUser({ userId: String(user._id), kind: "exchange", title: `${definition.name} disconnected`, body: `API key ending ${removed.keyLast4} was permanently removed.`, href: "/dashboard/exchanges", sourceKey: `exchange-disconnected:${provider}:${user._id}:${Date.now()}` }).catch((error) => console.error("Exchange notification failed", error));
  }
  return reply({ ok: true });
}

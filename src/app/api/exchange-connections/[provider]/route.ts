import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { workspaceActor } from "@/lib/workspace-access";
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
import { regulatedAccess } from "@/lib/jurisdiction-policy";
import { SecurityAttempt } from "@/models/SecurityAttempt";
import { AutopilotProfile } from "@/models/AutopilotProfile";

export const runtime = "nodejs";
const input = z.object({
  apiKey: z.string().trim().min(8).max(512),
  apiSecret: z.string().trim().min(8).max(4096),
  passphrase: z.preprocess(value => value === "" ? undefined : value, z.string().trim().min(1).max(512).optional()),
  keyVersion: z.enum(["2", "3"]).optional(),
  futuresApiKey: z.string().trim().min(8).max(512).optional(),
  futuresApiSecret: z.string().trim().min(8).max(4096).optional(),
}).superRefine((value, context) => {
  if (Boolean(value.futuresApiKey) !== Boolean(value.futuresApiSecret)) context.addIssue({ code: "custom", message: "Enter both Futures key fields." });
});
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function currentUser() {
  const actor = await workspaceActor();
  if (!actor || actor.organizationKind !== "customer") return null;
  await connectDB();
  return User.findOne({ _id: actor.id, status: "active", organizationId: actor.organizationId }).select("_id isDemo countryCode").lean();
}

function marketFrom(request: Request): ExchangeMarket {
  return new URL(request.url).searchParams.get("market") === "futures" ? "futures" : "spot";
}

function credentialContext(userId: string, provider: string, market: ExchangeMarket, field: string) {
  return market === "spot" ? `${userId}:${provider}:${field}` : `${userId}:${provider}:futures:${field}`;
}

async function allowConnectionAttempt(userId: string) {
  const bucket = Math.floor(Date.now() / 60_000);
  const row = await SecurityAttempt.findOneAndUpdate(
    { key: `exchange-connect:${userId}:${bucket}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 60_000) } },
    { upsert: true, returnDocument: "after" },
  );
  return (row?.count ?? 0) <= 5;
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
  const jurisdiction = regulatedAccess({ isDemo: false, countryCode: user.countryCode, action: "exchange_connection" });
  if (!jurisdiction.allowed) {
    const deniedActor = await resolveEffectivePermissions(String(user._id));
    await writeSecurityAudit({ actor: deniedActor, action: "exchange.connection.denied", resource: "exchange-connections", targetType: "jurisdiction", targetId: user.countryCode ?? "unverified", outcome: "denied", reason: jurisdiction.reason, request }).catch(() => undefined);
    return reply({ error: jurisdiction.reason }, jurisdiction.status);
  }
  if (!await allowConnectionAttempt(String(user._id))) {
    const deniedActor = await resolveEffectivePermissions(String(user._id));
    await writeSecurityAudit({ actor: deniedActor, action: "exchange.connection.denied", resource: "exchange-connections", targetType: "rate-limit", targetId: String(user._id), outcome: "denied", reason: "More than five credential verification attempts in one minute", request }).catch(() => undefined);
    return reply({ error: "Too many exchange verification attempts. Wait one minute and retry." }, 429);
  }
  const operations = await getPlatformConfig();
  if (operations.maintenanceMode) return reply({ error: operations.maintenanceMessage }, 503);
  if (!operations.exchangeConnectionsOpen) return reply({ error: operations.exchangeConnectionsPausedMessage }, 503);
  if (!exchangeEncryptionReady()) return reply({ error: "Exchange encryption is not configured. Ask the platform administrator to enable it." }, 503);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply({ error: "Enter all credentials exactly as shown by the exchange." }, 400);
  const definition = getExchangeProvider(provider);
  if (definition.credentialFields.some((field) => field.key === "passphrase") && !parsed.data.passphrase) return reply({ error: `${definition.name} requires the API passphrase.` }, 400);
  try {
    if (provider === "kraken" && (!parsed.data.futuresApiKey || !parsed.data.futuresApiSecret)) return reply({ error: "Kraken requires a separate Derivatives API key and secret for Futures." }, 400);
    const futuresCredentials = provider === "kraken" ? { apiKey: parsed.data.futuresApiKey!, apiSecret: parsed.data.futuresApiSecret! } : parsed.data;
    const [spotVerification, futuresVerification] = await Promise.all([
      verifyExchangeConnection(provider, parsed.data, "spot_trade", "spot"),
      verifyExchangeConnection(provider, futuresCredentials, "futures_trade", "futures"),
    ]);
    const userId = String(user._id);
    const existing = await ExchangeConnection.find({ userId: user._id, provider, environment: "live" }).select("_id market").lean();
    if (existing.length) await AutopilotProfile.updateOne({ userId: user._id, provider, status: "running" }, { $set: { status: "paused", lastDecision: "Exchange keys changed. Reconfirm account and re-arm Autopilot before new orders." }, $inc: { revision: 1 } });
    const mongoSession = await mongoose.startSession();
    try {
      await mongoSession.withTransaction(async () => {
        for (const market of exchangeMarkets) {
          const credentials = market === "spot" ? parsed.data : futuresCredentials;
          const verification = market === "spot" ? spotVerification : futuresVerification;
          await ExchangeConnection.updateOne(
            { userId: user._id, provider, market, environment: "live" },
            { $set: {
              apiKeyCiphertext: encryptExchangeCredential(credentials.apiKey, credentialContext(userId, provider, market, "apiKey")),
              apiSecretCiphertext: encryptExchangeCredential(credentials.apiSecret, credentialContext(userId, provider, market, "apiSecret")),
              apiPassphraseCiphertext: credentials.passphrase ? encryptExchangeCredential(credentials.passphrase, credentialContext(userId, provider, market, "passphrase")) : null,
              apiKeyVersion: verification.keyVersion ?? parsed.data.keyVersion ?? null,
              keyLast4: credentials.apiKey.slice(-4), accountLabel: verification.accountLabel ?? null,
              status: "connected", access: verification.access, ipRestricted: verification.ipRestricted,
              lastCheckedAt: new Date(), lastError: null,
            }, $setOnInsert: { userId: user._id, provider, market, environment: "live" } },
            { upsert: true, session: mongoSession },
          );
        }
      });
    } finally { await mongoSession.endSession(); }
    const actor = await resolveEffectivePermissions(userId);
    await writeSecurityAudit({ actor, action: existing.length ? "exchange.connection.replace" : "exchange.connection.create", resource: "exchange-connections", targetType: "ExchangeConnection", targetId: `${userId}:${provider}`, previousValue: { markets: existing.map(item => item.market) }, newValue: { provider, markets: [...exchangeMarkets], spotKeyLast4: parsed.data.apiKey.slice(-4), futuresKeyLast4: futuresCredentials.apiKey.slice(-4), ipRestricted: spotVerification.ipRestricted && futuresVerification.ipRestricted }, outcome: "success", reason: `User authorized ${definition.name} Spot and Futures execution`, request });
    await ExchangeConnectionEvent.create({ userId: user._id, provider, action: existing.length ? "replaced" : "connected", detail: `Spot and Futures trading keys verified` }).catch(() => undefined);
    await notifyUser({ userId, kind: "exchange", title: existing.length ? `${definition.name} connection replaced` : `${definition.name} connected`, body: "Spot and Futures trading access verified.", href: "/dashboard/exchanges", sourceKey: `exchange:${provider}:${userId}:${Date.now()}` }).catch((error) => console.error("Exchange notification failed", error));
    return reply({ ok: true, message: `${definition.name} connected for Spot and Futures trading.` });
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
  const requestedMarket = new URL(request.url).searchParams.get("market");
  const market = requestedMarket === "spot" || requestedMarket === "futures" ? requestedMarket : null;
  const removed = await ExchangeConnection.find({ userId: user._id, provider, ...(market ? { market } : {}), environment: "live" }).select("keyLast4 market").lean();
  if (removed.length) await AutopilotProfile.updateOne({ userId: user._id, provider, status: "running" }, { $set: { status: "paused", lastDecision: "Exchange connection removed. Autopilot stopped opening new orders." }, $inc: { revision: 1 } });
  if (removed.length) await ExchangeConnection.deleteMany({ userId: user._id, provider, ...(market ? { market } : {}), environment: "live" });
  const definition = getExchangeProvider(provider);
  if (removed.length) {
    const actor = await resolveEffectivePermissions(String(user._id));
    await writeSecurityAudit({ actor, action: "exchange.connection.disconnect", resource: "exchange-connections", targetType: "ExchangeConnection", targetId: `${user._id}:${provider}`, previousValue: { markets: removed.map(item => item.market) }, newValue: { markets: [] }, outcome: "success", reason: "Account owner removed exchange credentials", request });
    await ExchangeConnectionEvent.create({ userId: user._id, provider, action: "disconnected", detail: `Removed ${removed.map(item => item.market).join(" and ")} credentials` }).catch(() => undefined);
    await notifyUser({ userId: String(user._id), kind: "exchange", title: `${definition.name} disconnected`, body: "Stored trading credentials were removed.", href: "/dashboard/exchanges", sourceKey: `exchange-disconnected:${provider}:${user._id}:${Date.now()}` }).catch((error) => console.error("Exchange notification failed", error));
  }
  return reply({ ok: true });
}

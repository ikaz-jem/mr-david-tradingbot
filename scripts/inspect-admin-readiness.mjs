import mongoose from "mongoose";

if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing.");
await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false, serverSelectionTimeoutMS: 15_000 });
try {
  const db = mongoose.connection.db;
  const global = await db.collection("platformconfigs").findOne(
    { key: "global" },
    { projection: { _id: 0, key: 1, registrationOpen: 1, scansOpen: 1, approvalDiscoveryOpen: 1, autopilotOpen: 1, exchangeConnectionsOpen: 1, billingOpen: 1, supportOpen: 1, maintenanceMode: 1, activationOpen: 1, activationPriceMinor: 1, activationCredits: 1, updatedAt: 1 } },
  );
  const [realUsers, demoUsers, livePurchases, demoPurchases, tickets, paymentGateways] = await Promise.all([
    db.collection("users").countDocuments({ isDemo: { $ne: true } }),
    db.collection("users").countDocuments({ isDemo: true }),
    db.collection("billingpurchases").countDocuments({ isDemo: { $ne: true } }),
    db.collection("billingpurchases").countDocuments({ isDemo: true }),
    db.collection("supporttickets").countDocuments(),
    db.collection("paymentgateways").countDocuments({ isDemo: false }),
  ]);
  const [gateways, service] = await Promise.all([
    db.collection("paymentgateways").find({ isDemo: false }, { projection: { _id: 0, provider: 1, enabled: 1, mode: 1, currency: 1, ratePerUsd: 1, apiKeyEncrypted: 1, webhookSecretEncrypted: 1, createdAt: 1 } }).sort({ createdAt: -1 }).toArray(),
    db.collection("serviceconfigs").findOne({ key: "global" }, { projection: { _id: 0, openaiApiKeyEncrypted: 1, openaiModel: 1, resendApiKeyEncrypted: 1, resendFromEmail: 1, resendWebhookSecretEncrypted: 1 } }),
  ]);
  const seenProviders = new Set();
  const latestGateways = gateways.filter(gateway => { if (seenProviders.has(gateway.provider)) return false; seenProviders.add(gateway.provider); return true; }).map(gateway => ({ provider: gateway.provider, enabled: gateway.enabled, mode: gateway.mode, currency: gateway.currency, rateConfigured: gateway.ratePerUsd > 0, keyConfigured: Boolean(gateway.apiKeyEncrypted), webhookConfigured: Boolean(gateway.webhookSecretEncrypted) }));
  console.log(JSON.stringify({ database: mongoose.connection.name, remote: !["localhost", "127.0.0.1"].includes(mongoose.connection.host), globalOperations: global ?? null, counts: { realUsers, demoUsers, livePurchases, demoPurchases, tickets, paymentGateways }, latestGateways, serviceConfigured: { openai: Boolean((service?.openaiApiKeyEncrypted || process.env.OPENAI_API_KEY) && (service?.openaiModel || process.env.OPENAI_MODEL)), resend: Boolean((service?.resendApiKeyEncrypted || process.env.RESEND_API_KEY) && (service?.resendFromEmail || process.env.RESEND_FROM_EMAIL)), resendWebhook: Boolean(service?.resendWebhookSecretEncrypted || process.env.RESEND_WEBHOOK_SECRET), publicAppUrl: Boolean(process.env.APP_URL) } }));
} finally {
  await mongoose.disconnect();
}

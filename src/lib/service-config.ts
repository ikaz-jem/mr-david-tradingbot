import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { connectDB } from "@/lib/db";
import { ServiceConfig } from "@/models/ServiceConfig";

export const secretFields = ["openaiApiKey", "resendApiKey", "resendWebhookSecret"] as const;
export type SecretField = (typeof secretFields)[number];
export const textFields = ["openaiModel", "openaiResearchModel", "openaiApprovalModel", "openaiAutopilotModel", "resendFromEmail", "resendSupportEmail"] as const;
export type TextField = (typeof textFields)[number];
export type AIWorkload = "research" | "approval" | "autopilot";

const CONFIG_CACHE_TTL_MS = 60_000;
const configCache = new Map<"global" | "demo", { expiresAt: number; value: ServiceConfigValue }>();

type ServiceConfigValue = {
  scope: "global" | "demo";
  openaiApiKey: string;
  openaiModel: string;
  openaiResearchModel: string;
  openaiApprovalModel: string;
  openaiAutopilotModel: string;
  openaiVerifiedAt: string | null;
  openaiLastError: string;
  resendApiKey: string;
  resendFromEmail: string;
  resendSupportEmail: string;
  resendWebhookSecret: string;
};

export function modelFieldForWorkload(workload: AIWorkload) {
  return workload === "approval" ? "openaiApprovalModel" as const : workload === "autopilot" ? "openaiAutopilotModel" as const : "openaiResearchModel" as const;
}

export function selectAIModel(workload: AIWorkload, configured: { openaiModel?: string; openaiResearchModel?: string; openaiApprovalModel?: string; openaiAutopilotModel?: string }, deploymentDefault = "") {
  const selected = configured[modelFieldForWorkload(workload)];
  return selected || configured.openaiModel || deploymentDefault;
}

export function invalidateServiceConfigCache(isDemo?: boolean) {
  if (typeof isDemo === "boolean") configCache.delete(isDemo ? "demo" : "global");
  else configCache.clear();
}

function legacyEncryptionKey() {
  const bootstrap = process.env.NEXTAUTH_SECRET;
  if (!bootstrap || bootstrap.length < 32) throw new Error("A strong NEXTAUTH_SECRET is required to protect service settings");
  return Buffer.from(hkdfSync("sha256", Buffer.from(bootstrap), Buffer.from("enrivea-service-config-v1"), Buffer.from("credential-encryption"), 32));
}

function dedicatedEncryptionKey() {
  const configured = process.env.SERVICE_CONFIG_ENCRYPTION_KEY?.trim();
  if (!configured) return null;
  const decoded = Buffer.from(configured, "base64");
  if (decoded.length !== 32) throw new Error("SERVICE_CONFIG_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return decoded;
}

function activeEncryptionKey() {
  const dedicated = dedicatedEncryptionKey();
  return dedicated ? { version: "v2" as const, key: dedicated } : { version: "v1" as const, key: legacyEncryptionKey() };
}

export function serviceEncryptionReady() { try { activeEncryptionKey(); return true; } catch { return false; } }

export function encryptServiceSecret(value: string, field: SecretField | "paymentApiKey" | "paymentWebhookSecret") {
  const active = activeEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", active.key, iv);
  cipher.setAAD(Buffer.from(`service-config:${field}`));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${active.version}:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptServiceSecret(value: string, field: SecretField | "paymentApiKey" | "paymentWebhookSecret") {
  const [version, iv, tag, ciphertext] = value.split(":");
  if ((version !== "v1" && version !== "v2") || !iv || !tag || !ciphertext) throw new Error("Stored service credential has an invalid format");
  const key = version === "v2" ? dedicatedEncryptionKey() : legacyEncryptionKey();
  if (!key) throw new Error("SERVICE_CONFIG_ENCRYPTION_KEY is required to decrypt stored service credentials");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(`service-config:${field}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export async function getServiceConfig(isDemo = false) {
  const key = isDemo ? "demo" as const : "global" as const;
  const cached = configCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  await connectDB();
  const stored = await ServiceConfig.findOne({ key }).lean();
  const deploymentModel = (isDemo ? "" : process.env.OPENAI_MODEL) || "";
  const value: ServiceConfigValue = {
    scope: isDemo ? "demo" as const : "global" as const,
    openaiApiKey: stored?.openaiApiKeyEncrypted ? decryptServiceSecret(stored.openaiApiKeyEncrypted, "openaiApiKey") : (isDemo ? "" : process.env.OPENAI_API_KEY) ?? "",
    openaiModel: stored?.openaiResearchModel || stored?.openaiModel || deploymentModel,
    openaiResearchModel: selectAIModel("research", stored ?? {}, deploymentModel),
    openaiApprovalModel: selectAIModel("approval", stored ?? {}, deploymentModel),
    openaiAutopilotModel: selectAIModel("autopilot", stored ?? {}, deploymentModel),
    openaiVerifiedAt: stored?.openaiVerifiedAt?.toISOString() ?? null,
    openaiLastError: stored?.openaiLastError ?? "",
    resendApiKey: stored?.resendApiKeyEncrypted ? decryptServiceSecret(stored.resendApiKeyEncrypted, "resendApiKey") : (isDemo ? "" : process.env.RESEND_API_KEY) ?? "",
    resendFromEmail: stored?.resendFromEmail || (isDemo ? "" : process.env.RESEND_FROM_EMAIL) || "",
    resendSupportEmail: stored?.resendSupportEmail || (isDemo ? "" : process.env.RESEND_SUPPORT_EMAIL) || "",
    resendWebhookSecret: stored?.resendWebhookSecretEncrypted ? decryptServiceSecret(stored.resendWebhookSecretEncrypted, "resendWebhookSecret") : (isDemo ? "" : process.env.RESEND_WEBHOOK_SECRET) ?? "",
  };
  configCache.set(key, { value, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS });
  return value;
}

export async function getAIServiceConfig(workload: AIWorkload, isDemo = false) {
  const service = await getServiceConfig(isDemo);
  return { ...service, openaiModel: service[modelFieldForWorkload(workload)] };
}

export async function getServiceConfigStatus(isDemo = false) {
  await connectDB();
  const stored = await ServiceConfig.findOne({ key: isDemo ? "demo" : "global" }).lean();
  const configured = {
    openaiApiKey: Boolean(stored?.openaiApiKeyEncrypted || (isDemo ? "" : process.env.OPENAI_API_KEY)),
    openaiModel: selectAIModel("research", stored ?? {}, (isDemo ? "" : process.env.OPENAI_MODEL) || ""),
    openaiResearchModel: selectAIModel("research", stored ?? {}, (isDemo ? "" : process.env.OPENAI_MODEL) || ""),
    openaiApprovalModel: selectAIModel("approval", stored ?? {}, (isDemo ? "" : process.env.OPENAI_MODEL) || ""),
    openaiAutopilotModel: selectAIModel("autopilot", stored ?? {}, (isDemo ? "" : process.env.OPENAI_MODEL) || ""),
    openaiVerifiedAt: stored?.openaiVerifiedAt?.toISOString() ?? null,
    openaiLastError: stored?.openaiLastError ?? "",
    resendApiKey: Boolean(stored?.resendApiKeyEncrypted || (isDemo ? "" : process.env.RESEND_API_KEY)),
    resendFromEmail: stored?.resendFromEmail || (isDemo ? "" : process.env.RESEND_FROM_EMAIL) || "",
    resendSupportEmail: stored?.resendSupportEmail || (isDemo ? "" : process.env.RESEND_SUPPORT_EMAIL) || "",
    resendWebhookSecret: Boolean(stored?.resendWebhookSecretEncrypted || (isDemo ? "" : process.env.RESEND_WEBHOOK_SECRET)),
  };
  return { ...configured, encryptionReady: serviceEncryptionReady(), source: {
    openaiApiKey: stored?.openaiApiKeyEncrypted ? "dashboard" : (isDemo ? "" : process.env.OPENAI_API_KEY) ? "deployment" : "unset",
    openaiModel: stored?.openaiResearchModel || stored?.openaiModel ? "dashboard" : (isDemo ? "" : process.env.OPENAI_MODEL) ? "deployment" : "unset",
    openaiResearchModel: stored?.openaiResearchModel || stored?.openaiModel ? "dashboard" : (isDemo ? "" : process.env.OPENAI_MODEL) ? "deployment" : "unset",
    openaiApprovalModel: stored?.openaiApprovalModel || stored?.openaiModel ? "dashboard" : (isDemo ? "" : process.env.OPENAI_MODEL) ? "deployment" : "unset",
    openaiAutopilotModel: stored?.openaiAutopilotModel || stored?.openaiModel ? "dashboard" : (isDemo ? "" : process.env.OPENAI_MODEL) ? "deployment" : "unset",
    resendApiKey: stored?.resendApiKeyEncrypted ? "dashboard" : (isDemo ? "" : process.env.RESEND_API_KEY) ? "deployment" : "unset",
    resendFromEmail: stored?.resendFromEmail ? "dashboard" : (isDemo ? "" : process.env.RESEND_FROM_EMAIL) ? "deployment" : "unset",
    resendSupportEmail: stored?.resendSupportEmail ? "dashboard" : (isDemo ? "" : process.env.RESEND_SUPPORT_EMAIL) ? "deployment" : "unset",
    resendWebhookSecret: stored?.resendWebhookSecretEncrypted ? "dashboard" : (isDemo ? "" : process.env.RESEND_WEBHOOK_SECRET) ? "deployment" : "unset",
  } };
}

export async function recordOpenAIHealth(key: "global" | "demo", error = "") {
  await connectDB();
  await ServiceConfig.updateOne({ key }, { $set: { openaiVerifiedAt: error ? null : new Date(), openaiLastError: error.slice(0, 240) }, $setOnInsert: { key } }, { upsert: true });
}

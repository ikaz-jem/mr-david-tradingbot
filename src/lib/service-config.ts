import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { connectDB } from "@/lib/db";
import { ServiceConfig } from "@/models/ServiceConfig";

export const secretFields = ["openaiApiKey", "resendApiKey", "resendWebhookSecret"] as const;
export type SecretField = (typeof secretFields)[number];
export const textFields = ["openaiModel", "resendFromEmail", "resendSupportEmail"] as const;
export type TextField = (typeof textFields)[number];

function encryptionKey() {
  const bootstrap = process.env.NEXTAUTH_SECRET;
  if (!bootstrap || bootstrap.length < 32) throw new Error("A strong NEXTAUTH_SECRET is required to protect service settings");
  return Buffer.from(hkdfSync("sha256", Buffer.from(bootstrap), Buffer.from("enrivea-service-config-v1"), Buffer.from("credential-encryption"), 32));
}

export function serviceEncryptionReady() { try { encryptionKey(); return true; } catch { return false; } }

export function encryptServiceSecret(value: string, field: SecretField) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`service-config:${field}`));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptServiceSecret(value: string, field: SecretField) {
  const [version, iv, tag, ciphertext] = value.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Stored service credential has an invalid format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(`service-config:${field}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export async function getServiceConfig() {
  await connectDB();
  const stored = await ServiceConfig.findOne({ key: "global" }).lean();
  return {
    openaiApiKey: stored?.openaiApiKeyEncrypted ? decryptServiceSecret(stored.openaiApiKeyEncrypted, "openaiApiKey") : process.env.OPENAI_API_KEY ?? "",
    openaiModel: stored?.openaiModel || process.env.OPENAI_MODEL || "",
    resendApiKey: stored?.resendApiKeyEncrypted ? decryptServiceSecret(stored.resendApiKeyEncrypted, "resendApiKey") : process.env.RESEND_API_KEY ?? "",
    resendFromEmail: stored?.resendFromEmail || process.env.RESEND_FROM_EMAIL || "",
    resendSupportEmail: stored?.resendSupportEmail || process.env.RESEND_SUPPORT_EMAIL || "",
    resendWebhookSecret: stored?.resendWebhookSecretEncrypted ? decryptServiceSecret(stored.resendWebhookSecretEncrypted, "resendWebhookSecret") : process.env.RESEND_WEBHOOK_SECRET ?? "",
  };
}

export async function getServiceConfigStatus() {
  await connectDB();
  const stored = await ServiceConfig.findOne({ key: "global" }).lean();
  const configured = {
    openaiApiKey: Boolean(stored?.openaiApiKeyEncrypted || process.env.OPENAI_API_KEY),
    openaiModel: stored?.openaiModel || process.env.OPENAI_MODEL || "",
    resendApiKey: Boolean(stored?.resendApiKeyEncrypted || process.env.RESEND_API_KEY),
    resendFromEmail: stored?.resendFromEmail || process.env.RESEND_FROM_EMAIL || "",
    resendSupportEmail: stored?.resendSupportEmail || process.env.RESEND_SUPPORT_EMAIL || "",
    resendWebhookSecret: Boolean(stored?.resendWebhookSecretEncrypted || process.env.RESEND_WEBHOOK_SECRET),
  };
  return { ...configured, encryptionReady: serviceEncryptionReady(), source: {
    openaiApiKey: stored?.openaiApiKeyEncrypted ? "dashboard" : process.env.OPENAI_API_KEY ? "deployment" : "unset",
    openaiModel: stored?.openaiModel ? "dashboard" : process.env.OPENAI_MODEL ? "deployment" : "unset",
    resendApiKey: stored?.resendApiKeyEncrypted ? "dashboard" : process.env.RESEND_API_KEY ? "deployment" : "unset",
    resendFromEmail: stored?.resendFromEmail ? "dashboard" : process.env.RESEND_FROM_EMAIL ? "deployment" : "unset",
    resendSupportEmail: stored?.resendSupportEmail ? "dashboard" : process.env.RESEND_SUPPORT_EMAIL ? "deployment" : "unset",
    resendWebhookSecret: stored?.resendWebhookSecretEncrypted ? "dashboard" : process.env.RESEND_WEBHOOK_SECRET ? "deployment" : "unset",
  } };
}

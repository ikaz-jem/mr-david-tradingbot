import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function encryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("A strong NEXTAUTH_SECRET is required to protect affiliate payout details");
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret), Buffer.from("enrivea-affiliate-payout-v1"), Buffer.from("profile-encryption"), 32));
}

export function encryptAffiliatePayoutDetails(userId: string, details: Record<string, string>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`affiliate-payout:${userId}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(details), "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptAffiliatePayoutDetails(userId: string, value: string) {
  const [version, iv, tag, encrypted] = value.split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Affiliate payout profile format is invalid");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(`affiliate-payout:${userId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const decoded = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8"));
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("Affiliate payout profile is invalid");
  return decoded as Record<string, string>;
}

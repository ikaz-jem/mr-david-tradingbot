import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { EmailToken } from "@/models/EmailToken";

export const hashEmailToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueEmailToken(userId: mongoose.Types.ObjectId, kind: "verify" | "reset", minutes: number) {
  const token = randomBytes(32).toString("base64url");
  await EmailToken.deleteMany({ userId, kind });
  await EmailToken.create({ userId, kind, tokenHash: hashEmailToken(token), expiresAt: new Date(Date.now() + minutes * 60_000) });
  return token;
}

export function emailActionUrl(path: string, token: string) {
  const base = process.env.APP_URL;
  if (!base) throw new Error("APP_URL is missing");
  const url = new URL(path, base);
  url.searchParams.set("token", token);
  return url.toString();
}

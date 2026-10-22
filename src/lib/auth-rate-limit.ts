import "server-only";
import { createHash } from "node:crypto";
import { consumeAdminMutationLimit } from "@/lib/admin-mutation-limit";

export async function allowAuthRequest(request: Request, action: string, identity?: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const digest = (value: string) => createHash("sha256").update(`${process.env.NEXTAUTH_SECRET}:${value}`).digest("hex");
  if (!await consumeAdminMutationLimit(digest(ip), `auth:${action}:ip`, 30, 15 * 60_000)) return false;
  return !identity || consumeAdminMutationLimit(digest(identity.toLowerCase()), `auth:${action}:identity`, 5, 15 * 60_000);
}

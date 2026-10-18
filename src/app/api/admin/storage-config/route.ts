import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { connectDB } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-origin";
import { encryptServiceSecret, serviceEncryptionReady } from "@/lib/service-config";
import { completeR2Settings, deploymentR2Settings, getR2Settings, probeR2Settings, type R2Settings } from "@/lib/help-r2";
import { ServiceConfig } from "@/models/ServiceConfig";
import { HelpAsset } from "@/models/HelpAsset";
import { SecurityAttempt } from "@/models/SecurityAttempt";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";

export const runtime = "nodejs";
const input = z.object({
  action: z.enum(["save", "test", "clear"]),
  accountId: z.string().trim().regex(/^[a-fA-F0-9]{32}$/).optional(),
  bucketName: z.string().trim().regex(/^[a-zA-Z0-9][a-zA-Z0-9.-]{1,61}[a-zA-Z0-9]$/).optional(),
  accessKeyId: z.string().trim().min(10).max(200).optional(),
  secretAccessKey: z.string().trim().min(20).max(300).optional(),
  reason: z.string().trim().min(8).max(300).optional(),
});
async function actorFor(permission: "settings:read" | "settings:update") {
  const actor = await workspaceActor();
  return actor?.organizationKind === "platform" && actor.can(permission) ? actor : null;
}
async function status(isDemo: boolean) {
  await connectDB();
  const saved = await ServiceConfig.findOne({ key: isDemo ? "demo" : "global" }).lean();
  const dashboard = Boolean(saved?.r2AccountId && saved?.r2BucketName && saved?.r2AccessKeyIdEncrypted && saved?.r2SecretAccessKeyEncrypted);
  const deployment = deploymentR2Settings();
  return { accountId: dashboard ? saved?.r2AccountId : deployment.accountId, bucketName: dashboard ? saved?.r2BucketName : deployment.bucketName, configured: dashboard || completeR2Settings(deployment), source: dashboard ? "dashboard" : completeR2Settings(deployment) ? "deployment" : "unset", encryptionReady: serviceEncryptionReady(), demo: isDemo };
}
async function assetCount(isDemo: boolean) { return HelpAsset.countDocuments({ key: { $regex: isDemo ? "^help/demo/" : "^help/live/" } }); }
export async function GET() {
  const actor = await actorFor("settings:read");
  if (!actor) return NextResponse.json({ error: "Settings read permission required." }, { status: 403 });
  return NextResponse.json(await status(Boolean(actor.isDemo)), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await actorFor("settings:update");
  if (!actor) return NextResponse.json({ error: "Settings update permission required." }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid R2 values and an audit reason when saving or removing." }, { status: 400 });
  const data = parsed.data;
  if (!data.reason || data.reason.length < 8) return NextResponse.json({ error: "Enter an audit reason of at least 8 characters." }, { status: 400 });
  if (!serviceEncryptionReady()) return NextResponse.json({ error: "Set SERVICE_CONFIG_ENCRYPTION_KEY or a strong NEXTAUTH_SECRET before storing credentials." }, { status: 503 });
  await connectDB();
  const bucket = Math.floor(Date.now() / 60_000);
  const row = await SecurityAttempt.findOneAndUpdate({ key: "storage-config:" + actor.id + ":" + bucket }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 60_000) } }, { upsert: true, returnDocument: "after" });
  if ((row?.count ?? 0) > 10) return NextResponse.json({ error: "Too many storage checks. Wait one minute and retry." }, { status: 429 });
  const isDemo = Boolean(actor.isDemo);
  const current = await getR2Settings(isDemo).catch(() => deploymentR2Settings());
  const next: R2Settings = { accountId: data.accountId ?? "", bucketName: data.bucketName ?? "", accessKeyId: data.accessKeyId ?? "", secretAccessKey: data.secretAccessKey ?? "" };
  if (data.action !== "clear" && !completeR2Settings(next)) return NextResponse.json({ error: "Enter all four Cloudflare R2 fields." }, { status: 400 });
  const destination = data.action === "clear" ? deploymentR2Settings() : next;
  if (data.action !== "test" && await assetCount(isDemo) > 0 && (destination.accountId !== current.accountId || destination.bucketName !== current.bucketName)) {
    return NextResponse.json({ error: "This scope already has Help Center images. Keep the same account and bucket, or migrate and delete those images before switching storage." }, { status: 409 });
  }
  if (data.action !== "clear") {
    let testAudit: InstanceType<typeof AdminAuditEvent> | null = null;
    if (data.action === "test") testAudit = await AdminAuditEvent.create({ actorId: actor.id, targetType: "platform", targetId: "r2-storage:" + (isDemo ? "demo" : "global"), action: "r2_test", before: "no configuration change", after: "connection verification requested", reason: data.reason, status: "pending" });
    try { await probeR2Settings(next, isDemo); if (testAudit) await AdminAuditEvent.updateOne({ _id: testAudit._id }, { $set: { status: "applied" } }); }
    catch (error) { if (testAudit) await AdminAuditEvent.updateOne({ _id: testAudit._id }, { $set: { status: "failed" } }).catch(() => undefined); console.warn("R2 verification failed", error instanceof Error ? error.name : "unknown"); return NextResponse.json({ error: "R2 verification failed. Check the account ID, bucket, token permissions (read/write/delete), and connectivity. Nothing was saved." }, { status: 502 }); }
  }
  if (data.action === "test") return NextResponse.json({ ok: true, message: "R2 upload, read, and delete verified." });
  const key = isDemo ? "demo" : "global";
  const saved = await ServiceConfig.findOne({ key });
  const audit = await AdminAuditEvent.create({ actorId: actor.id, targetType: "platform", targetId: "r2-storage:" + key, action: "r2_" + data.action, before: saved?.r2AccountId ? saved.r2AccountId + "/" + saved.r2BucketName : "no dashboard override", after: data.action === "clear" ? "dashboard override removed" : next.accountId + "/" + next.bucketName, reason: data.reason!, status: "pending" });
  try {
    const update = data.action === "clear" ? { r2AccountId: "", r2BucketName: "", r2AccessKeyIdEncrypted: "", r2SecretAccessKeyEncrypted: "" } : {
      r2AccountId: next.accountId, r2BucketName: next.bucketName,
      r2AccessKeyIdEncrypted: encryptServiceSecret(next.accessKeyId, "r2AccessKeyId"),
      r2SecretAccessKeyEncrypted: encryptServiceSecret(next.secretAccessKey, "r2SecretAccessKey"),
    };
    const result = await ServiceConfig.updateOne({ key, ...(saved ? { updatedAt: saved.updatedAt } : {}) }, { $set: update, $setOnInsert: { key } }, { upsert: !saved });
    if (!result.modifiedCount && !result.upsertedCount) { await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } }); return NextResponse.json({ error: "Settings changed concurrently. Refresh and retry." }, { status: 409 }); }
    await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "applied" } });
    return NextResponse.json({ ok: true, status: await status(isDemo) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } }).catch(() => undefined);
    return NextResponse.json({ error: "R2 configuration could not be saved. No credential was returned." }, { status: 503 });
  }
}

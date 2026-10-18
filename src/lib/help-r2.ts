import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { connectDB } from "@/lib/db";
import { decryptServiceSecret } from "@/lib/service-config";
import { ServiceConfig } from "@/models/ServiceConfig";

export type R2Settings = { accountId: string; bucketName: string; accessKeyId: string; secretAccessKey: string };
export function deploymentR2Settings(): R2Settings {
  return { accountId: process.env.R2_ACCOUNT_ID?.trim() ?? "", bucketName: process.env.R2_BUCKET_NAME?.trim() ?? "", accessKeyId: process.env.R2_ACCESS_KEY_ID?.trim() ?? "", secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "" };
}
export function completeR2Settings(value: R2Settings) { return Boolean(value.accountId && value.bucketName && value.accessKeyId && value.secretAccessKey); }
export async function getR2Settings(isDemo = false): Promise<R2Settings> {
  await connectDB();
  const saved = await ServiceConfig.findOne({ key: isDemo ? "demo" : "global" }).select("r2AccountId r2BucketName +r2AccessKeyIdEncrypted +r2SecretAccessKeyEncrypted").lean();
  if (saved?.r2AccountId && saved.r2BucketName && saved.r2AccessKeyIdEncrypted && saved.r2SecretAccessKeyEncrypted) {
    return { accountId: saved.r2AccountId, bucketName: saved.r2BucketName, accessKeyId: decryptServiceSecret(saved.r2AccessKeyIdEncrypted, "r2AccessKeyId"), secretAccessKey: decryptServiceSecret(saved.r2SecretAccessKeyEncrypted, "r2SecretAccessKey") };
  }
  return deploymentR2Settings();
}
export async function r2Configured(isDemo = false) { try { return completeR2Settings(await getR2Settings(isDemo)); } catch { return false; } }
function client(settings: R2Settings) {
  if (!completeR2Settings(settings)) throw new Error("Cloudflare R2 is not configured. Open Platform controls → Image storage.");
  return new S3Client({ region: "auto", endpoint: "https://" + settings.accountId + ".r2.cloudflarestorage.com", credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey }, maxAttempts: 2 });
}
async function target(isDemo: boolean) { const settings = await getR2Settings(isDemo); return { bucket: settings.bucketName, client: client(settings) }; }
export async function probeR2Settings(settings: R2Settings, isDemo: boolean) {
  const s3 = client(settings);
  const key = "help/" + (isDemo ? "demo" : "live") + "/connection-check/" + crypto.randomUUID() + ".txt";
  const options = { abortSignal: AbortSignal.timeout(12000) };
  let created = false;
  try {
    await s3.send(new PutObjectCommand({ Bucket: settings.bucketName, Key: key, Body: Buffer.from("enrivea-r2-check"), ContentType: "text/plain" }), options);
    created = true;
    const response = await s3.send(new GetObjectCommand({ Bucket: settings.bucketName, Key: key }), options);
    if (!response.Body || Buffer.from(await response.Body.transformToByteArray()).toString() !== "enrivea-r2-check") throw new Error("R2 could not read the verification object.");
    await s3.send(new DeleteObjectCommand({ Bucket: settings.bucketName, Key: key }), options);
    created = false;
  } finally {
    if (created) await s3.send(new DeleteObjectCommand({ Bucket: settings.bucketName, Key: key })).catch(() => undefined);
    s3.destroy();
  }
}
export async function putHelpImage(key: string, body: Buffer, isDemo = false) { const { client: s3, bucket } = await target(isDemo); try { await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "image/webp", CacheControl: "public, max-age=86400" })); } finally { s3.destroy(); } }
export async function getHelpImage(key: string, isDemo = false) { const { client: s3, bucket } = await target(isDemo); try { const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })); if (!response.Body) throw new Error("Image object is empty."); return response.Body.transformToByteArray(); } finally { s3.destroy(); } }
export async function deleteHelpImage(key: string, isDemo = false) { const { client: s3, bucket } = await target(isDemo); try { await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); } finally { s3.destroy(); } }

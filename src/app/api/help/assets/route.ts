import { NextResponse } from "next/server";
import mongoose from "mongoose";
import sharp from "sharp";
import { workspaceActor } from "@/lib/workspace-access";
import { writeSecurityAudit } from "@/lib/access-control";
import { isSameOrigin } from "@/lib/request-origin";
import { deleteHelpImage, putHelpImage, r2Configured } from "@/lib/help-r2";
import { HelpArticle } from "@/models/HelpArticle";
import { HelpAsset } from "@/models/HelpAsset";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor || actor.organizationKind !== "platform" || !actor.can("help:create")) return NextResponse.json({ error: "Image upload permission required." }, { status: 403 });
  if (!await r2Configured(Boolean(actor.isDemo))) return NextResponse.json({ error: "Image storage is not configured yet. Ask an administrator to set Cloudflare R2 under Platform controls → Image storage." }, { status: 503 });
  const form = await request.formData().catch(() => null); const file = form?.get("file");
  const articleId = String(form?.get("articleId") ?? ""); const alt = String(form?.get("alt") ?? "").trim().slice(0, 180); const caption = String(form?.get("caption") ?? "").trim().slice(0, 300);
  if (!(file instanceof File) || !mongoose.isValidObjectId(articleId) || !alt) return NextResponse.json({ error: "Choose an article, image, and descriptive alt text." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024 || file.size < 100 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return NextResponse.json({ error: "Upload a JPG, PNG, or WebP image under 5 MB." }, { status: 400 });
  const scope = actor.isDemo ? "demo" : "live";
  const article = await HelpArticle.findOne({ _id: articleId, scope, status: { $ne: "deleted" } }).select("_id").lean();
  if (!article) return NextResponse.json({ error: "Article not found." }, { status: 404 });
  const recent = await HelpAsset.countDocuments({ uploadedBy: actor.id, createdAt: { $gt: new Date(Date.now() - 3600000) } });
  if (recent >= 20) return NextResponse.json({ error: "Image upload limit reached. Try again later." }, { status: 429 });
  let buffer: Buffer;
  try { buffer = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 24_000_000 }).rotate().resize({ width: 1600, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toBuffer(); }
  catch { return NextResponse.json({ error: "This image could not be processed." }, { status: 400 }); }
  const key = "help/" + scope + "/" + articleId + "/" + crypto.randomUUID() + ".webp";
  const asset = await HelpAsset.create({ articleId: article._id, key, alt, caption, byteSize: buffer.length, uploadedBy: actor.id, status: "upload_pending" });
  try {
    await putHelpImage(key, buffer, Boolean(actor.isDemo));
    asset.status = "active"; await asset.save();
    await writeSecurityAudit({ actor, action: "help.asset.upload", resource: "help", targetType: "asset", targetId: String(asset._id), newValue: { articleId, byteSize: buffer.length }, outcome: "success", request });
    return NextResponse.json({ id: String(asset._id), alt, caption, url: "/api/help/assets/" + String(asset._id) }, { status: 201 });
  } catch { asset.status = "deletion_pending"; await asset.save().catch(() => undefined); await deleteHelpImage(key, Boolean(actor.isDemo)).then(() => asset.deleteOne()).catch(() => undefined); return NextResponse.json({ error: "Image upload failed. Check R2 configuration and try again." }, { status: 502 }); }
}

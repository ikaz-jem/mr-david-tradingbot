import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { workspaceActor } from "@/lib/workspace-access";
import { writeSecurityAudit } from "@/lib/access-control";
import { isSameOrigin } from "@/lib/request-origin";
import { deleteHelpImage, getHelpImage } from "@/lib/help-r2";
import { HelpArticle } from "@/models/HelpArticle";
import { HelpCategory } from "@/models/HelpCategory";
import { HelpAsset } from "@/models/HelpAsset";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params; if (!mongoose.isValidObjectId(id)) return new NextResponse(null, { status: 404 });
  const asset = await HelpAsset.findOne({ _id: id, status: "active" }).lean(); if (!asset) return new NextResponse(null, { status: 404 });
  const article = await HelpArticle.findById(asset.articleId).select("scope categorySlug status").lean(); if (!article || article.status === "deleted") return new NextResponse(null, { status: 404 });
  let isPublic = false;
  if (asset.published && article.scope === "live" && article.status === "published") isPublic = Boolean(await HelpCategory.exists({ scope: "live", slug: article.categorySlug, status: "active" }));
  if (!isPublic) { const actor = await workspaceActor(); if (!actor || actor.organizationKind !== "platform" || !actor.can("help:read") || (actor.isDemo ? "demo" : "live") !== article.scope) return new NextResponse(null, { status: 404 }); }
  try { const bytes = await getHelpImage(asset.key, article.scope === "demo"); return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "image/webp", "Cache-Control": isPublic ? "public, max-age=86400" : "private, no-store", "X-Content-Type-Options": "nosniff" } }); }
  catch { return new NextResponse(null, { status: 503 }); }
}
export async function DELETE(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor(); if (!actor || actor.organizationKind !== "platform" || !actor.can("help:update")) return NextResponse.json({ error: "Image delete permission required." }, { status: 403 });
  const { id } = await params; if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid image." }, { status: 400 });
  const asset = await HelpAsset.findById(id); if (!asset) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  const article = await HelpArticle.findOne({ _id: asset.articleId, scope: actor.isDemo ? "demo" : "live", status: { $ne: "deleted" } }).select("_id").lean();
  if (!article) return NextResponse.json({ error: "Image not found in this workspace." }, { status: 404 });
  try { await deleteHelpImage(asset.key, Boolean(actor.isDemo)); await asset.deleteOne(); await writeSecurityAudit({ actor, action: "help.asset.delete", resource: "help", targetType: "asset", targetId: id, previousValue: { articleId: String(article._id) }, outcome: "success", request }); return NextResponse.json({ ok: true }); }
  catch { asset.status = "deletion_pending"; await asset.save(); return NextResponse.json({ error: "R2 deletion failed. The image has been hidden and marked for retry." }, { status: 502 }); }
}

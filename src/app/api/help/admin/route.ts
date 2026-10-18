import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { writeSecurityAudit } from "@/lib/access-control";
import { ensureHelpContent } from "@/lib/help-content";
import { deleteHelpImage, r2Configured } from "@/lib/help-r2";
import { HelpCategory } from "@/models/HelpCategory";
import { HelpArticle } from "@/models/HelpArticle";
import { HelpArticleRevision } from "@/models/HelpArticleRevision";
import { HelpAsset } from "@/models/HelpAsset";
import { HelpRedirect } from "@/models/HelpRedirect";
import { allowHelpMutation } from "@/lib/help-mutation-limit";

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(90);
const categoryInput = z.object({ slug, title: z.string().trim().min(3).max(90), description: z.string().trim().min(10).max(220), status: z.enum(["active", "hidden"]).default("active"), sortOrder: z.number().int().min(0).max(10000).default(0) });
const articleInput = z.object({ slug, title: z.string().trim().min(5).max(150), summary: z.string().trim().min(15).max(300), categorySlug: slug, body: z.string().trim().min(30).max(30000), keywords: z.array(z.string().trim().min(2).max(50)).max(20).default([]), sortOrder: z.number().int().min(0).max(10000).default(0) });
const scopeFor = (actor: { isDemo: boolean }) => actor.isDemo ? "demo" : "live";
function error(message: string, status: number) { return NextResponse.json({ error: message }, { status }); }
async function actorFor(permission: string) { const actor = await workspaceActor(); return actor?.organizationKind === "platform" && actor.can(permission) ? actor : null; }
async function revision(article: { _id: mongoose.Types.ObjectId; revision: number; toObject: () => object }, actorId: string, action: string) { await HelpArticleRevision.create({ articleId: article._id, revision: article.revision, actorId, action, snapshot: article.toObject() }); }

export async function GET() {
  const actor = await actorFor("help:read");
  if (!actor) return error("Help Center read permission required.", 403);
  const scope = scopeFor(actor); await ensureHelpContent(scope);
  const [categories, articles] = await Promise.all([HelpCategory.find({ scope, status: { $ne: "deleted" } }).sort({ sortOrder: 1 }).lean(), HelpArticle.find({ scope, status: { $ne: "deleted" } }).select("-body -draft").sort({ updatedAt: -1 }).lean()]);
  return NextResponse.json({ categories, articles, scope, storageConfigured: await r2Configured(Boolean(actor.isDemo)) });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return error("Invalid origin.", 403);
  const actor = await actorFor("help:create"); if (!actor) return error("Help Center create permission required.", 403);
  if (!await allowHelpMutation(actor.id)) return error("Too many editorial changes. Try again in a minute.", 429);
  const data = await request.json().catch(() => null);
  const scope = scopeFor(actor); await ensureHelpContent(scope);
  if (data?.kind === "category") {
    const parsed = categoryInput.safeParse(data); if (!parsed.success) return error("Check the category fields and try again.", 400);
    if (await HelpCategory.exists({ scope, slug: parsed.data.slug })) return error("This category slug already exists.", 409);
    const category = await HelpCategory.create({ ...parsed.data, scope });
    await writeSecurityAudit({ actor, action: "help.category.create", resource: "help", targetType: "category", targetId: String(category._id), newValue: parsed.data, outcome: "success", request });
    return NextResponse.json({ id: String(category._id) }, { status: 201 });
  }
  if (data?.kind === "article") {
    const parsed = articleInput.safeParse(data); if (!parsed.success) return error("Check the article fields and try again.", 400);
    if (!await HelpCategory.exists({ scope, slug: parsed.data.categorySlug, status: { $ne: "deleted" } })) return error("Choose an existing category.", 400);
    if (await HelpArticle.exists({ scope, slug: parsed.data.slug }) || await HelpRedirect.exists({ scope, fromSlug: parsed.data.slug })) return error("This article slug is already used or reserved by a redirect.", 409);
    const article = await HelpArticle.create({ ...parsed.data, scope, status: "draft", createdBy: actor.id });
    await revision(article, actor.id, "create");
    await writeSecurityAudit({ actor, action: "help.article.create", resource: "help", targetType: "article", targetId: String(article._id), newValue: { slug: article.slug, status: article.status }, outcome: "success", request });
    return NextResponse.json({ id: String(article._id) }, { status: 201 });
  }
  return error("Choose an article or category.", 400);
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return error("Invalid origin.", 403);
  const data = await request.json().catch(() => null);
  const id = String(data?.id ?? "");
  if (!mongoose.isValidObjectId(id)) return error("Invalid item.", 400);
  const permission = data?.action === "publish" || data?.action === "archive" ? "help:publish" : "help:update";
  const actor = await actorFor(permission); if (!actor) return error("Help Center permission required.", 403);
  if (!await allowHelpMutation(actor.id)) return error("Too many editorial changes. Try again in a minute.", 429);
  const scope = scopeFor(actor);
  if (data?.kind === "category") {
    const parsed = categoryInput.safeParse(data); if (!parsed.success) return error("Check the category fields.", 400);
    const category = await HelpCategory.findOne({ _id: id, scope }); if (!category) return error("Category not found.", 404);
    if (parsed.data.slug !== category.slug && await HelpCategory.exists({ scope, slug: parsed.data.slug })) return error("This slug is already used.", 409);
    if (parsed.data.slug !== category.slug && await HelpArticle.exists({ scope, categorySlug: category.slug, status: { $ne: "deleted" } })) return error("Move or remove articles before changing this slug.", 409);
    const previous = category.toObject(); Object.assign(category, parsed.data); await category.save();
    await writeSecurityAudit({ actor, action: "help.category.update", resource: "help", targetType: "category", targetId: id, previousValue: previous, newValue: parsed.data, outcome: "success", request });
    return NextResponse.json({ ok: true });
  }
  const article = await HelpArticle.findOne({ _id: id, scope, status: { $ne: "deleted" } }); if (!article) return error("Article not found.", 404);
  if (!Number.isInteger(data?.revision) || data.revision !== article.revision) return error("This article changed since you opened it. Reload before saving.", 409);
  const previous = { slug: article.slug, status: article.status, revision: article.revision };
  if (data?.action === "publish") {
    const draft = article.draft as Partial<z.infer<typeof articleInput>> | null;
    if (draft ? article.draftStatus !== "review" : article.status !== "review") return error("Send the article to review before publishing.", 409);
    const categorySlug = draft?.categorySlug ?? article.categorySlug;
    if (!await HelpCategory.exists({ scope, slug: categorySlug, status: "active" })) return error("Activate the article category before publishing.", 409);
    if ((draft?.body ?? article.body).length < 30) return error("Complete the article before publishing.", 400);
    if (draft) {
      if (draft.slug && draft.slug !== article.slug && (await HelpArticle.exists({ scope, slug: draft.slug }) || await HelpRedirect.exists({ scope, fromSlug: draft.slug }))) return error("The new slug is now used by another article or redirect.", 409);
      Object.assign(article, draft); article.draft = null; article.draftStatus = null;
    }
    article.status = "published"; article.publishedAt = new Date(); article.reviewedAt = new Date(); article.reviewedBy = new mongoose.Types.ObjectId(actor.id);
  } else if (data?.action === "archive") {
    article.status = "archived";
  } else if (data?.action === "review") {
    if (article.status === "published" && article.draft) article.draftStatus = "review";
    else article.status = "review";
  } else {
    const parsed = articleInput.safeParse(data); if (!parsed.success) return error("Check the article fields.", 400);
    if (!await HelpCategory.exists({ scope, slug: parsed.data.categorySlug, status: { $ne: "deleted" } })) return error("Choose an existing category.", 400);
    if (parsed.data.slug !== article.slug && (await HelpArticle.exists({ scope, slug: parsed.data.slug }) || await HelpRedirect.exists({ scope, fromSlug: parsed.data.slug }))) return error("This slug is already used or reserved by a redirect.", 409);
    if (article.status === "published") { article.draft = parsed.data; article.draftStatus = "draft"; article.markModified("draft"); }
    else { Object.assign(article, parsed.data); article.status = "draft"; }
  }
  article.revision += 1;
  try { await article.save(); } catch (saveError) { if (saveError instanceof mongoose.Error.VersionError) return error("Another editor saved this article first. Reload before saving.", 409); throw saveError; }
  await revision(article, actor.id, data?.action ?? "edit");
  if (data?.action === "publish") {
    await HelpAsset.updateMany({ articleId: article._id, status: "active" }, { $set: { published: true } });
    if (previous.slug !== article.slug) {
      await HelpRedirect.updateMany({ scope, toSlug: previous.slug }, { $set: { toSlug: article.slug } });
      await HelpRedirect.updateOne({ scope, fromSlug: previous.slug }, { $set: { toSlug: article.slug } }, { upsert: true });
    }
  }
  await writeSecurityAudit({ actor, action: "help.article." + (data?.action ?? "update"), resource: "help", targetType: "article", targetId: id, previousValue: previous, newValue: { slug: article.slug, status: article.status, draftStatus: article.draftStatus, revision: article.revision }, outcome: "success", request });
  return NextResponse.json({ ok: true, revision: article.revision });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return error("Invalid origin.", 403);
  const actor = await actorFor("help:delete"); if (!actor) return error("Help Center delete permission required.", 403);
  if (!await allowHelpMutation(actor.id)) return error("Too many editorial changes. Try again in a minute.", 429);
  const data = await request.json().catch(() => null); const id = String(data?.id ?? "");
  if (!mongoose.isValidObjectId(id)) return error("Invalid item.", 400);
  const scope = scopeFor(actor);
  if (data?.kind === "category") {
    const category = await HelpCategory.findOne({ _id: id, scope }); if (!category) return error("Category not found.", 404);
    if (data.confirmSlug !== category.slug) return error("Enter the category slug to confirm deletion.", 400);
    if (await HelpArticle.exists({ scope, categorySlug: category.slug, status: { $ne: "deleted" } })) return error("Delete or move articles in this category first.", 409);
    category.status = "deleted"; await category.save();
    await writeSecurityAudit({ actor, action: "help.category.delete", resource: "help", targetType: "category", targetId: id, previousValue: { slug: category.slug }, outcome: "success", request });
    return NextResponse.json({ ok: true });
  }
  const article = await HelpArticle.findOne({ _id: id, scope, status: { $ne: "deleted" } }); if (!article) return error("Article not found.", 404);
  if (!Number.isInteger(data?.revision) || data.revision !== article.revision) return error("This article changed since you opened it. Reload before deleting.", 409);
  if (data?.confirmSlug !== article.slug) return error("Enter the article slug to confirm deletion.", 400);
  article.status = "deleted"; article.revision += 1;
  try { await article.save(); } catch (saveError) { if (saveError instanceof mongoose.Error.VersionError) return error("Another editor changed this article first. Reload before deleting.", 409); throw saveError; }
  await revision(article, actor.id, "delete");
  const assets = await HelpAsset.find({ articleId: article._id });
  let pending = 0;
  for (const asset of assets) { try { await deleteHelpImage(asset.key, Boolean(actor.isDemo)); await asset.deleteOne(); } catch { asset.status = "deletion_pending"; await asset.save(); pending++; } }
  await writeSecurityAudit({ actor, action: "help.article.delete", resource: "help", targetType: "article", targetId: id, previousValue: { slug: article.slug }, newValue: { status: "deleted", assetsPending: pending }, outcome: "success", request });
  return NextResponse.json({ ok: true, pendingCleanup: pending });
}

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { workspaceActor } from "@/lib/workspace-access";
import { HelpArticle } from "@/models/HelpArticle";
import { HelpArticleRevision } from "@/models/HelpArticleRevision";
import { HelpAsset } from "@/models/HelpAsset";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await workspaceActor();
  if (!actor || actor.organizationKind !== "platform" || !actor.can("help:read")) return NextResponse.json({ error: "Help Center read permission required." }, { status: 403 });
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "Invalid article." }, { status: 400 });
  const article = await HelpArticle.findOne({ _id: id, scope: actor.isDemo ? "demo" : "live", status: { $ne: "deleted" } }).lean();
  if (!article) return NextResponse.json({ error: "Article not found." }, { status: 404 });
  const [revisions, assets] = await Promise.all([HelpArticleRevision.find({ articleId: article._id }).select("-snapshot").sort({ revision: -1 }).limit(25).lean(), HelpAsset.find({ articleId: article._id, status: "active" }).sort({ createdAt: 1 }).lean()]);
  const editable = article.draft ? { ...article, ...(article.draft as object) } : article;
  return NextResponse.json({ article: editable, revisions, assets });
}

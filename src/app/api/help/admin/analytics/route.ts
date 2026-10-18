import { NextResponse } from "next/server";
import { workspaceActor } from "@/lib/workspace-access";
import { ensureHelpContent } from "@/lib/help-content";
import { HelpArticle } from "@/models/HelpArticle";
import { HelpFeedback } from "@/models/HelpFeedback";
export async function GET() {
  const actor = await workspaceActor();
  if (!actor || actor.organizationKind !== "platform" || !actor.can("help:read")) return NextResponse.json({ error: "Help Center read permission required." }, { status: 403 });
  const scope = actor.isDemo ? "demo" : "live"; await ensureHelpContent(scope);
  const articles = await HelpArticle.find({ scope, status: { $ne: "deleted" } }).select("_id status reviewedAt updatedAt title slug").lean();
  const ids = articles.map(article => article._id);
  const feedback = await HelpFeedback.aggregate([{ $match: { articleId: { $in: ids } } }, { $group: { _id: { articleId: "$articleId", helpful: "$helpful" }, count: { $sum: 1 } } }]);
  return NextResponse.json({ total: articles.length, published: articles.filter(article => article.status === "published").length, drafts: articles.filter(article => article.status === "draft" || article.status === "review").length, stale: articles.filter(article => article.status === "published" && new Date(article.reviewedAt || article.updatedAt).getTime() < Date.now() - 90 * 86400000).length, feedback: feedback.map(item => ({ articleId: String(item._id.articleId), helpful: item._id.helpful, count: item.count })) });
}

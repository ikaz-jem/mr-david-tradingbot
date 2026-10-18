import type { MetadataRoute } from "next";
import { ensureHelpContent } from "@/lib/help-content";
import { HelpArticle } from "@/models/HelpArticle";
import { HelpCategory } from "@/models/HelpCategory";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = new URL(process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").origin;
  await ensureHelpContent();
  const categories = await HelpCategory.find({ scope: "live", status: "active" }).select("slug updatedAt").lean();
  const articles = await HelpArticle.find({ scope: "live", status: "published", categorySlug: { $in: categories.map(category => category.slug) } }).select("slug publishedAt").lean();
  return [
    { url: origin + "/", changeFrequency: "weekly", priority: 1 },
    { url: origin + "/pricing", changeFrequency: "weekly", priority: 0.8 },
    { url: origin + "/help", changeFrequency: "weekly", priority: 0.8 },
    ...categories.map(category => ({ url: origin + "/help/category/" + category.slug, lastModified: category.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...articles.map(article => ({ url: origin + "/help/articles/" + article.slug, lastModified: article.publishedAt ?? undefined, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}

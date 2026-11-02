import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { HelpCategory } from "@/models/HelpCategory";
import { HelpArticle } from "@/models/HelpArticle";

// Public reference content only: never return drafts, hidden categories, or
// administrator notes. This is the native counterpart of the public help site.
export async function GET(request: Request) {
  await connectDB();
  const slug = new URL(request.url).searchParams.get("slug");
  const categories = await HelpCategory.find({ scope: "live", status: "active" }).sort({ sortOrder: 1 }).select("slug title description").lean();
  const allowed = categories.map(category => category.slug);
  if (slug) {
    if (!/^[a-z0-9-]{1,100}$/.test(slug)) return NextResponse.json({ error: "Article unavailable." }, { status: 404 });
    const article = await HelpArticle.findOne({ scope: "live", slug, status: "published", categorySlug: { $in: allowed } }).select("slug title summary categorySlug body relatedSlugs").lean();
    return article ? NextResponse.json({ article }) : NextResponse.json({ error: "Article unavailable." }, { status: 404 });
  }
  const articles = await HelpArticle.find({ scope: "live", status: "published", categorySlug: { $in: allowed } }).sort({ sortOrder: 1, title: 1 }).select("slug title summary categorySlug").lean();
  return NextResponse.json({ categories, articles }, { headers: { "Cache-Control": "public, max-age=60" } });
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ensureHelpContent } from "@/lib/help-content";
import { HelpCategory } from "@/models/HelpCategory";
import { HelpArticle } from "@/models/HelpArticle";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; await ensureHelpContent(); const category = await HelpCategory.findOne({ scope: "live", slug, status: "active" }).lean(); return { title: category ? category.title + " | Enrivea Help Center" : "Help Center", description: category?.description, alternates: { canonical: "/help/category/" + slug } }; }
export default async function HelpCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; await ensureHelpContent();
  const category = await HelpCategory.findOne({ scope: "live", slug, status: "active" }).lean();
  if (!category) notFound();
  const articles = await HelpArticle.find({ scope: "live", categorySlug: slug, status: "published" }).select("slug title summary").sort({ sortOrder: 1, title: 1 }).lean();
  return <main className="mx-auto max-w-[1140px] px-5 py-16 sm:px-8 lg:px-12"><Link href="/help" className="inline-flex items-center gap-2 text-sm font-bold text-accent"><ArrowLeft className="size-4"/> Help Center</Link><p className="eyebrow mt-12">Knowledge base / {String(articles.length).padStart(2, "0")} guides</p><h1 className="display mt-4 text-5xl sm:text-6xl">{category.title}</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-muted">{category.description}</p><div className="mt-12 divide-y divide-line rounded-[24px] border border-line bg-[#111a13]">{articles.map((article, index) => <Link key={article.slug} href={"/help/articles/" + article.slug} className="group flex items-start gap-5 p-6 transition hover:bg-[#19251a] sm:p-8"><span className="text-sm font-black text-accent">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><h2 className="text-lg font-bold text-white group-hover:text-accent">{article.title}</h2><p className="mt-2 text-sm leading-6 text-muted">{article.summary}</p></div><ArrowRight className="size-5 shrink-0 text-[#718771] group-hover:text-accent"/></Link>)}</div></main>;
}

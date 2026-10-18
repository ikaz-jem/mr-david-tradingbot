import Link from "next/link";
import { Search } from "lucide-react";
import { ensureHelpContent } from "@/lib/help-content";
import { HelpArticle } from "@/models/HelpArticle";
import { HelpCategory } from "@/models/HelpCategory";
import type { Metadata } from "next";
import { allowHelpSearch } from "@/lib/help-search-limit";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search Help | Enrivea Signal", robots: { index: false, follow: false } };
export default async function HelpSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw = "" } = await searchParams; const q = raw.trim().slice(0, 100);
  await ensureHelpContent();
  const categories = await HelpCategory.find({ scope: "live", status: "active" }).select("slug title").lean();
  const bySlug = new Map(categories.map(category => [category.slug, category.title]));
  const allowed = q.length >= 2 ? await allowHelpSearch() : true;
  const articles = allowed && q.length >= 2 ? await HelpArticle.find({ scope: "live", status: "published", categorySlug: { $in: categories.map(category => category.slug) }, $text: { $search: q } }).select("slug title summary categorySlug").limit(30).lean() : [];
  return <main className="mx-auto max-w-[1040px] px-5 py-16 sm:px-8"><Link href="/help" className="text-sm font-bold text-accent">← Help Center</Link><h1 className="display mt-10 text-4xl sm:text-5xl">Search the knowledge base.</h1><form action="/help/search" className="mt-8 flex gap-2 rounded-2xl border border-[#597541] bg-[#101c12] p-2"><Search className="ml-3 mt-3 size-5 text-accent"/><input autoFocus name="q" defaultValue={q} maxLength={100} aria-label="Search help" className="min-w-0 flex-1 bg-transparent px-2 text-white outline-none"/><button className="button-primary rounded-xl px-5 py-3 text-sm">Search</button></form><p className="mt-10 text-sm text-muted">{!allowed ? "Search limit reached. Please wait a minute and try again." : q ? articles.length + " result" + (articles.length === 1 ? "" : "s") + " for “" + q + "”" : "Enter a topic or question to find guidance."}</p><div className="mt-5 divide-y divide-line rounded-2xl border border-line bg-[#111a13]">{articles.map(article => <Link href={"/help/articles/" + article.slug} key={article.slug} className="block p-6 hover:bg-[#19251a]"><p className="text-xs font-bold uppercase tracking-widest text-accent">{bySlug.get(article.categorySlug)}</p><h2 className="mt-2 text-lg font-bold">{article.title}</h2><p className="mt-2 text-sm text-muted">{article.summary}</p></Link>)}{allowed && q && !articles.length && <div className="p-8"><p className="font-bold">No matching article yet.</p><p className="mt-2 text-sm text-muted">Try a different phrase or contact support from your workspace.</p></div>}</div></main>;
}

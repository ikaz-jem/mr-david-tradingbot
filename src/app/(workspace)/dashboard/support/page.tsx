import { PageIntro } from "@/components/dashboard-ui";
import { SupportInbox } from "@/components/support-inbox";
import { HelpArticle } from "@/models/HelpArticle";
import { HelpCategory } from "@/models/HelpCategory";
import { connectDB } from "@/lib/db";
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ article?: string }> }) {
  const { article: slug } = await searchParams;
  let initialTopic: { subject: string; category: string; body: string } | undefined;
  if (slug && /^[a-z0-9-]{1,90}$/.test(slug)) {
    await connectDB();
    const article = await HelpArticle.findOne({ scope: "live", slug, status: "published" }).select("title categorySlug").lean();
    if (article && await HelpCategory.exists({ scope: "live", slug: article.categorySlug, status: "active" })) {
      const category = ["billing", "research", "exchanges"].includes(article.categorySlug) ? (article.categorySlug === "exchanges" ? "exchange" : article.categorySlug) : "account";
      initialTopic = { subject: "Question about " + article.title, category, body: "I read /help/articles/" + slug + " and still need help with: " };
    }
  }
  return <><PageIntro eyebrow="Customer care" title="Support desk" description="Track requests, reply to your support team, and reopen an issue if you still need help."/><SupportInbox initialTopic={initialTopic}/></>;
}


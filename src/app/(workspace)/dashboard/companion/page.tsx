import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getProductCatalog } from "@/lib/product-catalog";
import { PageIntro } from "@/components/dashboard-ui";
import { TradingCompanionConsole } from "@/components/trading-companion-console";

export const dynamic = "force-dynamic";

export default async function TradingCompanionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await connectDB();
  const isDemo = Boolean(session.user.isDemo);
  const catalog = await getProductCatalog(isDemo);
  const products = catalog.filter((item) => ["signals", "approval-desk", "autopilot"].includes(item.slug)).map((item) => ({ slug: item.slug, name: item.name, description: item.description, enabled: item.enabled, cost: item.cost }));
  return <><PageIntro eyebrow="Enrivea intelligence suite" title="Trading Companion" description="Choose how much control you want: research the market, approve each proposed trade, or configure guarded automation."/><TradingCompanionConsole products={products} isDemo={isDemo}/></>;
}

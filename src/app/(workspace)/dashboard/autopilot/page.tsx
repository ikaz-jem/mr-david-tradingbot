import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getProductCatalog } from "@/lib/product-catalog";
import { PageIntro } from "@/components/dashboard-ui";
import { TradingCompanionConsole } from "@/components/trading-companion-console";

export const dynamic = "force-dynamic";

export default async function AutopilotPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await connectDB();
  const isDemo = Boolean(session.user.isDemo);
  const catalog = await getProductCatalog(isDemo);
  const products = catalog.filter((item) => ["signals", "approval-desk", "autopilot"].includes(item.slug)).map((item) => ({ slug: item.slug, name: item.name, description: item.description, enabled: item.enabled, cost: item.cost }));
  return <><PageIntro eyebrow="Trading Companion · Product 03" title="Guarded Autopilot" description="Configure automated-market scope and hard risk limits separately from the manual Approval Desk."/><TradingCompanionConsole products={products} isDemo={isDemo} view="autopilot"/></>;
}

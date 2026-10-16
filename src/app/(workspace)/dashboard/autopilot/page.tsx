import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { getProductCatalog } from "@/lib/product-catalog";
import { workspaceActor } from "@/lib/workspace-access";
import { PageIntro } from "@/components/dashboard-ui";
import { TradingCompanionConsole } from "@/components/trading-companion-console";
import { LiveAutopilotConsole } from "@/components/live-autopilot-console";

export const dynamic = "force-dynamic";

export default async function AutopilotPage() {
  const actor = await workspaceActor();
  if (!actor) redirect("/login");
  if (!actor.isDemo && actor.organizationKind === "platform") redirect("/admin/controls/autopilot");
  await connectDB();
  const isDemo = actor.isDemo;
  const catalog = await getProductCatalog(isDemo);
  const products = catalog.filter((item) => ["signals", "approval-desk", "autopilot"].includes(item.slug)).map((item) => ({ slug: item.slug, name: item.name, description: item.description, enabled: item.enabled, cost: item.cost }));
  return <><PageIntro eyebrow="Trading Companion · Product 03" title="Guarded Autopilot" description="Configure automated-market scope and hard risk limits separately from the manual Approval Desk."/>{isDemo ? <TradingCompanionConsole products={products} isDemo view="autopilot"/> : <LiveAutopilotConsole/>}</>;
}

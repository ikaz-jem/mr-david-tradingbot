import { workspaceActor } from "@/lib/workspace-access";
import { getPlatformConfig } from "@/lib/platform-config";
import { AdminPlatformControls } from "@/components/admin-platform-controls";
import { PageIntro, SectionHeader } from "@/components/dashboard-ui";
export const dynamic = "force-dynamic";
export default async function MarketControlsPage() { const actor = await workspaceActor(); const config = await getPlatformConfig(Boolean(actor?.isDemo)); return <><PageIntro eyebrow="Platform controls / research" title="Research markets" description="Control the market universe offered to Research Scanner, Approval Desk, and Autopilot."/><section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Supported spot pairs" detail="Binance market-data universe"/><AdminPlatformControls config={config} demo={Boolean(actor?.isDemo)} view="markets"/></section></>; }

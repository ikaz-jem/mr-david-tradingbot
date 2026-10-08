import { workspaceActor } from "@/lib/workspace-access";
import { getPlatformConfig } from "@/lib/platform-config";
import { getEnabledStrategies } from "@/lib/strategy-catalog";
import { scanIntervals, scanSymbols } from "@/lib/scan-markets";
import { ApprovalScanPoolControls } from "@/components/approval-scan-pool-controls";
import { PageIntro } from "@/components/dashboard-ui";
import { ApprovalScannerStatus } from "@/components/approval-scanner-status";

export const dynamic = "force-dynamic";

export default async function ApprovalScannerControlsPage() {
  const actor = await workspaceActor();
  const isDemo = Boolean(actor?.isDemo);
  const [config, strategies] = await Promise.all([getPlatformConfig(isDemo), getEnabledStrategies(isDemo, "approval-desk")]);
  return <><PageIntro eyebrow="Platform controls / AI efficiency" title="Approval scan pool" description="Bound production discovery costs with an approved market, timeframe, and strategy universe. User preferences stay personalized inside these limits."/>{!isDemo && <ApprovalScannerStatus/>}<ApprovalScanPoolControls config={config} symbols={scanSymbols.filter(symbol => config.allowedScanSymbols.includes(symbol))} intervals={scanIntervals} strategies={strategies.map(item => ({ slug: item.slug, name: item.name, description: item.description, experimental: item.experimental }))} demo={isDemo}/></>;
}

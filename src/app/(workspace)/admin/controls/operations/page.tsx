import { workspaceActor } from "@/lib/workspace-access";
import { getPlatformConfig } from "@/lib/platform-config";
import { OperationsControlCenter } from "@/components/operations-control-center";
import { PageIntro } from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";
export default async function OperationsControlsPage() {
  const actor = await workspaceActor();
  const config = await getPlatformConfig(Boolean(actor?.isDemo));
  return <><PageIntro eyebrow="Platform controls / operations" title="Service availability" description="Control maintenance mode, pause individual platform capabilities, and write the exact customer-facing message shown for each condition."/><OperationsControlCenter config={config} demo={Boolean(actor?.isDemo)}/></>;
}

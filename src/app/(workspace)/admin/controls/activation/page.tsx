import { workspaceActor } from "@/lib/workspace-access";
import { getPlatformConfig } from "@/lib/platform-config";
import { AdminActivationConfig } from "@/components/admin-activation-config";
import { PageIntro, SectionHeader } from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";
export default async function ActivationControlsPage() {
  const actor = await workspaceActor();
  const config = await getPlatformConfig(Boolean(actor?.isDemo));
  return <><PageIntro eyebrow="Platform controls / commerce" title="Activation & platform credits" description="Configure permanent account activation and the refill products customers can purchase after consuming their shared balance."/><section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Activation and refill catalog" detail="Pricing changes appear across the app"/><AdminActivationConfig config={config} demo={Boolean(actor?.isDemo)}/></section></>;
}

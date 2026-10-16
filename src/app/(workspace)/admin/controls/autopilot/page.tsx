import { workspaceActor } from "@/lib/workspace-access";
import { notFound } from "next/navigation";
import { PageIntro } from "@/components/dashboard-ui";
import { AutopilotOperations } from "@/components/autopilot-operations";

export const dynamic = "force-dynamic";

export default async function AutopilotControlsPage() {
  const actor = await workspaceActor();
  if (!actor?.can("settings:read")) notFound();
  return <><PageIntro eyebrow="Platform controls / automated execution" title="Autopilot operations" description="Monitor armed profiles, the scheduled worker, policy outcomes, execution attention states, and every launch interlock."/><AutopilotOperations/></>;
}

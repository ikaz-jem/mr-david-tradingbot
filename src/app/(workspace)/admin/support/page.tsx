import { PageIntro } from "@/components/dashboard-ui";
import { SupportInbox } from "@/components/support-inbox";
import { notFound } from "next/navigation";
import { workspaceActor } from "@/lib/workspace-access";
export default async function SupportPage() {
  const actor = await workspaceActor();
  if (!actor?.can("support:read")) notFound();
  return <><PageIntro eyebrow="Operations" title="Support inbox" description="Triage customer requests, assign ownership, and resolve issues. Internal notes never appear in the customer inbox."/><SupportInbox staff canUpdate={actor.can("support:update")}/></>;
}


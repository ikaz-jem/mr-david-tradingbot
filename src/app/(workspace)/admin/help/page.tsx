import { notFound } from "next/navigation";
import { workspaceActor } from "@/lib/workspace-access";
import { PageIntro } from "@/components/dashboard-ui";
import { HelpCenterEditor } from "@/components/help-center-editor";
export default async function AdminHelpPage() {
  const actor = await workspaceActor();
  if (!actor || actor.organizationKind !== "platform" || !actor.can("help:read")) notFound();
  return <><PageIntro eyebrow="Content operations" title="Help Center" description="Write, review, publish, and maintain customer guidance. Drafts stay private until published."/><HelpCenterEditor permissions={actor.permissions}/></>;
}

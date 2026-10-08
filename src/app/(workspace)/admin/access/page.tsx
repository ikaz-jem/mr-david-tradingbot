import { notFound } from "next/navigation";
import { PageIntro } from "@/components/dashboard-ui";
import { AccessControlConsole } from "@/components/access-control-console";
import { workspaceActor } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const actor = await workspaceActor();
  if (!actor?.can("access:read")) notFound();
  return <><PageIntro eyebrow="Identity & authorization" title="Access & permissions" description="Manage staff, inherited roles, granular permissions, direct overrides, and immutable security events. Every decision is tenant-scoped and enforced server-side."/><AccessControlConsole/></>;
}

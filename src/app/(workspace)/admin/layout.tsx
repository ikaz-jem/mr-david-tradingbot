import { notFound } from "next/navigation";
import { workspaceActor } from "@/lib/workspace-access";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await workspaceActor();
  const operationalAccess = actor?.superAdmin || actor?.permissions.some(permission => permission !== "products:use" && permission !== "support:create");
  if (!actor || actor.organizationKind !== "platform" || !operationalAccess) notFound();
  return children;
}

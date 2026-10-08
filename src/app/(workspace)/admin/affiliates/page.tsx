import { AffiliateDashboard } from "@/components/affiliate-dashboard";
import { workspaceActor } from "@/lib/workspace-access";
export default async function AdminAffiliatesPage() {
  const actor = await workspaceActor();
  if (!actor?.can("affiliates:read")) return <p role="alert">Affiliate reporting permission required.</p>;
  return <AffiliateDashboard admin/>;
}

import { notFound } from "next/navigation";
import { workspaceActor } from "@/lib/workspace-access";
import { PageIntro } from "@/components/dashboard-ui";
import { StrategyCatalogEditor } from "@/components/strategy-catalog-editor";

export default async function StrategiesPage() {
  const actor = await workspaceActor();
  if (!actor?.can("strategies:read")) notFound();
  return <><PageIntro eyebrow="Research governance" title="Strategy catalog" description="Publish approved, versioned strategy definitions across Research Scanner, Approval Desk, and Autopilot. AI Router can choose only from eligible published methods."/><StrategyCatalogEditor/></>;
}

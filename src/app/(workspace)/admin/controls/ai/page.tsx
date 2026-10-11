import { workspaceActor } from "@/lib/workspace-access";
import { getServiceConfigStatus } from "@/lib/service-config";
import { AdminServiceConfig } from "@/components/admin-service-config";
import { PageIntro, SectionHeader } from "@/components/dashboard-ui";
export const dynamic = "force-dynamic";
export default async function AiControlsPage() { const actor = await workspaceActor(); const status = await getServiceConfigStatus(Boolean(actor?.isDemo)); return <><PageIntro eyebrow="Platform controls / AI" title="AI provider" description="Manage one encrypted provider credential and assign independent Responses-compatible models to each AI product."/><section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="OpenAI configuration" detail="Central credential · product-specific models"/><AdminServiceConfig initial={status} demo={Boolean(actor?.isDemo)} category="ai"/></section></>; }

import { workspaceActor } from "@/lib/workspace-access";
import { getServiceConfigStatus } from "@/lib/service-config";
import { AdminServiceConfig } from "@/components/admin-service-config";
import { PageIntro, SectionHeader } from "@/components/dashboard-ui";
export const dynamic = "force-dynamic";
export default async function EmailControlsPage() { const actor = await workspaceActor(); const status = await getServiceConfigStatus(Boolean(actor?.isDemo)); return <><PageIntro eyebrow="Platform controls / email" title="Email provider" description="Manage encrypted Resend credentials, verified sender identity, support routing, and webhook verification."/><section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Resend configuration" detail="Transactional email provider"/><AdminServiceConfig initial={status} demo={Boolean(actor?.isDemo)} category="email"/></section></>; }

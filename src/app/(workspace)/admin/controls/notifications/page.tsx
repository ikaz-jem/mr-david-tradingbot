import { workspaceActor } from "@/lib/workspace-access";
import { AdminNotificationComposer } from "@/components/admin-notification-composer";
import { PageIntro, SectionHeader } from "@/components/dashboard-ui";
export const dynamic = "force-dynamic";
export default async function NotificationControlsPage() { const actor = await workspaceActor(); return <><PageIntro eyebrow="Platform controls / communication" title="Direct notifications" description="Send a targeted in-app notice to a customer account with a required audit reason."/><section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Compose notification" detail="Targeted and audited"/><AdminNotificationComposer demo={Boolean(actor?.isDemo)}/></section></>; }

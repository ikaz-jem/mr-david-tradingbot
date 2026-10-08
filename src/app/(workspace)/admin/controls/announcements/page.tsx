import { workspaceActor } from "@/lib/workspace-access";
import { getPlatformConfig } from "@/lib/platform-config";
import { AdminPlatformControls } from "@/components/admin-platform-controls";
import { PageIntro, SectionHeader } from "@/components/dashboard-ui";
export const dynamic = "force-dynamic";
export default async function AnnouncementControlsPage() { const actor = await workspaceActor(); const config = await getPlatformConfig(Boolean(actor?.isDemo)); return <><PageIntro eyebrow="Platform controls / communication" title="Workspace announcement" description="Publish a concise platform-wide message for every signed-in customer workspace."/><section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Announcement banner" detail="Publish or clear"/><AdminPlatformControls config={config} demo={Boolean(actor?.isDemo)} view="announcement"/></section></>; }

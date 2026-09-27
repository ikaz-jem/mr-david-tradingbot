import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platform-config";
import { User } from "@/models/User";
import { AdminPlatformControls } from "@/components/admin-platform-controls";
import { PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { AdminNotificationComposer } from "@/components/admin-notification-composer";
import { AdminServiceConfig } from "@/components/admin-service-config";
import { getServiceConfigStatus } from "@/lib/service-config";

export const dynamic = "force-dynamic";

export default async function AdminControlsPage() {
  const session = await getServerSession(authOptions);
  await connectDB();
  const actor = session?.user.id ? await User.findById(session.user.id).select("role status").lean() : null;
  if (!actor || actor.role !== "admin" || actor.status !== "active") notFound();
  const config = await getPlatformConfig();
  const serviceStatus = await getServiceConfigStatus();
  return <><PageIntro eyebrow="Operations / controls" title="Platform configuration" description="Manage operational gates, research pairs, AI and email integrations, and customer communication. Changes are audited and take effect on the next request."/>
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Operational settings" detail="Every write requires an audit reason"/><AdminPlatformControls config={config}/></section>
    <section className="surface mt-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="AI and email integrations" detail="Encrypted credentials and provider settings"/><AdminServiceConfig initial={serviceStatus}/></section>
    <section className="surface mt-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Customer communication" detail="Send a targeted, audited in-app notification"/><AdminNotificationComposer/></section>
    <p className="mt-5 text-xs leading-6 text-muted">These controls do not cancel work already in flight or change historical data. MongoDB, authentication, payment approval, and exchange-order permissions remain deployment-level settings.</p>
  </>;
}

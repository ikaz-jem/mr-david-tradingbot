import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platform-config";
import { User } from "@/models/User";
import { AdminPlatformControls } from "@/components/admin-platform-controls";
import { PageIntro, SectionHeader } from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";

export default async function AdminControlsPage() {
  const session = await getServerSession(authOptions);
  await connectDB();
  const actor = session?.user.id ? await User.findById(session.user.id).select("role status").lean() : null;
  if (!actor || actor.role !== "admin" || actor.status !== "active") notFound();
  const config = await getPlatformConfig();
  return <><PageIntro eyebrow="Operations / controls" title="Platform controls" description="Pause intake or research, and publish a workspace notice. Every change requires a reason and leaves an audit event."/>
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Live gates" detail="Changes take effect on the next request"/><AdminPlatformControls config={config}/></section>
    <p className="mt-5 text-xs leading-6 text-muted">These switches do not cancel an in-flight scan or alter historical data. Live exchange execution and paid billing are not enabled by these controls.</p>
  </>;
}

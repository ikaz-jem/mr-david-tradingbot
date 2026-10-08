import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getPlatformConfig } from "@/lib/platform-config";
import { Notification } from "@/models/Notification";
import { resolveEffectivePermissions } from "@/lib/access-control";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await connectDB();
  const user = await User.findById(session.user.id).select("name role status isDemo settings").lean();
  if (!user || user.status !== "active") redirect("/login");
  const config = await getPlatformConfig(Boolean(user.isDemo));
  const [unreadNotifications, access] = await Promise.all([Notification.countDocuments({ userId: user._id, readAt: null }), resolveEffectivePermissions(session.user.id)]);
  const preferenceClasses = `${user.settings?.compactMode ? " workspace-compact" : ""}${user.settings?.reducedMotion ? " workspace-reduced-motion" : ""}`;
  return <div className={`workspace-experience${preferenceClasses}`}><WorkspaceShell name={user.name} role={user.role} permissions={access?.permissions ?? []} isDemo={user.isDemo} unreadNotifications={unreadNotifications}>{config.maintenanceMode && <div role="alert" className="mb-5 rounded-xl border border-[#a96855] bg-[#2b1712] px-4 py-3 text-sm font-semibold text-[#ffc0ae]"><b>Maintenance mode:</b> {config.maintenanceMessage}{user.role !== "user" && <span className="ml-1 text-[#efc16f]">Operator controls remain available.</span>}</div>}{config.announcement && <div className="mb-5 rounded-xl border border-[#8c7244] bg-[#3b2b16] px-4 py-3 text-sm font-semibold text-[#ffe0a6]">Platform notice: {config.announcement}</div>}{children}</WorkspaceShell></div>;
}

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getPlatformConfig } from "@/lib/platform-config";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await connectDB();
  const user = await User.findById(session.user.id).select("name role status isDemo").lean();
  if (!user || user.status !== "active") redirect("/login");
  const config = await getPlatformConfig();
  return <WorkspaceShell name={user.name} role={user.role} isDemo={user.isDemo}>{config.announcement && <div className="mb-5 rounded-xl border border-[#8c7244] bg-[#3b2b16] px-4 py-3 text-sm font-semibold text-[#ffe0a6]">Platform notice: {config.announcement}</div>}{children}</WorkspaceShell>;
}

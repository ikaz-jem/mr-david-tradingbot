import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { WorkspaceShell } from "@/components/workspace-shell";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await connectDB();
  const user = await User.findById(session.user.id).select("name role status isDemo").lean();
  if (!user || user.status !== "active") redirect("/login");
  return <WorkspaceShell name={user.name} role={user.role} isDemo={user.isDemo}>{children}</WorkspaceShell>;
}

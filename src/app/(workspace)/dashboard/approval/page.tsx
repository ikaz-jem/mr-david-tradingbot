import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { ApprovalDeskConsole } from "@/components/approval-desk-console";

export const dynamic = "force-dynamic";

export default async function ApprovalDeskPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await connectDB();
  return <ApprovalDeskConsole isDemo={Boolean(session.user.isDemo)}/>;
}

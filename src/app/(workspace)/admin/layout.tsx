import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) notFound();
  await connectDB();
  const user = await User.findById(session.user.id).select("role status").lean();
  if (!user || user.status !== "active" || !["staff", "admin"].includes(user.role)) notFound();
  return children;
}

import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

// Recheck the current database role and status for each mutation.
export async function workspaceActor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  await connectDB();
  const user = await User.findOne({ _id: session.user.id, status: "active" }).select("name role isDemo email").lean();
  if (!user) return null;
  return { id: String(user._id), name: user.name, role: user.role, isDemo: Boolean(user.isDemo) };
}


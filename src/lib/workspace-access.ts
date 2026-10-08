import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveEffectivePermissions } from "@/lib/access-control";

// Recheck the current database role and status for each mutation.
export async function workspaceActor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return resolveEffectivePermissions(session.user.id);
}


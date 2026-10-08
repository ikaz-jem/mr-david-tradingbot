import { notFound } from "next/navigation";
import { workspaceActor } from "@/lib/workspace-access";

export default async function PlatformControlsLayout({ children }: { children: React.ReactNode }) {
  const actor = await workspaceActor();
  if (!actor?.can("settings:read")) notFound();
  return children;
}

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { demoLoginEnabled } from "@/lib/demo-policy";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.mustChangePassword) redirect("/dashboard/settings?password=required");
  if (session?.user?.role === "admin" || session?.user?.role === "staff") redirect("/admin");
  if (session?.user) redirect("/dashboard");
  return <LoginForm demoEnabled={demoLoginEnabled()} />;
}

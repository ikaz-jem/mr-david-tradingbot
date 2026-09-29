import { getServerSession } from "next-auth";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { PageIntro } from "@/components/dashboard-ui";
import { AccountSettingsForms } from "@/components/account-settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  await connectDB();
  const user = await User.findById(session!.user.id).select("name email isDemo role mustChangePassword").lean();
  if (!user) return null;

  return <>
    <PageIntro eyebrow="Account" title="Settings" description="Keep your account information current and control how you access the workspace." />
    <AccountSettingsForms name={user.name} email={user.email} isDemo={user.isDemo} mustChangePassword={user.mustChangePassword} />
    <section className="surface mt-5 rounded-[20px] p-6">
      <ShieldCheck className="size-5 text-accent" />
      <h2 className="mt-4 text-xl font-bold">Connected exchanges</h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">Manage and verify your read-only Binance Spot connection. Never paste API keys into messages or support requests.</p>
      <Link href="/dashboard/exchanges" className="button-primary mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs">Manage exchanges <ArrowUpRight className="size-4" /></Link>
    </section>
  </>;
}

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { PageIntro } from "@/components/dashboard-ui";
import { AccountSettingsForms } from "@/components/account-settings-forms";
import { scanSymbols } from "@/lib/scan-markets";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await connectDB();
  const [user, connectionCount] = await Promise.all([
    User.findById(session.user.id).select("name email countryCode isDemo role mustChangePassword settings createdAt lastPasswordChangedAt").lean(),
    ExchangeConnection.countDocuments({ userId: session.user.id }),
  ]);
  if (!user) return null;
  const defaultSymbol = scanSymbols.find(symbol => symbol === user.settings?.defaultSymbol) ?? "BTCUSDT";

  return <>
    <PageIntro eyebrow="Account" title="Settings" description="Keep your account information current and control how you access the workspace." />
    <AccountSettingsForms name={user.name} email={user.email} country={user.countryCode ?? ""} role={user.role} isDemo={user.isDemo} mustChangePassword={user.mustChangePassword} createdAt={user.createdAt.toISOString()} lastPasswordChangedAt={user.lastPasswordChangedAt?.toISOString() ?? null} connectionCount={connectionCount} settings={{
      timezone: user.settings?.timezone ?? "UTC", locale: "en", defaultSymbol, defaultInterval: user.settings?.defaultInterval ?? "4h", riskProfile: user.settings?.riskProfile ?? "balanced", compactMode: user.settings?.compactMode ?? false, reducedMotion: user.settings?.reducedMotion ?? false,
      inAppResearch: user.settings?.inAppResearch ?? true, inAppBilling: user.settings?.inAppBilling ?? true, inAppExchange: user.settings?.inAppExchange ?? true, emailResearch: user.settings?.emailResearch ?? true, emailBilling: user.settings?.emailBilling ?? true, emailSecurity: true,
    }} />
    <section className="surface mt-5 rounded-[20px] p-6">
      <ShieldCheck className="size-5 text-accent" />
      <h2 className="mt-4 text-xl font-bold">Connected exchanges</h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">Manage and verify your read-only Binance Spot connection. Never paste API keys into messages or support requests.</p>
      <Link href="/dashboard/exchanges" className="button-primary mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs">Manage exchanges <ArrowUpRight className="size-4" /></Link>
    </section>
  </>;
}

import { getServerSession } from "next-auth";
import { Activity, Coins, Radar, TrendingUp } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getAccountCreditState } from "@/lib/credits";
import { Signal } from "@/models/Signal";
import { Order } from "@/models/Order";
import { OverviewMarket } from "@/components/overview-market";
import { EmptyState, PageIntro, SectionHeader, StatCard } from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const id = session.user.id;
  await connectDB();
  const [creditState, signals, orders] = await Promise.all([
    getAccountCreditState(id), Signal.countDocuments({ userId: id }), Order.countDocuments({ userId: id }),
  ]);
  const name = (session.user.name ?? "there").split(" ")[0];
  return <>
    <PageIntro eyebrow="Your workspace" title={`Good to see you, ${name}.`} description="Your research, market context, and exchange activity in one place." action={{ label: creditState.activated ? "Explore trade ideas" : "Activate account", href: creditState.activated ? "/dashboard/signals" : "/dashboard/credits" }}/>
    {!creditState.activated && <section className="surface mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-accent/40 p-5"><div><h2 className="font-bold">Activate your account to unlock platform products</h2><p className="mt-2 text-sm text-muted">Pay once, receive your starting credits, and refill only when you need more.</p></div><Link href="/dashboard/credits" className="button-primary rounded-xl px-5 py-3 text-sm font-bold">View activation →</Link></section>}
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Available credits" value={String(creditState.balance)} detail={creditState.activated ? "Shared across enabled products" : "Available after activation"} icon={Coins} accent/><StatCard label="Signals created" value={String(signals)} detail="Your research history" icon={Radar}/><StatCard label="App orders" value={String(orders)} detail="Exchange orders from this workspace" icon={Activity}/><StatCard label="Realized P&L" value="—" detail="Appears after exchange fills" icon={TrendingUp}/></div>
    <OverviewMarket activated={creditState.activated}/>
    <section className="mt-5 surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Recent research" detail="Your published setups and their status" href="/dashboard/signals"/>{signals ? <p className="text-sm text-muted">View your trade ideas to inspect the full research history.</p> : <EmptyState title="Your signal history starts here" text={creditState.activated ? "Completed analyses will appear with their thesis, risk conditions, and outcome." : "Activate the account once to receive your initial credits and unlock research."} action={{ label: creditState.activated ? "Open trade ideas" : "Activate account", href: creditState.activated ? "/dashboard/signals" : "/dashboard/credits" }}/>}</section>
  </>;
}

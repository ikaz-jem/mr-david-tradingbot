import { getServerSession } from "next-auth";
import { Activity, ArrowUpRight, Coins, Radar, TrendingUp } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getAccountCreditState } from "@/lib/credits";
import { getMarketHistory, getMarketSnapshot } from "@/lib/market";
import { Signal } from "@/models/Signal";
import { Order } from "@/models/Order";
import { MarketChart } from "@/components/market-chart";
import { EmptyState, PageIntro, SectionHeader, StatCard } from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const id = session.user.id;
  await connectDB();
  const demo = Boolean(session.user.isDemo);
  const demoMarkets = [{ symbol: "BTCUSDT", price: 64000, change: 2.1 }, { symbol: "ETHUSDT", price: 2800, change: -1.3 }, { symbol: "SOLUSDT", price: 145, change: 3.4 }];
  const demoHistory = Array.from({ length: 30 }, (_, index) => ({ time: "Day " + (index + 1), close: 60000 + index * 130 + Math.sin(index * .7) * 1800 }));
  const [creditState, signals, orders, markets, history] = await Promise.all([
    getAccountCreditState(id), Signal.countDocuments({ userId: id }), Order.countDocuments({ userId: id }),
    demo ? Promise.resolve(demoMarkets) : getMarketSnapshot(), demo ? Promise.resolve(demoHistory) : getMarketHistory(),
  ]);
  const name = (session.user.name ?? "there").split(" ")[0];
  return <>
    <PageIntro eyebrow="Your workspace" title={`Good to see you, ${name}.`} description="Your research, market context, and exchange activity in one place." action={{ label: creditState.activated ? "Explore trade ideas" : "Activate account", href: creditState.activated ? "/dashboard/signals" : "/dashboard/credits" }}/>
    {!creditState.activated && <section className="surface mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-accent/40 p-5"><div><h2 className="font-bold">Activate your account to unlock platform products</h2><p className="mt-2 text-sm text-muted">Pay once, receive your starting credits, and refill only when you need more.</p></div><Link href="/dashboard/credits" className="button-primary rounded-xl px-5 py-3 text-sm font-bold">View activation →</Link></section>}
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Available credits" value={String(creditState.balance)} detail={creditState.activated ? "Shared across enabled products" : "Available after activation"} icon={Coins} accent/><StatCard label="Signals created" value={String(signals)} detail="Your research history" icon={Radar}/><StatCard label="App orders" value={String(orders)} detail="Exchange orders from this workspace" icon={Activity}/><StatCard label="Realized P&L" value="—" detail="Appears after exchange fills" icon={TrendingUp}/></div>
    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]"><section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="BTC market overview" detail={demo ? "Synthetic demo prices · Not current market data" : "Public Binance Spot closing prices · Last 30 days"}/><MarketChart data={history}/></section><section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Market pulse" detail={demo ? "Synthetic demo snapshot" : "Public 24-hour Binance Spot market data"}/><div className="space-y-2">{markets.length ? markets.map(market => <div key={market.symbol} className="flex items-center justify-between rounded-xl border border-line bg-[#151f18] px-4 py-3"><div><div className="text-sm font-bold">{market.symbol.replace("USDT", "")} <span className="text-muted">/ USDT</span></div><div className="mt-1 text-xs text-muted">Spot market</div></div><div className="text-right"><div className="font-semibold number">${market.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div><div className={`mt-1 text-xs font-bold number ${market.change >= 0 ? "text-accent" : "text-[#ff8791]"}`}>{market.change >= 0 ? "+" : ""}{market.change.toFixed(2)}%</div></div></div>) : <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">Live market data is temporarily unavailable.</div>}</div><Link href={creditState.activated ? "/dashboard/signals" : "/dashboard/credits"} className="mt-5 flex items-center justify-between rounded-xl border border-[#557644] bg-[#c5ff4111] p-4 text-sm font-bold text-accent">{creditState.activated ? "Go to trade ideas" : "Activate platform access"} <ArrowUpRight className="size-4"/></Link></section></div>
    <section className="mt-5 surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Recent research" detail="Your published setups and their status" href="/dashboard/signals"/>{signals ? <p className="text-sm text-muted">View your trade ideas to inspect the full research history.</p> : <EmptyState title="Your signal history starts here" text={creditState.activated ? "Completed analyses will appear with their thesis, risk conditions, and outcome." : "Activate the account once to receive your initial credits and unlock research."} action={{ label: creditState.activated ? "Open trade ideas" : "Activate account", href: creditState.activated ? "/dashboard/signals" : "/dashboard/credits" }}/>}</section>
  </>;
}

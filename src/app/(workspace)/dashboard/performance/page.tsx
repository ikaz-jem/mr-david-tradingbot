import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { BarChart3, CircleGauge, ChartNoAxesCombined } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { PaperOutcome } from "@/models/PaperOutcome";
import { Signal } from "@/models/Signal";
import { PaperOutcomeRefresh } from "@/components/paper-outcome-refresh";
import { EmptyState, PageIntro, SectionHeader, StatCard } from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const session = await getServerSession(authOptions);
  await connectDB();
  const [published, outcomes, [stats]] = await Promise.all([
    Signal.countDocuments({ userId: session!.user.id }),
    PaperOutcome.find({ userId: session!.user.id }).sort({ updatedAt: -1 }).limit(20).lean(),
    PaperOutcome.aggregate<{ count: number; wins: number; average: number }>([
      { $match: { userId: new mongoose.Types.ObjectId(session!.user.id), status: "closed", netReturnPct: { $type: "number" } } },
      { $group: { _id: null, count: { $sum: 1 }, wins: { $sum: { $cond: [{ $gt: ["$netReturnPct", 0] }, 1, 0] } }, average: { $avg: "$netReturnPct" } } },
    ]),
  ]);
  const signals = await Signal.find({ _id: { $in: outcomes.map(item => item.signalId) }, userId: session!.user.id }).select("symbol").lean();
  const byId = new Map(signals.map(signal => [signal._id.toString(), signal]));
  return <>
    <PageIntro eyebrow="Your results" title="Performance" description="Forward paper outcomes and actual exchange fills are kept separate. This page does not imply live trading returns."/>
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Published ideas" value={String(published)} detail="Every qualifying setup" icon={CircleGauge}/>
      <StatCard label="Paper exits" value={String(stats?.count ?? 0)} detail="Closed simulations only" icon={ChartNoAxesCombined}/>
      <StatCard label="Paper win rate" value={stats?.count ? `${(stats.wins / stats.count * 100).toFixed(1)}%` : "—"} detail="Of closed simulations" icon={BarChart3}/>
      <StatCard label="Avg net paper return" value={stats ? `${stats.average >= 0 ? "+" : ""}${stats.average.toFixed(2)}%` : "—"} detail="After assumed costs" icon={ChartNoAxesCombined} accent/>
    </div>
    <section className="surface rounded-[20px] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><SectionHeader title="Forward paper scorecard" detail="Published signals only · 1-minute Spot candles"/><PaperOutcomeRefresh/></div>
      <p className="mb-5 max-w-3xl text-xs leading-5 text-muted">Paper method: observe only full candles after publication; enter at the published level if crossed; assume the adverse stop when a candle touches both boundaries; 0.10% fee and 0.05% slippage per side. Unfilled setups expire. This is simulated research, not an account statement or actual P&L.</p>
      {outcomes.length ? <div className="divide-y divide-line">{outcomes.map(outcome => {
        const signal = byId.get(outcome.signalId.toString());
        const netReturn = typeof outcome.netReturnPct === "number" ? outcome.netReturnPct : null;
        return <div key={String(outcome._id)} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><div className="text-sm font-bold">{signal?.symbol.replace("USDT", "/USDT") ?? "Spot idea"} <span className="ml-2 font-normal capitalize text-muted">{outcome.status}</span></div><div className="mt-1 text-xs text-muted">{outcome.reason === "none" ? "Awaiting observation" : outcome.reason.replace("_", " ")} · Checked {new Date(outcome.checkedAt).toLocaleString()}</div></div><div className={`font-semibold number ${netReturn === null ? "text-muted" : netReturn >= 0 ? "text-accent" : "text-[#ff939b]"}`}>{netReturn === null ? "—" : `${netReturn >= 0 ? "+" : ""}${netReturn.toFixed(2)}%`}</div></div>;
      })}</div> : <EmptyState icon={ChartNoAxesCombined} title="No paper outcomes yet" text="After a signal is published, refresh this scorecard to track its hypothetical outcome from later market candles."/>}
    </section>
    <section className="surface mt-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Actual exchange P&L" detail="Only exchange-confirmed fills belong here"/><EmptyState icon={BarChart3} title="No live trade history" text="One-click execution is not enabled yet. Actual net P&L will be calculated from confirmed fills and fees, never from these paper results."/></section>
  </>;
}

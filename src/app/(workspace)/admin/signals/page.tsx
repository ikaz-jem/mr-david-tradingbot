import { Radar } from "lucide-react";
import { connectDB } from "@/lib/db";
import { PaperOutcome } from "@/models/PaperOutcome";
import { ScanRun } from "@/models/ScanRun";
import { Signal } from "@/models/Signal";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { AdminSignalModeration } from "@/components/admin-signal-moderation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export default async function AdminSignalsPage() {
  const session = await getServerSession(authOptions);
  await connectDB();
  const actor = session?.user.id ? await User.findById(session.user.id).select("role isDemo").lean() : null;
  const [published, completed, failed, noSetup, paperClosed, recent, latestSignals] = await Promise.all([
    Signal.countDocuments(), ScanRun.countDocuments({ status: "completed" }), ScanRun.countDocuments({ status: "failed" }),
    ScanRun.countDocuments({ status: "completed", outcome: "no_setup" }), PaperOutcome.countDocuments({ status: "closed" }),
    ScanRun.find().sort({ createdAt: -1 }).limit(20).select("symbol status outcome summary createdAt").lean(),
    Signal.find().sort({ createdAt: -1 }).limit(20).select("userId symbol status side entry stop target moderationReason createdAt").lean(),
  ]);
  const demoOwnerIds = actor?.isDemo ? new Set((await User.find({ _id: { $in: latestSignals.map(signal => signal.userId) }, isDemo: true }).select("_id").lean()).map(user => String(user._id))) : null;
  return <><PageIntro eyebrow="Operations / research" title="Signal health" description="Monitor scan throughput, published setups, failed jobs, and paper-result coverage."/>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Completed scans" value={completed}/><Metric label="Published ideas" value={published}/><Metric label="No setup" value={noSetup}/><Metric label="Failed scans" value={failed}/><Metric label="Paper exits" value={paperClosed}/></div>
    <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Published signal review" detail="Latest 20 ideas · invalidation preserves history"/>{latestSignals.length ? <div className="divide-y divide-line">{latestSignals.map(signal => <div key={String(signal._id)} className="flex flex-wrap items-center justify-between gap-4 py-4 text-sm"><div><div className="font-bold">{signal.symbol.replace("USDT", "/USDT")} <span className="ml-2 text-xs font-normal capitalize text-muted">{signal.side} · {signal.status}</span></div><div className="mt-1 text-xs text-muted">Entry {signal.entry} · Stop {signal.stop} · Target {signal.target} · {new Date(signal.createdAt).toLocaleString()}</div>{signal.moderationReason && <div className="mt-1 text-xs text-[#f6b795]">Invalidated: {signal.moderationReason}</div>}</div>{actor?.role === "admin" && ["watch", "triggered"].includes(signal.status) && (!demoOwnerIds || demoOwnerIds.has(String(signal.userId))) && <AdminSignalModeration signalId={String(signal._id)}/>}</div>)}</div> : <EmptyState icon={Radar} title="No published signals yet" text="Signals will appear here when a scan qualifies."/>}</section>
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Recent scan activity" detail="Latest 20 jobs · no user-identifying data"/>{recent.length ? <div className="divide-y divide-line">{recent.map(run => <div key={String(run._id)} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><div><div className="font-bold">{run.symbol.replace("USDT", "/USDT")} <span className="ml-2 font-normal capitalize text-muted">{run.status}</span></div><div className="mt-1 text-xs text-muted">{run.summary || "Analysis in progress"}</div></div><div className="text-xs text-muted">{new Date(run.createdAt).toLocaleString()}</div></div>)}</div> : <EmptyState icon={Radar} title="No scan jobs yet" text="Completed, failed, and no-setup scans will appear here as people use the research desk."/>}</section>
    <p className="mt-5 text-xs leading-6 text-muted">This is operational activity, not evidence of trading returns. Paper exits are simulations and actual exchange fills are not yet enabled.</p>
  </>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="surface rounded-[18px] p-5"><div className="text-xs font-semibold text-muted">{label}</div><div className="mt-5 text-3xl font-semibold number">{value}</div></div>; }

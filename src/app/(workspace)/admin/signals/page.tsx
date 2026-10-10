import { Radar } from "lucide-react";
import { connectDB } from "@/lib/db";
import { PaperOutcome } from "@/models/PaperOutcome";
import { ScanRun } from "@/models/ScanRun";
import { Signal } from "@/models/Signal";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { AdminSignalModeration } from "@/components/admin-signal-moderation";
import { User } from "@/models/User";
import { notFound } from "next/navigation";
import { workspaceActor } from "@/lib/workspace-access";
import Link from "next/link";

export const dynamic = "force-dynamic";
const statuses = ["all", "watch", "triggered", "invalidated", "expired", "closed"] as const;

export default async function AdminSignalsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await connectDB();
  const actor = await workspaceActor();
  if (!actor?.can("signals:read")) notFound();
  const demoUserIds = await User.distinct("_id", { isDemo: true });
  const scope = actor.isDemo ? { userId: { $in: demoUserIds } } : { userId: { $nin: demoUserIds } };
  const params = await searchParams;
  const status = statuses.includes(params.status as typeof statuses[number]) ? params.status as typeof statuses[number] : "all";
  const page = Math.min(1000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const signalFilter = { ...scope, ...(status === "all" ? {} : { status }) };
  const [published, completed, failed, noSetup, paperClosed, recent, signalTotal, latestSignals] = await Promise.all([
    Signal.countDocuments(scope), ScanRun.countDocuments({ ...scope, status: "completed" }), ScanRun.countDocuments({ ...scope, status: "failed" }),
    ScanRun.countDocuments({ ...scope, status: "completed", outcome: "no_setup" }), PaperOutcome.countDocuments({ ...scope, status: "closed" }),
    ScanRun.find(scope).sort({ createdAt: -1 }).limit(20).select("symbol status outcome summary createdAt").lean(),
    Signal.countDocuments(signalFilter),
    Signal.find(signalFilter).sort({ createdAt: -1 }).skip((page - 1) * 25).limit(25).select("userId symbol status side entry stop target moderationReason createdAt").lean(),
  ]);
  const demoOwnerIds = actor?.isDemo ? new Set((await User.find({ _id: { $in: latestSignals.map(signal => signal.userId) }, isDemo: true }).select("_id").lean()).map(user => String(user._id))) : null;
  return <><PageIntro eyebrow="Operations / research" title="Signal health" description="Monitor scan throughput, published setups, failed jobs, and paper-result coverage."/>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Completed scans" value={completed}/><Metric label="Published ideas" value={published}/><Metric label="No setup" value={noSetup}/><Metric label="Failed scans" value={failed}/><Metric label="Paper exits" value={paperClosed}/></div>
    <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><SectionHeader title="Published signal review" detail={`${signalTotal} matching ideas · page ${page} · invalidation preserves history`}/><form action="/admin/signals" className="flex gap-2"><label className="sr-only" htmlFor="signal-status">Signal status</label><select id="signal-status" name="status" defaultValue={status} className="rounded-lg border border-line bg-[#111a13] px-3 py-2 text-sm text-white">{statuses.map(item => <option key={item} value={item}>{item === "all" ? "All statuses" : item}</option>)}</select><button className="button-secondary rounded-lg px-4 py-2 text-xs font-bold">Filter</button></form></div>{latestSignals.length ? <div className="divide-y divide-line">{latestSignals.map(signal => <div key={String(signal._id)} className="flex flex-wrap items-center justify-between gap-4 py-4 text-sm"><div><div className="font-bold">{signal.symbol.replace("USDT", "/USDT")} <span className="ml-2 text-xs font-normal capitalize text-muted">{signal.side} · {signal.status}</span></div><div className="mt-1 text-xs text-muted">Entry {signal.entry} · Stop {signal.stop} · Target {signal.target} · {new Date(signal.createdAt).toLocaleString()}</div>{signal.moderationReason && <div className="mt-1 text-xs text-[#f6b795]">Invalidated: {signal.moderationReason}</div>}</div>{actor.can("signals:update") && ["watch", "triggered"].includes(signal.status) && (!demoOwnerIds || demoOwnerIds.has(String(signal.userId))) && <AdminSignalModeration signalId={String(signal._id)}/>}</div>)}</div> : <EmptyState icon={Radar} title="No matching signals" text="Try another status filter or wait for new qualifying research."/>}<div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs"><span className="text-muted">Showing {latestSignals.length} of {signalTotal}</span><div className="flex gap-2">{page > 1 && <Link href={`/admin/signals?status=${status}&page=${page - 1}`} className="button-secondary rounded-lg px-3 py-2 font-bold">Previous</Link>}{page * 25 < signalTotal && <Link href={`/admin/signals?status=${status}&page=${page + 1}`} className="button-secondary rounded-lg px-3 py-2 font-bold">Next</Link>}</div></div></section>
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Recent scan activity" detail="Latest 20 jobs · no user-identifying data"/>{recent.length ? <div className="divide-y divide-line">{recent.map(run => <div key={String(run._id)} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><div><div className="font-bold">{run.symbol.replace("USDT", "/USDT")} <span className="ml-2 font-normal capitalize text-muted">{run.status}</span></div><div className="mt-1 text-xs text-muted">{run.summary || "Analysis in progress"}</div></div><div className="text-xs text-muted">{new Date(run.createdAt).toLocaleString()}</div></div>)}</div> : <EmptyState icon={Radar} title="No scan jobs yet" text="Completed, failed, and no-setup scans will appear here as people use the research desk."/>}</section>
    <p className="mt-5 text-xs leading-6 text-muted">Research outcomes and paper exits are simulations, not evidence of trading returns. Live exchange execution records are monitored separately under Orders.</p>
  </>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="surface rounded-[18px] p-5"><div className="text-xs font-semibold text-muted">{label}</div><div className="mt-5 text-3xl font-semibold number">{value}</div></div>; }

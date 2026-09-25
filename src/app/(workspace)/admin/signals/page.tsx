import { Radar } from "lucide-react";
import { connectDB } from "@/lib/db";
import { PaperOutcome } from "@/models/PaperOutcome";
import { ScanRun } from "@/models/ScanRun";
import { Signal } from "@/models/Signal";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";

export default async function AdminSignalsPage() {
  await connectDB();
  const [published, completed, failed, noSetup, paperClosed, recent] = await Promise.all([
    Signal.countDocuments(), ScanRun.countDocuments({ status: "completed" }), ScanRun.countDocuments({ status: "failed" }),
    ScanRun.countDocuments({ status: "completed", outcome: "no_setup" }), PaperOutcome.countDocuments({ status: "closed" }),
    ScanRun.find().sort({ createdAt: -1 }).limit(20).select("symbol status outcome summary createdAt").lean(),
  ]);
  return <><PageIntro eyebrow="Operations / research" title="Signal health" description="Monitor scan throughput, published setups, failed jobs, and paper-result coverage."/>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Completed scans" value={completed}/><Metric label="Published ideas" value={published}/><Metric label="No setup" value={noSetup}/><Metric label="Failed scans" value={failed}/><Metric label="Paper exits" value={paperClosed}/></div>
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Recent scan activity" detail="Latest 20 jobs · no user-identifying data"/>{recent.length ? <div className="divide-y divide-line">{recent.map(run => <div key={String(run._id)} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><div><div className="font-bold">{run.symbol.replace("USDT", "/USDT")} <span className="ml-2 font-normal capitalize text-muted">{run.status}</span></div><div className="mt-1 text-xs text-muted">{run.summary || "Analysis in progress"}</div></div><div className="text-xs text-muted">{new Date(run.createdAt).toLocaleString()}</div></div>)}</div> : <EmptyState icon={Radar} title="No scan jobs yet" text="Completed, failed, and no-setup scans will appear here as people use the research desk."/>}</section>
    <p className="mt-5 text-xs leading-6 text-muted">This is operational activity, not evidence of trading returns. Paper exits are simulations and actual exchange fills are not yet enabled.</p>
  </>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="surface rounded-[18px] p-5"><div className="text-xs font-semibold text-muted">{label}</div><div className="mt-5 text-3xl font-semibold number">{value}</div></div>; }

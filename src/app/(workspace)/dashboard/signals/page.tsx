import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Activity, ArrowDownRight, ArrowUpRight, BrainCircuit, CalendarClock, CheckCircle2, CircleSlash2, Radar, ShieldAlert } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Signal } from "@/models/Signal";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { ScanLauncher } from "@/components/scan-launcher";
import { ScanRun } from "@/models/ScanRun";
import { getPlatformConfig } from "@/lib/platform-config";
import { getServiceConfig } from "@/lib/service-config";
import { seedDemoResearch } from "@/lib/demo-workspace";
import { getStrategyCatalog } from "@/lib/strategy-catalog";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await connectDB();
  const isDemo = Boolean(session.user.isDemo);
  const config = await getPlatformConfig(isDemo);
  if (isDemo) await seedDemoResearch(session.user.id, session.user.name ?? "Demo user");
  const service = await getServiceConfig(isDemo);
  const [signals, noSetups, strategies] = await Promise.all([
    Signal.find({ userId: session.user.id }).sort({ createdAt: -1 }).limit(30).lean(),
    ScanRun.find({ userId: session.user.id, status: "completed", outcome: "no_setup" }).sort({ createdAt: -1 }).limit(10).lean(),
    getStrategyCatalog(isDemo),
  ]);
  const strategyNames = new Map(strategies.map((item) => [item.slug, item.name]));
  for (const signal of signals) if (signal.status === "invalidated" && signal.moderationReason) signal.thesis = `Invalidated by operations: ${signal.moderationReason} · Original thesis: ${signal.thesis}`;

  return <>
    <PageIntro eyebrow="Research desk" title="Trade ideas" description="Turn validated closed-candle evidence into an explained decision. Qualified ideas retain their confidence, thesis, risk structure, and complete timing record."/>
    <ScanLauncher enabled={Boolean(!config.maintenanceMode && config.scansOpen && service.openaiApiKey && service.openaiModel)} unavailableReason={config.maintenanceMode ? config.maintenanceMessage : config.scansOpen ? "AI scanning is awaiting provider configuration." : config.scansPausedMessage}/>

    <section className="mb-6 grid gap-3 md:grid-cols-3">
      <ResearchPrinciple icon={BrainCircuit} number="01" title="Bounded intelligence" text="AI reasons over supplied candle evidence and must return a strict decision record."/>
      <ResearchPrinciple icon={ShieldAlert} number="02" title="Defined before publishing" text="Entry, stop, target, and eligibility remain controlled by deterministic rules."/>
      <ResearchPrinciple icon={Activity} number="03" title="Measured after publishing" text="Every idea keeps its data cutoff, expiry, confidence, and paper outcome."/>
    </section>

    <section className="surface overflow-hidden rounded-[24px]">
      <div className="border-b border-line px-5 pt-5 sm:px-7 sm:pt-7"><SectionHeader title="Published research" detail={`${signals.length} newest decision${signals.length === 1 ? "" : "s"} · newest first`}/></div>
      {signals.length ? <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">{signals.map((signal) => {
        const positive = signal.side === "buy";
        const confidence = signal.confidence ?? 0;
        return <article key={String(signal._id)} className={`relative overflow-hidden rounded-[20px] border p-5 shadow-[0_18px_50px_rgba(0,0,0,.16)] transition sm:p-6 ${positive ? "border-[#50703e] bg-[radial-gradient(circle_at_0%_0%,rgba(197,255,65,.09),transparent_34%),linear-gradient(145deg,#101d13,#0a120c)] hover:border-[#779b4d]" : "border-[#704246] bg-[radial-gradient(circle_at_0%_0%,rgba(255,101,114,.1),transparent_34%),linear-gradient(145deg,#211214,#100b0d)] hover:border-[#a95860]"}`}>
          <span className={`absolute inset-y-0 left-0 w-1 ${positive ? "bg-accent" : "bg-[#ff6572]"}`}/>
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className={`relative flex size-12 items-center justify-center rounded-xl border font-mono text-xl font-black ${positive ? "border-accent/35 bg-accent/10 text-accent" : "border-[#ff657250] bg-[#ff657212] text-[#ff939b]"}`}>{positive ? "L" : "S"}{positive ? <ArrowUpRight className="absolute -bottom-1 -right-1 size-4 rounded-full bg-[#0b140d] p-0.5"/> : <ArrowDownRight className="absolute -bottom-1 -right-1 size-4 rounded-full bg-[#150c0e] p-0.5"/>}</span><div><div className="flex items-center gap-2"><h3 className="text-lg font-black tracking-tight">{signal.symbol.replace("USDT", "/USDT")}</h3><span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${positive ? "border-accent/30 text-accent" : "border-[#ff657250] text-[#ff939b]"}`}>{positive ? "Long" : "Short"}</span></div><p className="mt-1 text-[9px] font-black uppercase tracking-[.15em] text-muted">{signal.interval} · {strategyNames.get(signal.strategySlug) ?? signal.strategySlug} · v{signal.strategyVersion}</p></div></div><div className="flex flex-wrap gap-2">{confidence > 0 && <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${positive ? "border-[#5d744b] bg-[#5d744b12] text-[#d7efad]" : "border-[#8b4d52] bg-[#8b4d5212] text-[#ffaaa9]"}`}>Decision confidence {confidence}/100</span>}<span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${positive ? "border-accent/30 bg-accent/[.06] text-accent" : "border-[#ff657245] bg-[#ff657210] text-[#ff939b]"}`}>{signal.status}</span></div></div>

          <div className="mt-5"><p className="text-[9px] font-black uppercase tracking-[.15em] text-accent">Decision thesis</p><p className="mt-2 text-sm leading-7 text-[#bfceba]">{signal.thesis}</p></div>
          <div className="mt-4 rounded-xl border border-[#49583b] bg-[#151c121f] px-4 py-3"><p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.13em] text-[#e1c982]"><ShieldAlert className="size-3.5"/> Risk and invalidation</p><p className="mt-2 text-xs leading-6 text-[#aebbab]">{signal.riskNote}</p></div>

          <div className="mt-4 grid grid-cols-3 gap-2"><PriceMetric label="Entry" value={signal.entry} tone="neutral"/><PriceMetric label="Stop" value={signal.stop} tone="risk"/><PriceMetric label="Target" value={signal.target} tone="reward"/></div>
          <div className="mt-4 grid gap-2 border-t border-[#2d412d] pt-4 text-[10px] text-muted sm:grid-cols-2"><span className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-accent"/> Data closed {new Date(signal.dataCutoff).toLocaleString()}</span><span className="flex items-center gap-2 sm:justify-end"><CalendarClock className="size-3.5 text-[#d9bd70]"/> Valid until {new Date(signal.expiresAt).toLocaleString()}</span></div>
        </article>;
      })}</div> : <div className="p-5 sm:p-7"><EmptyState icon={Radar} title="No qualified ideas yet" text="Run a research cycle. An idea is published only when both the market evidence and decision layer approve it."/></div>}
    </section>

    {noSetups.length > 0 && <section className="mt-6 overflow-hidden rounded-[24px] border border-[#75653e] bg-[linear-gradient(145deg,#1b1911,#0d120d)]"><div className="border-b border-[#5d5236] px-5 pt-5 sm:px-7 sm:pt-7"><SectionHeader title="Stay-out decisions" detail="No valid setup · capital preserved"/></div><div className="divide-y divide-[#51482f]">{noSetups.map((run) => <article key={String(run._id)} className="relative grid gap-3 px-5 py-5 transition hover:bg-[#dfb85c08] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-7"><span className="absolute inset-y-0 left-0 w-1 bg-[#dfb85c]"/><span className="relative flex size-11 items-center justify-center rounded-xl border border-[#dfb85c55] bg-[#dfb85c10] font-mono text-lg font-black text-[#e8c878]">—<CircleSlash2 className="absolute -bottom-1 -right-1 size-4 rounded-full bg-[#15140e] p-0.5"/></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black">{run.symbol.replace("USDT", "/USDT")}</h3><span className="rounded-full border border-[#dfb85c55] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#e8c878]">Stay out</span><span className="rounded-md border border-[#665a39] px-2 py-0.5 text-[9px] font-bold text-muted">{run.interval}</span><span className="rounded-md border border-[#665a39] px-2 py-0.5 text-[9px] font-bold text-muted">{strategyNames.get(run.strategySlug) ?? run.strategySlug} · v{run.strategyVersion}</span>{(run.aiConfidence ?? 0) > 0 && <span className="text-[9px] font-black uppercase tracking-wider text-[#e0c57f]">Stay-out confidence {run.aiConfidence}/100</span>}</div><p className="mt-2 text-xs leading-6 text-muted">{run.summary}</p></div><div className="text-left sm:text-right"><p className="text-[9px] font-black uppercase tracking-wider text-[#e8c878]">No trade</p><p className="mt-1 text-[10px] text-muted">{new Date(run.createdAt).toLocaleString()}</p></div></article>)}</div></section>}
  </>;
}

function ResearchPrinciple({ icon: Icon, number, title, text }: { icon: typeof BrainCircuit; number: string; title: string; text: string }) { return <article className="surface rounded-[18px] p-5"><div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl border border-[#48613e] bg-accent/[.055] text-accent"><Icon className="size-4"/></span><span className="text-[9px] font-black tracking-[.18em] text-[#6f816c]">{number}</span></div><h2 className="mt-5 text-sm font-black">{title}</h2><p className="mt-2 text-xs leading-6 text-muted">{text}</p></article>; }
function PriceMetric({ label, value, tone }: { label: string; value: number; tone: "neutral" | "risk" | "reward" }) { return <div className="rounded-xl border border-[#354a34] bg-black/15 px-3 py-3"><p className="text-[8px] font-black uppercase tracking-[.14em] text-muted">{label}</p><p className={`number mt-1 font-mono text-sm font-black ${tone === "risk" ? "text-[#ff9b96]" : tone === "reward" ? "text-accent" : "text-white"}`}>{value.toLocaleString(undefined, { maximumFractionDigits: 8 })}</p></div>; }

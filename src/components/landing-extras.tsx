import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, CircleCheck, Clock3, FileSearch, LockKeyhole, RotateCcw } from "lucide-react";
import { CryptoMark } from "@/components/crypto-mark";

export function LandingExtras() {
  return <>
    <section id="decision-file" className="decision-section border-t border-[#354a32]">
      <div className="mx-auto grid max-w-[1520px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:gap-20 lg:px-12 lg:py-28">
        <div>
          <p className="eyebrow">A closer look at the research</p>
          <h2 className="section-heading mt-4">Not another alert.<br/><span className="text-accent">A decision file.</span></h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-muted">Every completed scan leaves a readable record. You can see what was observed, why an idea passed or failed the filter, and what would invalidate it.</p>
          <div className="mt-9 space-y-5">
            <Reason icon={<FileSearch />} title="Evidence you can inspect" text="Source pair, timeframe, closed-candle cutoff, and calculated market structure." />
            <Reason icon={<LockKeyhole />} title="Boundaries before action" text="Reference levels, expiry, risk notes, and a clear no-setup outcome when conditions fail." />
            <Reason icon={<Clock3 />} title="One continuous history" text="The original thesis stays attached to later paper observation. No hindsight rewrite." />
          </div>
          <Link href="/register" className="mt-9 inline-flex items-center gap-2 border-b border-accent pb-1 text-sm font-bold text-accent">Create a free workspace <ArrowUpRight className="size-4"/></Link>
        </div>
        <div className="decision-frame relative rounded-[25px] border border-[#547143] p-3 sm:p-5">
          <div className="relative overflow-hidden rounded-[17px] border border-[#344b32] bg-[#0c150e]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#354b32] px-5 py-4 sm:px-7"><div className="flex items-center gap-3"><span className="coin-glyph coin-btc"><CryptoMark symbol="BTC" className="size-[18px]"/></span><div><p className="text-sm font-bold text-white">BTC / USDT</p><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#9ab091]">Decision file / anatomy</p></div></div><span className="rounded-full border border-[#749850] bg-[#c5ff4110] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">Illustrative layout</span></div>
            <div className="grid lg:grid-cols-[.48fr_.52fr]"><div className="border-b border-[#344b32] p-5 sm:p-7 lg:border-b-0 lg:border-r"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#9cb493]">The question</p><p className="mt-5 text-2xl font-bold leading-tight tracking-[-.04em]">Is there a setup worth reviewing?</p><p className="mt-5 text-sm leading-7 text-muted">The answer can be <strong className="text-white">no</strong>. An empty result is more useful than a forced trade.</p><div className="mt-10 flex items-center gap-2 border-t border-[#30452e] pt-5 text-xs font-semibold text-[#bad0ae]"><CircleCheck className="size-4 text-accent"/> Research record, not an order</div></div><div className="space-y-2 p-4 sm:p-5"><FileRow number="01" label="Market evidence" detail="Pair · timeframe · data cutoff"/><FileRow number="02" label="Filter verdict" detail="Qualified setup or no setup"/><FileRow number="03" label="Risk boundaries" detail="Levels · invalidation · expiry"/><FileRow number="04" label="AI rationale" detail="Explanation grounded in facts"/><FileRow number="05" label="Paper observation" detail="Tracked separately from real P&L"/></div></div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#344b32] bg-[#102012] px-5 py-3 text-[11px] text-[#a9c09f] sm:px-7"><span>Designed to be checked, not blindly followed.</span><span className="font-bold uppercase tracking-wider text-accent">You make the decision</span></div>
          </div>
        </div>
      </div>
    </section>

    <section className="credit-section border-y border-[#385031]">
      <div className="mx-auto max-w-[1520px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20"><div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="eyebrow">A low-friction first step</p><h2 className="section-heading mt-4">Five welcome scans.<br/><span className="text-accent">A clearer point of view.</span></h2><p className="mt-5 max-w-lg text-base leading-7 text-muted">Open a workspace, choose a supported Spot pair, and see how structured research feels before any paid membership is available.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/register" className="button-primary inline-flex min-h-12 items-center gap-3 rounded-xl px-6 text-sm">Start with 5 credits <ArrowRight className="size-4"/></Link><Link href="/pricing" className="inline-flex min-h-12 items-center gap-2 px-2 text-sm font-bold text-[#d7e6cf]">How credits work <ArrowUpRight className="size-4"/></Link></div><p className="mt-5 text-xs leading-5 text-[#94a98d]">Preview access. No paid checkout or live order placement today.</p></div><div className="grid gap-3 sm:grid-cols-3"><CreditCard icon={<Check/>} label="01 / Begin" title="Create an account" text="Five research credits are added to your workspace."/><CreditCard icon={<FileSearch/>} label="02 / Explore" title="Run a Spot scan" text="One completed scan uses one credit, even if the answer is no setup."/><CreditCard icon={<RotateCcw/>} label="03 / Stay clear" title="Keep the record" text="Inspect the decision file and forward paper outcome. Failed scans are refunded."/></div></div></div>
    </section>
  </>;
}

function Reason({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#506c3c] bg-[#c5ff4110] text-accent [&>svg]:size-5">{icon}</span><div><h3 className="text-sm font-bold text-white">{title}</h3><p className="mt-1 max-w-md text-sm leading-6 text-muted">{text}</p></div></div>; }
function FileRow({ number, label, detail }: { number: string; label: string; detail: string }) { return <div className="decision-row flex items-center gap-4 rounded-xl border border-[#344a31] bg-[#132016] px-4 py-3"><span className="font-mono text-xs font-bold text-accent">{number}</span><div><p className="text-xs font-bold text-white">{label}</p><p className="mt-0.5 text-[11px] text-[#9bb194]">{detail}</p></div><CircleCheck className="ml-auto size-4 shrink-0 text-[#90b460]"/></div>; }
function CreditCard({ icon, label, title, text }: { icon: React.ReactNode; label: string; title: string; text: string }) { return <div className="credit-card relative min-h-[250px] overflow-hidden rounded-2xl border border-[#415936] bg-[#101b12] p-6"><div className="credit-card-glow pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-accent/10 blur-3xl"/><span className="flex size-10 items-center justify-center rounded-full border border-[#759b44] bg-[#c5ff4118] text-accent [&>svg]:size-5">{icon}</span><p className="mt-8 text-[10px] font-black uppercase tracking-[.2em] text-accent">{label}</p><h3 className="mt-3 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{text}</p></div>; }

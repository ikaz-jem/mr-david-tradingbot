"use client";

import { useMemo, useState } from "react";
import { Check, CircleAlert, Gauge, LoaderCircle, Radar } from "lucide-react";

type Strategy = { slug: string; name: string; description: string; experimental: boolean };
type PoolConfig = {
  approvalScanSymbols: string[];
  approvalScanIntervals: string[];
  approvalScanStrategySlugs: string[];
  approvalScanMaxCombinations: number;
  approvalScanCadenceMinutes: number;
};

const cadenceOptions = [5, 10, 15, 30, 60];

export function ApprovalScanPoolControls({ config, symbols, intervals, strategies, demo = false }: { config: PoolConfig; symbols: readonly string[]; intervals: readonly string[]; strategies: Strategy[]; demo?: boolean }) {
  const [current, setCurrent] = useState(config);
  const [draft, setDraft] = useState(config);
  const [reason, setReason] = useState(demo ? "Interactive demo scan-pool configuration" : "");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const theoretical = draft.approvalScanSymbols.length * draft.approvalScanIntervals.length * draft.approvalScanStrategySlugs.length;
  const changedFields = useMemo(() => (Object.keys(draft) as (keyof PoolConfig)[]).filter(field => JSON.stringify(draft[field]) !== JSON.stringify(current[field])), [current, draft]);

  function toggle(field: "approvalScanSymbols" | "approvalScanIntervals" | "approvalScanStrategySlugs", value: string) {
    setDraft(previous => ({ ...previous, [field]: previous[field].includes(value) ? previous[field].filter(item => item !== value) : [...previous[field], value] }));
  }

  async function save() {
    if (reason.trim().length < 8) return setFeedback({ type: "error", text: "Enter an audit reason of at least 8 characters." });
    if (!draft.approvalScanSymbols.length || !draft.approvalScanIntervals.length || !draft.approvalScanStrategySlugs.length) return setFeedback({ type: "error", text: "Keep at least one pair, timeframe, and strategy in the production pool." });
    setPending(true); setFeedback(null);
    try {
      let latest = current;
      for (const field of changedFields) {
        const response = await fetch("/api/admin/controls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field, value: draft[field], reason }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? `Could not save ${field}.`);
        latest = result.config;
      }
      setCurrent({ approvalScanSymbols: latest.approvalScanSymbols, approvalScanIntervals: latest.approvalScanIntervals, approvalScanStrategySlugs: latest.approvalScanStrategySlugs, approvalScanMaxCombinations: latest.approvalScanMaxCombinations, approvalScanCadenceMinutes: latest.approvalScanCadenceMinutes });
      setDraft({ approvalScanSymbols: latest.approvalScanSymbols, approvalScanIntervals: latest.approvalScanIntervals, approvalScanStrategySlugs: latest.approvalScanStrategySlugs, approvalScanMaxCombinations: latest.approvalScanMaxCombinations, approvalScanCadenceMinutes: latest.approvalScanCadenceMinutes });
      setReason(demo ? "Interactive demo scan-pool configuration" : "");
      setFeedback({ type: "success", text: "Production scan pool saved. New user settings and scheduled runs now enforce it." });
    } catch (error) { setFeedback({ type: "error", text: error instanceof Error ? error.message : "The scan pool could not be saved." }); }
    finally { setPending(false); }
  }

  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Approved pairs" value={draft.approvalScanSymbols.length}/><Metric label="Timeframes" value={draft.approvalScanIntervals.length}/><Metric label="Strategies" value={draft.approvalScanStrategySlugs.length}/><Metric label="Maximum per run" value={draft.approvalScanMaxCombinations}/></section>
    <section className="rounded-[20px] border border-[#46623f] bg-[radial-gradient(circle_at_92%_0%,rgba(197,255,65,.08),transparent_34%),#111b13] p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent"><Radar className="size-5"/></span><div><h2 className="text-lg font-black">Shared discovery pool</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">User preferences can only select from this approved universe. Every scheduled run deduplicates identical combinations, ranks them by user demand, and analyzes at most the configured cap.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-line bg-black/15 p-4"><p className="text-[9px] font-black uppercase tracking-wider text-muted">Possible combinations</p><p className="mt-2 text-2xl font-black">{theoretical.toLocaleString()}</p><p className="mt-1 text-xs text-muted">Before demand deduplication and the per-run cap.</p></div><div className="rounded-xl border border-line bg-black/15 p-4"><p className="text-[9px] font-black uppercase tracking-wider text-muted">Effective upper bound</p><p className="mt-2 text-2xl font-black text-accent">{Math.min(theoretical, draft.approvalScanMaxCombinations).toLocaleString()}</p><p className="mt-1 text-xs text-muted">Unique AI evaluations per eligible candle cycle.</p></div></div></section>
    <PoolGroup title="Approved Binance Spot pairs" detail="Keep the production universe focused. Global Research Markets restrictions still apply." values={symbols} selected={draft.approvalScanSymbols} display={value => value.replace("USDT", "/USDT")} onToggle={value => toggle("approvalScanSymbols", value)}/>
    <PoolGroup title="Approved candle timeframes" detail="Cached candles are shared across every user requesting the same pair and timeframe." values={intervals} selected={draft.approvalScanIntervals} onToggle={value => toggle("approvalScanIntervals", value)}/>
    <section className="surface rounded-[20px] p-5 sm:p-6"><h2 className="text-base font-black">Approved Approval Desk strategies</h2><p className="mt-2 text-xs leading-5 text-muted">Only enabled strategies assigned to Approval Desk appear here. Manage the full strategy catalog separately.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{strategies.map(strategy => { const selected = draft.approvalScanStrategySlugs.includes(strategy.slug); return <button key={strategy.slug} type="button" onClick={() => toggle("approvalScanStrategySlugs", strategy.slug)} className={`rounded-xl border p-4 text-left transition ${selected ? "border-accent/40 bg-accent/[.07]" : "border-line bg-black/10 hover:border-[#536b4c]"}`}><div className="flex items-center justify-between gap-3"><span className="text-sm font-black">{strategy.name}</span><span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase ${selected ? "border-accent/30 text-accent" : "border-line text-muted"}`}>{selected ? "Approved" : "Excluded"}</span></div><p className="mt-2 text-xs leading-5 text-muted">{strategy.description}</p>{strategy.experimental && <p className="mt-2 text-[9px] font-black uppercase text-[#efc16f]">Experimental</p>}</button>; })}</div></section>
    <section className="surface rounded-[20px] p-5 sm:p-6"><div className="flex items-center gap-3"><Gauge className="size-5 text-accent"/><div><h2 className="text-base font-black">Cost and cadence guardrails</h2><p className="mt-1 text-xs text-muted">The external scheduler may call every five minutes; the engine skips runs that occur inside this cadence.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-[10px] font-black uppercase tracking-wider text-muted">Maximum unique combinations per run<input type="number" min="1" max="500" value={draft.approvalScanMaxCombinations} onChange={event => setDraft(previous => ({ ...previous, approvalScanMaxCombinations: Math.max(1, Math.min(500, Number(event.target.value))) }))} className="mt-2 h-11 w-full rounded-xl border border-line bg-[#0b150e] px-3 text-sm font-bold text-white"/></label><label className="text-[10px] font-black uppercase tracking-wider text-muted">Minimum scan cadence<select value={draft.approvalScanCadenceMinutes} onChange={event => setDraft(previous => ({ ...previous, approvalScanCadenceMinutes: Number(event.target.value) }))} className="mt-2 h-11 w-full rounded-xl border border-line bg-[#0b150e] px-3 text-sm font-bold text-white">{cadenceOptions.map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label></div></section>
    <section className="surface rounded-[20px] p-5 sm:p-6"><label className="text-sm font-black">Audit reason<input value={reason} onChange={event => setReason(event.target.value)} maxLength={300} placeholder="Why is the production scan pool changing?" className="mt-3 h-11 w-full rounded-xl border border-line bg-[#0b150e] px-3 text-sm font-normal text-white"/></label><div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={pending || reason.trim().length < 8 || !changedFields.length} onClick={() => void save()} className="button-primary flex items-center gap-2 rounded-xl px-5 py-3 text-xs disabled:opacity-40">{pending ? <LoaderCircle className="size-4 animate-spin"/> : <Check className="size-4"/>} Save production pool</button><span className="text-xs text-muted">{changedFields.length ? `${changedFields.length} control${changedFields.length === 1 ? "" : "s"} changed` : "No unsaved changes"}</span></div>{feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${feedback.type === "error" ? "border-[#7c4947] text-[#ffaaa2]" : "border-accent/25 text-[#d5efaa]"}`}>{feedback.type === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0"/> : <Check className="mt-0.5 size-4 shrink-0 text-accent"/>}{feedback.text}</p>}</section>
  </div>;
}

function PoolGroup({ title, detail, values, selected, display = value => value, onToggle }: { title: string; detail: string; values: readonly string[]; selected: string[]; display?: (value: string) => string; onToggle: (value: string) => void }) { return <section className="surface rounded-[20px] p-5 sm:p-6"><h2 className="text-base font-black">{title}</h2><p className="mt-2 text-xs text-muted">{detail}</p><div className="mt-4 flex flex-wrap gap-2">{values.map(value => <button key={value} type="button" onClick={() => onToggle(value)} className={`rounded-lg border px-3 py-2 text-[10px] font-black transition ${selected.includes(value) ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-muted hover:text-white"}`}>{display(value)}</button>)}</div></section>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="surface rounded-xl p-4"><p className="text-[9px] font-black uppercase tracking-wider text-muted">{label}</p><p className="mt-2 text-2xl font-black text-accent">{value.toLocaleString()}</p></div>; }

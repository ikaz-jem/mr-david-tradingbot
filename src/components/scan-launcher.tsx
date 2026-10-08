"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowDownRight, ArrowUpRight, BrainCircuit, Check, CircleAlert, CircleSlash2, Coins, Database, LoaderCircle, Radar, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scanSymbols, scanIntervals, type ScanInterval } from "@/lib/scan-markets";

type Symbol = (typeof scanSymbols)[number];
type StrategyOption = { slug: string; name: string; description: string; experimental: boolean };
type Result = { type: "success" | "error"; text: string; outcome?: "setup" | "no_setup"; side?: "buy" | "sell" | null; strategy?: string; routed?: boolean; confidence?: number; shared?: boolean };

export function ScanLauncher({ enabled, unavailableReason = "AI scanning is awaiting provider configuration." }: { enabled: boolean; isDemo?: boolean; unavailableReason?: string }) {
  const router = useRouter();
  const [symbol, setSymbol] = useState<Symbol>("BTCUSDT");
  const [interval, setInterval] = useState<ScanInterval>("4h");
  const [strategySlug, setStrategySlug] = useState("ai-router");
  const [strategies, setStrategies] = useState<StrategyOption[]>([]);
  const [allowed, setAllowed] = useState<Symbol[]>([]);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [operationsMessage, setOperationsMessage] = useState("");
  const [activated, setActivated] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [balance, setBalance] = useState(0);
  const [cost, setCost] = useState(1);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const requestId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/scans/options", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Research configuration is unavailable.");
      return response.json();
    }).then((data) => {
      if (!active) return;
      const symbols = scanSymbols.filter((pair) => data.symbols?.includes(pair));
      const preferredSymbol = scanSymbols.includes(data.defaults?.symbol) ? data.defaults.symbol as Symbol : "BTCUSDT";
      const preferredInterval = scanIntervals.includes(data.defaults?.interval) ? data.defaults.interval as ScanInterval : "4h";
      const availableStrategies = Array.isArray(data.strategies) ? data.strategies as StrategyOption[] : [];
      const preferredStrategy = availableStrategies.some(item => item.slug === data.defaults?.strategy) ? data.defaults.strategy : availableStrategies[0]?.slug ?? "ai-router";
      setAllowed(symbols);
      setStrategies(availableStrategies);
      setOperationsOpen(Boolean(data.scansOpen));
      setOperationsMessage(typeof data.operationsMessage === "string" ? data.operationsMessage : "");
      setActivated(Boolean(data.activated));
      setAiReady(Boolean(data.aiReady));
      setBalance(data.balance ?? 0);
      setCost(data.cost ?? 1);
      setSymbol(symbols.includes(preferredSymbol) ? preferredSymbol : symbols[0] ?? "BTCUSDT");
      setInterval(preferredInterval);
      setStrategySlug(preferredStrategy);
      if (!data.activated) setResult({ type: "error", text: "Activate your account from Credits & billing before running research." });
    }).catch((error) => { if (active) setResult({ type: "error", text: error instanceof Error ? error.message : "Research configuration is unavailable." }); }).finally(() => { if (active) setOptionsLoading(false); });
    return () => { active = false; };
  }, []);

  async function runScan() {
    setLoading(true);
    setResult(null);
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, interval, strategySlug, requestId: requestId.current }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The research run could not complete.");
      requestId.current = null;
      setBalance(data.balance ?? Math.max(0, balance - (data.cost ?? cost)));
      setResult({ type: "success", text: data.summary, outcome: data.outcome, side: data.side ?? null, strategy: data.strategy, routed: Boolean(data.routed), confidence: data.confidence ?? 0, shared: Boolean(data.sharedResult) });
      router.refresh();
    } catch (error) {
      requestId.current = null;
      setResult({ type: "error", text: error instanceof Error ? error.message : "The research run could not complete." });
    } finally { setLoading(false); }
  }

  const canScan = enabled && aiReady && activated && operationsOpen && allowed.length > 0 && balance >= cost;
  const selectedStrategy = strategies.find(item => item.slug === strategySlug);
  const disabledReason = optionsLoading ? "Loading research configuration…" : !aiReady ? "AI research is not configured. Ask an administrator to verify the provider connection." : !activated ? "Activate your account from Credits & billing before running research." : balance < cost ? `You need ${cost} credits to run this research cycle.` : !operationsOpen || !allowed.length ? operationsMessage || "Research scans are paused by operations." : unavailableReason;

  return <section className="mb-6 overflow-hidden rounded-[26px] border border-[#526d43] bg-[radial-gradient(circle_at_80%_0%,rgba(197,255,65,.13),transparent_30%),linear-gradient(145deg,#14251a,#09120c_62%)] shadow-[0_28px_90px_rgba(0,0,0,.25)]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#344a32] px-5 py-4 sm:px-7">
      <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent"><Radar className="size-5"/></span><div><p className="text-[9px] font-black uppercase tracking-[.2em] text-accent">Research scanner</p><p className="mt-1 text-sm font-bold">Closed-candle market intelligence</p></div></div>
      <div className="flex flex-wrap gap-2"><StatusPill icon={Database} label="Live candles" ready/><StatusPill icon={BrainCircuit} label="AI analysis" ready={aiReady}/><StatusPill icon={WalletCards} label={`${balance.toLocaleString()} credits`} ready={balance >= cost}/></div>
    </div>

    <div className="grid lg:grid-cols-[1.35fr_.65fr]">
      <div className="p-5 sm:p-7 lg:border-r lg:border-[#344a32]">
        <div className="max-w-2xl"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[#9eb395]"><Sparkles className="size-4 text-accent"/> Evidence in. Decision out.</div><h2 className="mt-3 text-2xl font-black tracking-[-.035em] sm:text-3xl">Find a qualified long or short setup.</h2><p className="mt-3 text-sm leading-7 text-[#aebda9]">Choose a market and timeframe. We validate completed Binance Spot candles, test both bullish breakouts and bearish breakdowns, and return either an explained directional idea or a clear no-setup decision.</p></div>

        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_1.35fr]">
          <label className="block rounded-2xl border border-[#385037] bg-black/15 p-4"><span className="text-[9px] font-black uppercase tracking-[.15em] text-muted">Market</span><select aria-label="Market" value={symbol} onChange={(event) => { setSymbol(event.target.value as Symbol); requestId.current = null; setResult(null); }} disabled={loading || !allowed.length} className="mt-2 h-11 w-full rounded-xl border border-[#40583d] bg-[#0b150e] px-3 text-sm font-black text-white outline-none transition focus:border-accent disabled:opacity-50">{allowed.map((pair) => <option key={pair} value={pair}>{pair.replace("USDT", " / USDT")}</option>)}</select><span className="mt-2 block text-[10px] text-muted">Binance public Spot data · USDT quote</span></label>
          <div className="rounded-2xl border border-[#385037] bg-black/15 p-4"><p className="text-[9px] font-black uppercase tracking-[.15em] text-muted">Candle timeframe</p><div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">{scanIntervals.map((value) => <button key={value} type="button" disabled={loading} onClick={() => { setInterval(value); requestId.current = null; setResult(null); }} className={`h-10 rounded-xl border text-xs font-black transition disabled:opacity-50 ${interval === value ? "border-accent bg-accent text-[#0a100b] shadow-[0_8px_24px_rgba(197,255,65,.12)]" : "border-[#3a5038] bg-[#0b150e] text-[#aebeaa] hover:border-[#648153] hover:text-white"}`}>{value}</button>)}</div><p className="mt-2 text-[10px] text-muted">The latest 100 fully closed candles are validated before analysis.</p></div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#385037] bg-black/15 p-4"><div className="grid gap-4 sm:grid-cols-[.75fr_1.25fr] sm:items-center"><label><span className="text-[9px] font-black uppercase tracking-[.15em] text-muted">Research strategy</span><select aria-label="Research strategy" value={strategySlug} onChange={(event) => { setStrategySlug(event.target.value); requestId.current = null; setResult(null); }} disabled={loading || !strategies.length} className="mt-2 h-11 w-full rounded-xl border border-[#40583d] bg-[#0b150e] px-3 text-sm font-black text-white outline-none transition focus:border-accent disabled:opacity-50">{strategies.map(item => <option key={item.slug} value={item.slug}>{item.name}{item.experimental ? " · Experimental" : ""}</option>)}</select></label><div className="rounded-xl border border-[#334732] bg-[#0b150e] px-4 py-3"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-black text-white">{selectedStrategy?.name ?? "Loading strategies…"}</p>{selectedStrategy?.experimental && <span className="rounded-full border border-[#987337] bg-[#98733716] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#efca85]">Experimental</span>}{strategySlug === "ai-router" && <span className="rounded-full border border-accent/30 bg-accent/[.06] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-accent">Default</span>}</div><p className="mt-1 text-[10px] leading-5 text-muted">{selectedStrategy?.description ?? "Approved strategy definitions are loading."}</p></div></div></div>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#46603f] bg-[#101d13] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[.15em] text-muted">Selected research cycle</p><p className="mt-1 text-sm font-black">{symbol.replace("USDT", "/USDT")} · {interval} · {selectedStrategy?.name ?? "Strategy"}</p><p className="mt-1 text-[10px] text-muted">One completed evaluation uses {cost} platform credit{cost === 1 ? "" : "s"}.</p></div><Button disabled={!canScan || loading || optionsLoading || !strategies.length} onClick={runScan} className="h-12 min-w-44 rounded-xl bg-accent px-6 font-black text-[#0b110c] shadow-[0_12px_32px_rgba(197,255,65,.15)] hover:bg-[#dcff88] disabled:opacity-40">{loading ? <LoaderCircle className="mr-2 size-4 animate-spin"/> : <Radar className="mr-2 size-4"/>}{loading ? "Analyzing market…" : `Run research · ${cost}`}</Button></div>

        {!canScan && !loading && <div className="mt-4 flex gap-3 rounded-xl border border-[#80643d] bg-[#80643d12] px-4 py-3 text-xs leading-5 text-[#e9cf98]"><CircleAlert className="mt-0.5 size-4 shrink-0"/><span>{disabledReason}</span></div>}
        {loading && <div role="status" aria-live="polite" className="mt-4 rounded-2xl border border-accent/25 bg-accent/[.045] p-4"><div className="flex items-center gap-3"><span className="relative flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent"><LoaderCircle className="size-5 animate-spin"/></span><div><p className="text-sm font-black">Research cycle in progress</p><p className="mt-1 text-xs text-muted">Validating candles, scoring market structure, and producing the decision record.</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><ProgressStep label="Market data"/><ProgressStep label="Risk structure"/><ProgressStep label="Decision analysis" active/></div></div>}
        {result && !loading && <ResearchDecisionResult result={result} cost={cost}/>} 
      </div>

      <aside className="bg-black/10 p-5 sm:p-7"><p className="text-[9px] font-black uppercase tracking-[.18em] text-accent">How the cycle works</p><div className="mt-5 space-y-5"><ResearchStep number="01" icon={Database} title="Observe" text="Fetch and validate the latest fully closed candles for the selected market."/><ResearchStep number="02" icon={Activity} title="Structure" text="Test bullish breakout and bearish breakdown structures with bounded risk levels."/><ResearchStep number="03" icon={BrainCircuit} title="Evaluate" text="Return a bounded long, short, or no-setup decision with confidence and rationale."/></div><div className="mt-6 rounded-2xl border border-[#3d543b] bg-[#0b150e] p-4"><p className="flex items-center gap-2 text-xs font-black"><ShieldCheck className="size-4 text-accent"/> Guardrails stay server-side</p><p className="mt-2 text-[11px] leading-5 text-muted">The analysis layer cannot override failed market filters or invent trade levels. This product publishes research only; short execution requires a supported Futures or margin connection.</p></div><div className="mt-3 flex items-center justify-between rounded-xl border border-[#354a34] px-4 py-3"><span className="flex items-center gap-2 text-xs text-muted"><Coins className="size-4"/> Available balance</span><span className="number text-sm font-black text-white">{balance.toLocaleString()}</span></div></aside>
    </div>
  </section>;
}

function ResearchDecisionResult({ result, cost }: { result: Result; cost: number }) {
  const isError = result.type === "error";
  const isLong = result.outcome === "setup" && result.side === "buy";
  const isShort = result.outcome === "setup" && result.side === "sell";
  const tone = isError ? "error" : isLong ? "long" : isShort ? "short" : "stay";
  const visual = {
    error: { label: "ERROR", letter: "!", border: "border-[#89504b]", background: "bg-[radial-gradient(circle_at_0%_0%,rgba(255,105,105,.12),transparent_36%),#111711]", accent: "bg-[#ff756d]", badge: "border-[#ff817955] bg-[#ff817912] text-[#ffaaa4]", icon: CircleAlert },
    long: { label: "LONG", letter: "L", border: "border-[#7ba83d]", background: "bg-[radial-gradient(circle_at_0%_0%,rgba(197,255,65,.15),transparent_38%),linear-gradient(145deg,#142719,#0b160e)]", accent: "bg-accent", badge: "border-accent/40 bg-accent/10 text-accent", icon: ArrowUpRight },
    short: { label: "SHORT", letter: "S", border: "border-[#9b4d53]", background: "bg-[radial-gradient(circle_at_0%_0%,rgba(255,92,105,.16),transparent_38%),linear-gradient(145deg,#271416,#150c0e)]", accent: "bg-[#ff6572]", badge: "border-[#ff657255] bg-[#ff657212] text-[#ff939b]", icon: ArrowDownRight },
    stay: { label: "STAY OUT", letter: "—", border: "border-[#8a7545]", background: "bg-[radial-gradient(circle_at_0%_0%,rgba(235,190,92,.13),transparent_38%),linear-gradient(145deg,#211d12,#12130e)]", accent: "bg-[#dfb85c]", badge: "border-[#dfb85c55] bg-[#dfb85c10] text-[#e8c878]", icon: CircleSlash2 },
  }[tone];
  const Icon = visual.icon;
  return <div role={isError ? "alert" : "status"} aria-live="polite" className={`relative mt-4 overflow-hidden rounded-2xl border p-4 sm:p-5 ${visual.border} ${visual.background}`}>
    <span className={`absolute inset-y-0 left-0 w-1 ${visual.accent}`}/>
    <div className={`grid gap-5 ${isError ? "" : "sm:grid-cols-[1fr_auto] sm:items-center"}`}>
      <div className="flex items-start gap-4">
        <span className={`relative flex size-14 shrink-0 items-center justify-center rounded-2xl border font-mono text-2xl font-black ${visual.badge}`}><span>{visual.letter}</span><Icon className="absolute -bottom-1 -right-1 size-5 rounded-full bg-[#0d150f] p-1"/></span>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-black tracking-[.16em] ${visual.badge}`}>{visual.label}</span>{result.shared && <span className="rounded-full border border-[#5e744c] bg-[#5e744c16] px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#cde4a8]">Shared 5-minute result</span>}</div><p className="mt-3 text-base font-black">{isError ? "Research could not complete" : isLong ? "Qualified long setup published" : isShort ? "Qualified short setup published" : "No valid setup · Capital stays protected"}</p>{result.strategy && <p className={`mt-1 text-[9px] font-black uppercase tracking-[.13em] ${isShort ? "text-[#ff939b]" : isLong ? "text-accent" : "text-[#e8c878]"}`}>{result.routed ? "AI routed to" : "Strategy"} · {result.strategy}</p>}<p className="mt-2 text-xs leading-6 text-[#b5c4b0]">{result.text}</p>{!isError && <><p className={`mt-3 text-[10px] font-black uppercase tracking-[.13em] ${isShort ? "text-[#ff939b]" : isLong ? "text-accent" : "text-[#e8c878]"}`}>Decision confidence · {cost} credit{cost === 1 ? "" : "s"} used</p><p className="mt-1 max-w-xl text-[10px] leading-5 text-muted">{result.outcome === "no_setup" ? "A high score means the evidence strongly supports staying out—not a high chance of a profitable trade." : "This score measures confidence in the published decision, not the probability of profit."}</p></>}</div>
      </div>
      {!isError && <DecisionConfidenceMeter value={result.confidence ?? 0} outcome={result.outcome} side={result.side}/>} 
    </div>
  </div>;
}

function StatusPill({ icon: Icon, label, ready }: { icon: typeof Database; label: string; ready: boolean }) { return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${ready ? "border-accent/30 bg-accent/[.06] text-accent" : "border-[#765043] bg-[#76504312] text-[#e7aa91]"}`}><Icon className="size-3"/><span className={`size-1.5 rounded-full ${ready ? "bg-accent" : "bg-[#e7aa91]"}`}/>{label}</span>; }
function ProgressStep({ label, active = false }: { label: string; active?: boolean }) { return <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-bold ${active ? "border-accent/30 text-accent" : "border-[#3b5039] text-[#9aaa96]"}`}>{active ? <LoaderCircle className="size-3 animate-spin"/> : <Check className="size-3 text-accent"/>}{label}</div>; }
function ResearchStep({ number, icon: Icon, title, text }: { number: string; icon: typeof Database; title: string; text: string }) { return <div className="grid grid-cols-[auto_1fr] gap-3"><span className="flex size-9 items-center justify-center rounded-xl border border-[#455d40] bg-[#122016] text-accent"><Icon className="size-4"/></span><div><p className="flex items-center gap-2 text-xs font-black"><span className="text-[9px] tracking-wider text-[#72816f]">{number}</span>{title}</p><p className="mt-1 text-[11px] leading-5 text-muted">{text}</p></div></div>; }
function DecisionConfidenceMeter({ value, outcome, side }: { value: number; outcome?: "setup" | "no_setup"; side?: "buy" | "sell" | null }) {
  const confidence = Math.min(100, Math.max(0, Math.round(value)));
  const isShort = outcome === "setup" && side === "sell";
  const isLong = outcome === "setup" && side === "buy";
  const gradientId = isShort ? "short-confidence-gradient" : isLong ? "long-confidence-gradient" : "stay-confidence-gradient";
  const start = isShort ? "#93434c" : isLong ? "#789d42" : "#8f7138";
  const end = isShort ? "#ff6572" : isLong ? "#c5ff41" : "#e3ba5c";
  const labelColor = isShort ? "text-[#ff939b]" : isLong ? "text-accent" : "text-[#e8c878]";
  return <div className={`mx-auto w-44 shrink-0 rounded-2xl border bg-black/20 px-3 pb-3 pt-2 text-center sm:mx-0 ${isShort ? "border-[#8f4b50]" : isLong ? "border-[#526d43]" : "border-[#826e43]"}`}>
    <svg viewBox="0 0 200 112" role="img" aria-label={`Decision confidence ${confidence} out of 100`} className="h-[88px] w-full overflow-visible">
      <path d="M 18 96 A 82 82 0 0 1 182 96" fill="none" stroke="#293a2a" strokeWidth="16" strokeLinecap="round" pathLength="100"/>
      <path d="M 18 96 A 82 82 0 0 1 182 96" fill="none" stroke={`url(#${gradientId})`} strokeWidth="16" strokeLinecap="round" pathLength="100" strokeDasharray={`${confidence} 100`} className="transition-all duration-700"/>
      <defs><linearGradient id={gradientId} x1="18" y1="96" x2="182" y2="96" gradientUnits="userSpaceOnUse"><stop stopColor={start}/><stop offset="1" stopColor={end}/></linearGradient></defs>
      <text x="100" y="83" textAnchor="middle" className="fill-white text-[30px] font-black">{confidence}</text>
      <text x="100" y="103" textAnchor="middle" className="fill-[#7f927b] text-[9px] font-bold uppercase tracking-[.15em]">out of 100</text>
    </svg>
    <p className={`text-[9px] font-black uppercase tracking-[.15em] ${labelColor}`}>{outcome === "no_setup" ? "Stay-out confidence" : `${side === "sell" ? "Short" : "Long"} confidence`}</p>
  </div>;
}

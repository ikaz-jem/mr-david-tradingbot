"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scanSymbols, scanIntervals, type ScanInterval } from "@/lib/scan-markets";
type Symbol = (typeof scanSymbols)[number];
export function ScanLauncher({ enabled, isDemo = false, unavailableReason = "AI scanning is awaiting provider configuration." }: { enabled: boolean; isDemo?: boolean; unavailableReason?: string }) {
  const router = useRouter();
  const [symbol, setSymbol] = useState<Symbol>("BTCUSDT");
  const [interval, setInterval] = useState<ScanInterval>("4h");
  const [allowed, setAllowed] = useState<Symbol[]>([]);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const [cost, setCost] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const requestId = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/scans/options", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Scan options unavailable");
      return response.json();
    }).then(result => {
      if (!active) return;
      const symbols = scanSymbols.filter(pair => result.symbols?.includes(pair));
      setAllowed(symbols); setOperationsOpen(Boolean(result.scansOpen)); setCost(result.cost ?? 1);
      setSymbol(current => symbols.includes(current) ? current : symbols[0] ?? "BTCUSDT");
    }).catch(() => { if (active) setMessage("Current pair availability could not be loaded. Refresh before scanning."); });
    return () => { active = false; };
  }, []);
  async function runScan() {
    setLoading(true); setMessage("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, interval, requestId: requestId.current }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Scan unavailable");
      requestId.current = null;
      setMessage(result.summary + " " + (result.cost ?? cost) + " credit(s) used.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Scan unavailable"); }
    finally { setLoading(false); }
  }
  const canScan = enabled && operationsOpen && allowed.length > 0;
  return <section className="surface mb-5 rounded-[20px] border-[#5a7c3c] bg-[#1a2a19] p-5 sm:p-6"><div className="mb-3 flex items-center gap-2 text-accent"><ScanSearch className="size-5"/><span className="text-xs font-bold uppercase tracking-widest">{isDemo ? "Simulated research" : "Live research"}</span></div><h2 className="text-xl font-bold">Scan Binance Spot</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{isDemo ? "Explore the workflow with synthetic prices and a sample thesis. No market data or AI provider is used." : "Select a pair and candle timeframe. Research uses closed candles only; a completed scan is charged even if no setup qualifies."} Cost: {cost} credit(s). Research is not an order or a return prediction.</p><div className="mt-5 flex flex-wrap items-end gap-3"><label className="text-xs text-muted">Market<select value={symbol} onChange={event => { setSymbol(event.target.value as Symbol); requestId.current = null; }} disabled={loading || !allowed.length} className="mt-2 block h-11 rounded-xl border border-line bg-[#111a13] px-4 text-sm text-white">{allowed.map(pair => <option key={pair} value={pair}>{pair.replace("USDT", "/USDT")}</option>)}</select></label><label className="text-xs text-muted">Candle timeframe<select value={interval} onChange={event => { setInterval(event.target.value as ScanInterval); requestId.current = null; }} disabled={loading} className="mt-2 block h-11 rounded-xl border border-line bg-[#111a13] px-4 text-sm text-white">{scanIntervals.map(value => <option key={value}>{value}</option>)}</select></label><Button disabled={!canScan || loading} onClick={runScan} className="h-11 rounded-xl bg-accent px-5 font-bold text-[#101810] hover:bg-[#dcff88] disabled:opacity-50">{loading ? <LoaderCircle className="mr-2 size-4 animate-spin"/> : <ScanSearch className="mr-2 size-4"/>}{loading ? "Scanning…" : isDemo ? "Run demo scan" : "Run scan"}</Button></div>{!canScan && <p className="mt-4 text-sm text-[#ffbd80]">{!operationsOpen || !allowed.length ? "Research scans are paused or options are loading." : unavailableReason}</p>}{message && <p role="status" className="mt-4 rounded-xl border border-line bg-[#111a13] px-4 py-3 text-sm text-white">{message}</p>}</section>;
}

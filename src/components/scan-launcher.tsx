"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scanSymbols } from "@/lib/scanner";

export function ScanLauncher({ enabled, unavailableReason = "AI scanning is awaiting provider configuration." }: { enabled: boolean; unavailableReason?: string }) {
  const router = useRouter();
  const [symbol, setSymbol] = useState<(typeof scanSymbols)[number]>("BTCUSDT");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  async function runScan() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, requestId: crypto.randomUUID() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Scan unavailable");
      setMessage(`${result.summary} One credit was used. ${result.outcome === "setup" ? "Your new research card is below." : "No signal was published."}`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Scan unavailable"); }
    finally { setLoading(false); }
  }
  return <section className="surface mb-5 rounded-[20px] border-[#5a7c3c] bg-[#1a2a19] p-5 sm:p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-3 flex items-center gap-2 text-accent"><ScanSearch className="size-5"/><span className="text-xs font-bold uppercase tracking-widest">Live research</span></div><h2 className="text-xl font-bold">Scan Binance Spot</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Analyzes closed 4-hour candles. A completed scan costs 1 credit, including when no setup passes the filters. Failed scans are refunded. Research is not an order or a return prediction.</p></div><div className="flex gap-2"><select aria-label="Spot trading pair" value={symbol} onChange={event => setSymbol(event.target.value as (typeof scanSymbols)[number])} className="rounded-xl border border-line bg-[#111a13] px-4 text-sm text-white">{scanSymbols.map(pair => <option key={pair} value={pair}>{pair.replace("USDT", "/USDT")}</option>)}</select><Button disabled={!enabled || loading} onClick={runScan} className="h-11 rounded-xl bg-accent px-5 font-bold text-[#101810] hover:bg-[#dcff88] disabled:opacity-50">{loading ? <LoaderCircle className="mr-2 size-4 animate-spin"/> : <ScanSearch className="mr-2 size-4"/>}{loading ? "Scanning…" : "Run scan"}</Button></div></div>{!enabled && <p className="mt-4 text-sm text-[#ffbd80]">{unavailableReason}</p>}{message && <p role="status" className="mt-4 rounded-xl border border-line bg-[#111a13] px-4 py-3 text-sm text-white">{message}</p>}</section>;
}

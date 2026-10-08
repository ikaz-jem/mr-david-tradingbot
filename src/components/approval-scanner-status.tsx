"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ScanOutcome = { symbol: string; interval: string; strategy: string; result: string };
type ScannerState = {
  demo: boolean;
  canRun: boolean;
  cronConfigured?: boolean;
  aiReady?: boolean;
  aiError?: string;
  productEnabled?: boolean;
  operationsOpen?: boolean;
  job: null | { status: string; completedAt: string | null; combinations: number; opportunitiesCreated: number; eligibleUsers: number; lastError: string; outcomes: ScanOutcome[] };
};

export function ApprovalScannerStatus() {
  const [data, setData] = useState<ScannerState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/approval-scanner", { cache: "no-store" });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? "Scanner status unavailable.");
    setData(value);
  }, []);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) void load().catch(error => setMessage(error.message)); };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);
  async function run() {
    setBusy(true); setMessage("Checking the shared scan pool…");
    try {
      const response = await fetch("/api/admin/approval-scanner", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Scan could not complete.");
      setMessage(result.alreadyRunning ? "A shared scan is already running." : result.skippedByCadence ? "The last scan is recent. Wait for the configured cadence before retrying." : `${result.combinations} combinations checked; ${result.opportunitiesCreated} new setups; ${result.failed ?? 0} failed. No user credits were charged.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Scan failed."); }
    finally { await load().catch(() => undefined); setBusy(false); }
  }
  return <section className="surface mb-5 space-y-4 rounded-[20px] p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-black">Discovery health</h2><p className="mt-2 text-sm text-muted">{data?.demo ? "Demo catalog — live discovery is managed by a live administrator." : `Latest run: ${data?.job?.status ?? "not started"}`}</p></div>{data?.canRun && <button onClick={() => void run()} disabled={busy || !data.productEnabled || !data.operationsOpen || !data.aiReady} className="button-primary rounded-xl px-5 py-3 text-sm disabled:opacity-40">{busy ? "Scanning…" : "Run shared scan"}</button>}</div>
    {data && !data.demo && <>
      <div className="grid gap-2 sm:grid-cols-3"><Health label="Product" ready={Boolean(data.productEnabled)}/><Health label="AI provider" ready={Boolean(data.aiReady)}/><Health label="Automatic schedule" ready={Boolean(data.cronConfigured)}/></div>
      <div className="flex flex-wrap gap-5 text-sm"><span>{data.job?.combinations ?? 0} combinations</span><span>{data.job?.opportunitiesCreated ?? 0} new setups</span><span>{data.job?.eligibleUsers ?? 0} eligible users</span><span>Last completion: {data.job?.completedAt ? new Date(data.job.completedAt).toLocaleString() : "Never"}</span></div>
      {!data.productEnabled && <p className="text-sm text-amber-300">Enable Approval Desk in <Link className="underline" href="/admin/products">Products</Link> before scanning.</p>}
      {!data.operationsOpen && <p className="text-sm text-amber-300">Discovery or research is paused in Operations.</p>}
      {!data.aiReady && <p className="text-sm text-amber-300">Save and verify a working credential under <Link className="underline" href="/admin/controls/ai">AI configuration</Link>. {data.aiError}</p>}
      {!data.cronConfigured && <p className="text-sm text-amber-300">Set a random CRON_SECRET of at least 16 characters in the production environment. The five-minute Vercel schedule is included in the project.</p>}
      {data.job?.lastError && <p role="alert" className="text-sm text-[#ffaaa2]">{data.job.lastError}</p>}
      {Boolean(data.job?.outcomes?.length) && <details><summary className="cursor-pointer text-sm text-accent">Latest scan results</summary><div className="mt-3 max-h-64 overflow-auto text-xs">{data.job!.outcomes.map((item, index) => <p key={`${item.symbol}:${item.interval}:${item.strategy}:${index}`} className="border-b border-line py-2">{item.symbol} · {item.interval} · {item.strategy} — {item.result.replaceAll("_", " ")}</p>)}</div></details>}
    </>}
    {message && <p role="status" className="rounded-xl border border-line p-3 text-sm">{message}</p>}
  </section>;
}

function Health({ label, ready }: { label: string; ready: boolean }) {
  return <div className={`rounded-xl border p-3 text-sm ${ready ? "border-accent/25 text-accent" : "border-[#765538] text-amber-300"}`}><span className={`mr-2 inline-block size-2 rounded-full ${ready ? "bg-accent" : "bg-amber-400"}`}/>{label}: {ready ? "Ready" : "Needs attention"}</div>;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { scanSymbols } from "@/lib/scan-markets";

type Config = {
  registrationOpen: boolean;
  scansOpen: boolean;
  exchangeConnectionsOpen: boolean;
  paperReconciliationOpen: boolean;
  contactIntakeOpen: boolean;
  allowedScanSymbols: string[];
  announcement: string;
};

const gates: { field: keyof Pick<Config, "registrationOpen" | "scansOpen" | "exchangeConnectionsOpen" | "paperReconciliationOpen" | "contactIntakeOpen">; title: string; detail: string }[] = [
  { field: "registrationOpen", title: "New registrations", detail: "Pause account creation without signing out existing users." },
  { field: "scansOpen", title: "AI research scans", detail: "Reject new research before data collection or credit use." },
  { field: "exchangeConnectionsOpen", title: "New exchange connections", detail: "Pause new Binance key submissions. Users can still disconnect existing keys." },
  { field: "paperReconciliationOpen", title: "Paper outcome refresh", detail: "Pause user-triggered market reconciliation while preserving results already recorded." },
  { field: "contactIntakeOpen", title: "Contact form intake", detail: "Stop new support-form submissions. Direct email remains available." },
];

const supportedPairs: readonly string[] = scanSymbols;

export function AdminPlatformControls({ config, demo = false }: { config: Config; demo?: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState(config);
  const [announcement, setAnnouncement] = useState(config.announcement);
  const [pairs, setPairs] = useState(config.allowedScanSymbols);
  const [reason, setReason] = useState(demo ? "Interactive demo configuration" : "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function change(field: keyof Config, value: boolean | string | string[]) {
    if (reason.trim().length < 8) { setMessage("Enter an audit reason of at least 8 characters before saving."); return; }
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/admin/controls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field, value, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Change failed.");
      setCurrent(result.config);
      setAnnouncement(result.config.announcement);
      setPairs(result.config.allowedScanSymbols);
      setMessage(result.unchanged ? "This setting was already current." : "Setting saved and recorded in the audit trail.");
      setReason(demo ? "Interactive demo configuration" : ""); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Change failed."); }
    finally { setPending(false); }
  }

  function togglePair(pair: string) {
    setPairs(previous => previous.includes(pair) ? previous.filter(item => item !== pair) : supportedPairs.filter(item => previous.includes(item) || item === pair));
  }

  const canSave = reason.trim().length >= 8 && !pending;
  const pairsChanged = JSON.stringify([...pairs].sort()) !== JSON.stringify([...current.allowedScanSymbols].sort());
  return <div className="space-y-5">
    <label className="block rounded-xl border border-[#597547] bg-[#c5ff410a] p-4 text-sm font-bold">Audit reason <span className="font-normal text-muted">· required for each change</span><input value={reason} onChange={event => setReason(event.target.value)} maxLength={300} placeholder="Describe why this operational setting is changing" className="mt-3 w-full rounded-lg border border-line bg-[#0e1510] px-3 py-2 text-sm font-normal text-white"/><span className="mt-2 block text-xs font-normal text-muted">{reason.trim().length < 8 ? "Enter at least 8 characters to enable the controls below." : "Ready to save one change."}</span></label>
    <div className="grid gap-3 xl:grid-cols-2">{gates.map(gate => <div key={gate.field} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-[#141e17] p-4"><div className="max-w-sm"><h3 className="text-sm font-bold">{gate.title}</h3><p className="mt-1 text-xs leading-5 text-muted">{gate.detail}</p></div><button type="button" disabled={!canSave} onClick={() => change(gate.field, !current[gate.field])} aria-label={`${gate.title}: ${current[gate.field] ? "enabled" : "paused"}. ${current[gate.field] ? "Pause" : "Resume"} this service.`} className={`min-w-28 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40 ${current[gate.field] ? "border-[#5c7c38] bg-[#c5ff4118] text-accent" : "border-[#9c644f] bg-[#ae694018] text-[#f6b795]"}`}>{current[gate.field] ? "Active · Pause" : "Paused · Resume"}</button></div>)}</div>
    <div className="rounded-xl border border-line bg-[#141e17] p-4"><h3 className="text-sm font-bold">Research pairs</h3><p className="mt-1 text-xs text-muted">Choose at least one of the supported Binance Spot pairs. Removed pairs disappear from the scan picker and are rejected server-side.</p><div className="mt-4 flex flex-wrap gap-3">{supportedPairs.map(pair => <label key={pair} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm"><input type="checkbox" checked={pairs.includes(pair)} onChange={() => togglePair(pair)} disabled={pending} className="accent-[#c5ff41]"/>{pair.replace("USDT", "/USDT")}</label>)}</div><button type="button" disabled={!canSave || !pairsChanged || !pairs.length} onClick={() => change("allowedScanSymbols", pairs)} className="button-secondary mt-4 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-40">Save research pairs</button>{pairs.length === 0 && <p className="mt-2 text-xs text-[#f6b795]">Keep at least one pair enabled; use the scan switch above to pause all research.</p>}</div>
    <div className="rounded-xl border border-line bg-[#141e17] p-4"><label htmlFor="platform-announcement" className="text-sm font-bold">Workspace announcement</label><p className="mt-1 text-xs text-muted">Shown to every signed-in user. Clearing it removes the notice.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input id="platform-announcement" maxLength={180} value={announcement} onChange={event => setAnnouncement(event.target.value)} placeholder="No announcement" className="min-w-0 flex-1 rounded-lg border border-line bg-[#0e1510] px-3 py-2 text-sm text-white"/><button type="button" disabled={!canSave || announcement === current.announcement} onClick={() => change("announcement", announcement)} className="button-secondary rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-40">Save message</button></div></div>
    {message && <p role="status" className="rounded-lg border border-line bg-[#0e1510] p-3 text-sm text-[#d5efaa]">{message}</p>}
  </div>;
}

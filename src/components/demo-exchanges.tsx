"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, PlugZap } from "lucide-react";
import { exchangeProviders } from "@/lib/exchange-catalog";
export function DemoExchanges() {
  const [connections, setConnections] = useState<{ provider: string; connectedAt: string }[]>([]);
  const [connectionOpen, setConnectionOpen] = useState(true);
  const [operationsMessage, setOperationsMessage] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/demo/exchanges").then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setConnections(data.connections); setConnectionOpen(data.connectionOpen); setOperationsMessage(data.operationsMessage); }).catch(e => setMessage(e.message)); }, []);
  async function change(provider: string, connected: boolean) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/demo/exchanges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, action: connected ? "disconnect" : "connect" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConnections(data.connections); setConnectionOpen(data.connectionOpen); setOperationsMessage(data.operationsMessage); setMessage("Demo connection updated. No credentials or exchange requests were used.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Connection update failed."); }
    finally { setBusy(false); }
  }
  return <>{!connectionOpen && <p role="alert" className="mb-5 rounded-xl border border-[#9b6652] bg-[#8a4f3518] p-4 text-sm leading-6 text-[#ffc0ae]"><b>New connections paused:</b> {operationsMessage} Existing connections can still be disconnected.</p>}<p className="mb-5 rounded-xl border border-accent/30 bg-accent/5 p-4 text-xs leading-6 text-muted"><ShieldCheck className="mr-2 inline size-4 text-accent"/>This showcase uses simulated connections and never accepts API credentials. Production accounts can connect every provider below with a live permission check, encrypted storage, balance refresh, credential replacement, and disconnect controls.</p>{message && <p role="status" aria-live="polite" className="mb-4 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 text-sm text-accent">{message}</p>}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{exchangeProviders.map(provider => { const connection = connections.find(item => item.provider === provider.id); return <article key={provider.id} className="surface group rounded-2xl p-6 transition hover:-translate-y-0.5 hover:border-accent/40"><div className="flex items-center justify-between"><span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-xs font-black" style={{ color: provider.color }}>{provider.mark}</span><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${connection ? "border-accent/40 bg-accent/10 text-accent" : "border-[#40533d] text-muted"}`}>{connection ? "Simulated connection" : "Not connected"}</span></div><h2 className="mt-5 text-xl font-bold">{provider.name} <span className="text-sm font-normal text-muted">{provider.accountLabel}</span></h2><p className="mt-2 min-h-12 text-sm leading-6 text-muted">{provider.description}</p><div className="mt-5 flex flex-wrap gap-4 text-xs text-muted"><span><ShieldCheck className="mr-1 inline size-4 text-accent"/>Read-only</span><span>One account</span><span>Withdrawals rejected</span></div>{connection && <p className="mt-3 text-xs text-muted">Added {new Date(connection.connectedAt).toLocaleDateString()}</p>}<button disabled={busy || (!connection && !connectionOpen)} onClick={() => void change(provider.id, Boolean(connection))} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-bold text-accent transition hover:bg-accent hover:text-[#071008] disabled:cursor-not-allowed disabled:opacity-40"><PlugZap className="size-4"/>{connection ? "Disconnect demo account" : connectionOpen ? "Preview connection" : "Connections paused"}</button></article>; })}</div></>;
}


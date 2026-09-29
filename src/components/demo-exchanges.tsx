"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, PlugZap } from "lucide-react";
const providers = [{ id: "binance", name: "Binance", mark: "B" }, { id: "coinbase", name: "Coinbase", mark: "C" }, { id: "kraken", name: "Kraken", mark: "K" }, { id: "okx", name: "OKX", mark: "OK" }];
export function DemoExchanges() {
  const [connections, setConnections] = useState<{ provider: string; connectedAt: string }[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/demo/exchanges").then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setConnections(data.connections); }).catch(e => setMessage(e.message)); }, []);
  async function change(provider: string, connected: boolean) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/demo/exchanges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, action: connected ? "disconnect" : "connect" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setConnections(data.connections); setMessage("Demo connection updated. No credentials or exchange requests were used.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Connection update failed."); }
    finally { setBusy(false); }
  }
  return <><p className="mb-5 rounded-xl border border-accent/30 p-4 text-xs leading-5 text-muted">Simulated multi-exchange workspace. Only Binance has a real read-only connector today; other providers below are interaction previews. No API credentials are accepted in this demo.</p>{message && <p role="status" className="mb-4 text-sm text-accent">{message}</p>}<div className="grid gap-4 md:grid-cols-2">{providers.map(provider => { const connection = connections.find(item => item.provider === provider.id); return <article key={provider.id} className="surface rounded-2xl p-6"><div className="flex items-center justify-between"><span className="flex size-12 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 font-black text-accent">{provider.mark}</span><span className="text-xs text-muted">{connection ? "Simulated connection" : "Not connected"}</span></div><h2 className="mt-5 text-xl font-bold">{provider.name} Spot</h2><p className="mt-2 text-sm text-muted">{provider.id === "binance" ? "Preview your connected account workflow." : "Planned integration · demo controls only."}</p><div className="mt-5 flex gap-4 text-xs text-muted"><span><ShieldCheck className="mr-1 inline size-4 text-accent"/>Read-only</span><span>Withdrawals unavailable</span></div>{connection && <p className="mt-3 text-xs text-muted">Added {new Date(connection.connectedAt).toLocaleDateString()}</p>}<button disabled={busy} onClick={() => void change(provider.id, Boolean(connection))} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-bold text-accent disabled:opacity-40"><PlugZap className="size-4"/>{connection ? "Disconnect demo account" : "Connect demo account"}</button></article>; })}</div></>;
}


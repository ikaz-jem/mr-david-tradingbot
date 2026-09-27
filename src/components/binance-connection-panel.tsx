"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, ExternalLink, Eye, EyeOff, KeyRound, RefreshCw, ShieldCheck, Unplug, Wallet } from "lucide-react";
import type { SpotBalance } from "@/lib/binance-spot";

type ConnectionView = {
  status: "connected" | "attention";
  keyLast4: string;
  ipRestricted: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
};

export function BinanceConnectionPanel({ initial, configured, demo }: { initial: ConnectionView | null; configured: boolean; demo: boolean }) {
  const [connection, setConnection] = useState(initial);
  const [replacing, setReplacing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [balances, setBalances] = useState<SpotBalance[] | null>(null);
  const [busy, setBusy] = useState<"connect" | "refresh" | "disconnect" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function syncStatus() {
    const response = await fetch("/api/exchange-connections/binance", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Connection status is unavailable.");
    setConnection(data.connection);
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage(""); setBusy("connect");
    try {
      const response = await fetch("/api/exchange-connections/binance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey, apiSecret }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Binance could not be connected.");
      setApiKey(""); setApiSecret(""); setShowSecret(false); setReplacing(false); setBalances(null);
      await syncStatus();
      setMessage("Binance Spot connected. You can now load your read-only balances.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Connection failed."); }
    finally { setBusy(null); }
  }

  async function refresh() {
    setError(""); setMessage(""); setBusy("refresh");
    try {
      const response = await fetch("/api/exchange-connections/binance/balances", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Balances could not be loaded.");
      setBalances(data.balances);
      setMessage(`Spot account checked at ${new Date(data.checkedAt).toLocaleString()}.`);
      await syncStatus();
    } catch (cause) { setBalances(null); setError(cause instanceof Error ? cause.message : "Balance check failed."); await syncStatus().catch(() => undefined); }
    finally { setBusy(null); }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Binance Spot and permanently remove the stored API key and secret from this workspace?")) return;
    setError(""); setMessage(""); setBusy("disconnect");
    try {
      const response = await fetch("/api/exchange-connections/binance", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Connection could not be removed.");
      setConnection(null); setBalances(null); setReplacing(false); setApiKey(""); setApiSecret("");
      setMessage("Binance Spot disconnected. Stored credentials were removed.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Disconnect failed."); }
    finally { setBusy(null); }
  }

  const canConnect = configured && !demo;
  return <div className="space-y-5">
    <section className="surface overflow-hidden rounded-[22px]"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#3e5637] bg-[#162719] px-5 py-5 sm:px-7"><div className="flex items-center gap-4"><span className="flex size-12 items-center justify-center rounded-2xl border border-[#617e44] bg-[#c5ff4117] text-accent"><Wallet className="size-6"/></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-accent">First exchange integration</p><h2 className="mt-1 text-xl font-bold">Binance Spot</h2></div></div><span className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${connection?.status === "connected" ? "border-[#83ab4f] bg-[#c5ff4117] text-accent" : connection ? "border-[#bd8e4f] bg-[#bd8e4f1a] text-[#f2cb92]" : "border-[#486044] text-[#b0c3a9]"}`}>{connection?.status === "connected" ? "Read-only connected" : connection ? "Needs attention" : "Not connected"}</span></div>
      <div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[.95fr_1.05fr]"><div><h3 className="text-lg font-bold">Your assets stay on Binance.</h3><p className="mt-3 text-sm leading-7 text-muted">Connect a dedicated read-only HMAC API key to inspect your Spot balances here. Enrivea cannot move funds or submit an order with this connection.</p><ul className="mt-6 space-y-3 text-sm text-[#d1e2c7]"><li className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-accent"/> Reading permission only</li><li className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-accent"/> No trading, withdrawal, or transfer scope</li><li className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-accent"/> Credentials encrypted before database storage</li></ul><div className="mt-7 rounded-xl border border-[#48633c] bg-[#c5ff410b] p-4 text-xs leading-6 text-[#bfd1b4]"><ShieldCheck className="mr-2 inline size-4 text-accent"/> Create a separate API key in Binance API Management. If you can restrict it to a stable server IP, do so; a standard Vercel deployment may not have fixed outbound IPs.</div><a className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-accent hover:underline" href="https://www.binance.com/en/my/settings/api-management" target="_blank" rel="noopener noreferrer">Open Binance API Management <ExternalLink className="size-4"/></a></div>
        <div className="rounded-[18px] border border-[#3d5437] bg-[#0b160d] p-5 sm:p-6">
          {demo && <Notice>Demo accounts are for interface preview only. Sign in with a verified non-demo account to connect Binance.</Notice>}
          {!configured && !demo && <Notice>Exchange encryption is not configured yet. The platform administrator must set EXCHANGE_ENCRYPTION_KEY before keys can be stored.</Notice>}
          {connection && !replacing ? <><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-[#c5ff4115] text-accent"><KeyRound className="size-5"/></span><div><p className="text-sm font-bold">Key ending ····{connection.keyLast4}</p><p className="mt-0.5 text-xs text-muted">Connected {new Date(connection.createdAt).toLocaleDateString()}</p></div></div><div className="mt-6 grid gap-3 rounded-xl border border-[#344b31] bg-[#122017] p-4 text-xs sm:grid-cols-2"><div><span className="text-muted">Access</span><p className="mt-1 font-bold text-white">Read-only Spot</p></div><div><span className="text-muted">IP allowlist</span><p className="mt-1 font-bold text-white">{connection.ipRestricted ? "Enabled on key" : "Not enabled"}</p></div><div className="sm:col-span-2"><span className="text-muted">Last checked</span><p className="mt-1 font-bold text-white">{connection.lastCheckedAt ? new Date(connection.lastCheckedAt).toLocaleString() : "Not yet"}</p></div></div>{connection.lastError && <p className="mt-4 text-xs leading-6 text-[#f2cb92]">{connection.lastError}</p>}<div className="mt-6 flex flex-wrap gap-2"><button type="button" disabled={busy !== null || demo} onClick={refresh} className="button-primary inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs disabled:opacity-50"><RefreshCw className="size-4"/>{busy === "refresh" ? "Checking…" : "Refresh balances"}</button><button type="button" disabled={busy !== null || !canConnect} onClick={() => setReplacing(true)} className="button-secondary rounded-xl px-4 py-3 text-xs font-bold disabled:opacity-50">Replace key</button><button type="button" disabled={busy !== null || demo} onClick={disconnect} className="inline-flex items-center gap-2 rounded-xl border border-[#78504a] px-4 py-3 text-xs font-bold text-[#f0b4ae] disabled:opacity-50"><Unplug className="size-4"/> Disconnect</button></div></> : <><h3 className="text-base font-bold">{replacing ? "Replace your read-only key" : "Connect with an API key"}</h3><p className="mt-2 text-xs leading-6 text-muted">We validate the key with Binance before storing it. Only HMAC keys are supported in this first release.</p><form onSubmit={connect} className="mt-6 space-y-4"><label className="block text-xs font-bold text-[#c8d9c1]">API key<input autoComplete="off" autoCapitalize="off" spellCheck={false} required disabled={!canConnect || busy !== null} minLength={20} maxLength={256} value={apiKey} onChange={event => setApiKey(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#42583d] bg-[#17231a] px-4 text-sm text-white outline-none focus:border-accent disabled:opacity-50"/></label><label className="block text-xs font-bold text-[#c8d9c1]">API secret<span className="relative mt-2 block"><input autoComplete="off" autoCapitalize="off" spellCheck={false} required disabled={!canConnect || busy !== null} type={showSecret ? "text" : "password"} minLength={20} maxLength={256} value={apiSecret} onChange={event => setApiSecret(event.target.value)} className="h-12 w-full rounded-xl border border-[#42583d] bg-[#17231a] px-4 pr-12 text-sm text-white outline-none focus:border-accent disabled:opacity-50"/><button type="button" onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-3 text-muted" aria-label={showSecret ? "Hide secret" : "Show secret"}>{showSecret ? <EyeOff className="size-5"/> : <Eye className="size-5"/>}</button></span></label><div className="flex flex-wrap gap-2"><button disabled={!canConnect || busy !== null} type="submit" className="button-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-xs disabled:opacity-50">{busy === "connect" ? "Verifying…" : replacing ? "Verify replacement" : "Verify and connect"}<ArrowRight className="size-4"/></button>{replacing && <button type="button" className="button-secondary rounded-xl px-4 text-xs" onClick={() => { setReplacing(false); setApiKey(""); setApiSecret(""); }}>Cancel</button>}</div></form></>}
        </div></div>
    </section>
    {(message || error) && <div role={error ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${error ? "border-[#8f5b4b] bg-[#8f5b4b19] text-[#ffd1bb]" : "border-[#587c3b] bg-[#c5ff410c] text-[#d8eccd]"}`}>{error ? <CircleAlert className="mt-0.5 size-4 shrink-0"/> : <Check className="mt-0.5 size-4 shrink-0 text-accent"/>}{error || message}</div>}
    {connection && <section className="surface rounded-[20px] p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Read-only account view</p><h2 className="mt-2 text-xl font-bold">Spot balances</h2><p className="mt-2 text-xs leading-6 text-muted">Balances are loaded on request and are not saved as a portfolio snapshot. No price conversion or P&amp;L is implied.</p></div><Link href="/dashboard/performance" className="text-xs font-bold text-accent hover:underline">Research performance →</Link></div>{balances === null ? <div className="mt-6 rounded-xl border border-dashed border-[#405a37] px-5 py-10 text-center text-sm text-muted">Select “Refresh balances” to load your current Spot holdings.</div> : balances.length ? <div className="app-scrollbar mt-6 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-muted"><tr><th className="px-4 py-3">Asset</th><th className="px-4 py-3 text-right">Available</th><th className="px-4 py-3 text-right">Locked</th></tr></thead><tbody className="divide-y divide-[#344a31]">{balances.map(balance => <tr key={balance.asset}><td className="px-4 py-3 font-bold">{balance.asset}</td><td className="px-4 py-3 text-right font-mono text-xs number">{balance.free}</td><td className="px-4 py-3 text-right font-mono text-xs number">{balance.locked}</td></tr>)}</tbody></table></div> : <div className="mt-6 rounded-xl border border-[#405a37] px-5 py-9 text-center text-sm text-muted">Binance returned no non-zero Spot balances for this key.</div>}</section>}
  </div>;
}

function Notice({ children }: { children: React.ReactNode }) { return <div className="mb-5 flex gap-2 rounded-xl border border-[#9b793d] bg-[#9b793d19] p-4 text-xs leading-6 text-[#f3dba8]"><CircleAlert className="mt-0.5 size-4 shrink-0"/>{children}</div>; }

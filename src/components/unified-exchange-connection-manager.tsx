"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Check, CircleAlert, ExternalLink, Eye, EyeOff, LoaderCircle, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { exchangeProviders, getExchangeProvider, type ExchangeProviderId } from "@/lib/exchange-catalog";
import type { ExchangeBalance } from "@/lib/exchange-adapters";
import type { ExchangeConnectionView } from "@/components/exchange-connection-manager";

type Market = "spot" | "futures";
type CredentialState = { apiKey: string; apiSecret: string; passphrase: string; keyVersion: string; futuresApiKey: string; futuresApiSecret: string };
const emptyCredentials = (): CredentialState => ({ apiKey: "", apiSecret: "", passphrase: "", keyVersion: "3", futuresApiKey: "", futuresApiSecret: "" });

export function UnifiedExchangeConnectionManager({ initial, configured, connectionOpen, operationsMessage }: { initial: ExchangeConnectionView[]; configured: boolean; connectionOpen: boolean; operationsMessage: string }) {
  const [connections, setConnections] = useState(initial);
  const [providerId, setProviderId] = useState<ExchangeProviderId>(initial[0]?.provider ?? "binance");
  const [credentials, setCredentials] = useState<CredentialState>(emptyCredentials);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [replacing, setReplacing] = useState(false);
  const [balanceMarket, setBalanceMarket] = useState<Market>("spot");
  const [balances, setBalances] = useState<ExchangeBalance[] | null>(null);
  const [busy, setBusy] = useState<"connect" | "refresh" | "disconnect" | null>(null);
  const [feedback, setFeedback] = useState<{ good: boolean; text: string } | null>(null);
  const provider = getExchangeProvider(providerId);
  const spot = connections.find(item => item.provider === providerId && item.market === "spot");
  const futures = connections.find(item => item.provider === providerId && item.market === "futures");
  const connected = Boolean(spot || futures);

  async function sync() {
    const results = await Promise.all((["spot", "futures"] as const).map(async market => {
      const response = await fetch(`/api/exchange-connections/${providerId}?market=${market}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Connection status could not be refreshed.");
      return body.connection ? { ...body.connection, createdAt: new Date(body.connection.createdAt).toISOString(), lastCheckedAt: body.connection.lastCheckedAt ? new Date(body.connection.lastCheckedAt).toISOString() : null } as ExchangeConnectionView : null;
    }));
    setConnections(current => [...current.filter(item => item.provider !== providerId), ...results.filter((item): item is ExchangeConnectionView => item !== null)]);
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("connect"); setFeedback(null);
    try {
      const response = await fetch(`/api/exchange-connections/${providerId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The exchange could not be connected.");
      await sync(); setCredentials(emptyCredentials()); setVisible({}); setReplacing(false); setBalances(null);
      setFeedback({ good: true, text: body.message ?? "Spot and Futures permissions verified." });
    } catch (error) { setFeedback({ good: false, text: error instanceof Error ? error.message : "Connection failed." }); }
    finally { setBusy(null); }
  }

  async function refresh() {
    setBusy("refresh"); setFeedback(null);
    try {
      const response = await fetch(`/api/exchange-connections/${providerId}/balances?market=${balanceMarket}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The exchange did not return balances.");
      setBalances(body.balances); await sync();
      setFeedback({ good: true, text: `${provider.name} ${balanceMarket} access verified.` });
    } catch (error) { setBalances(null); setFeedback({ good: false, text: error instanceof Error ? error.message : "Balance check failed." }); await sync().catch(() => undefined); }
    finally { setBusy(null); }
  }

  async function disconnect() {
    if (!window.confirm(`Disconnect ${provider.name} and remove its stored Spot and Futures credentials? Existing trades remain in your history.`)) return;
    setBusy("disconnect"); setFeedback(null);
    try {
      const response = await fetch(`/api/exchange-connections/${providerId}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The connection could not be removed.");
      setConnections(current => current.filter(item => item.provider !== providerId)); setBalances(null); setReplacing(false); setCredentials(emptyCredentials());
      setFeedback({ good: true, text: `${provider.name} disconnected. Stored credentials were removed.` });
    } catch (error) { setFeedback({ good: false, text: error instanceof Error ? error.message : "Disconnect failed." }); }
    finally { setBusy(null); }
  }

  function field(key: keyof CredentialState, label: string, secret = false, help?: string) {
    return <label key={key} className="block text-xs font-bold text-[#c8d9c1]">{label}<span className="relative mt-2 block"><input autoComplete="off" autoCapitalize="off" spellCheck={false} required type={secret && !visible[key] ? "password" : "text"} minLength={key === "keyVersion" ? 1 : 8} maxLength={key.endsWith("Secret") ? 4096 : 512} disabled={!configured || !connectionOpen || busy !== null} value={credentials[key]} onChange={event => setCredentials(current => ({ ...current, [key]: event.target.value }))} className="h-12 w-full rounded-xl border border-[#42583d] bg-[#0c170f] px-4 pr-11 text-sm text-white outline-none focus:border-accent disabled:opacity-50"/>{secret && <button type="button" onClick={() => setVisible(current => ({ ...current, [key]: !current[key] }))} className="absolute right-3 top-3 text-muted" aria-label={visible[key] ? `Hide ${label}` : `Show ${label}`}>{visible[key] ? <EyeOff className="size-5"/> : <Eye className="size-5"/>}</button>}</span>{help && <span className="mt-2 block text-[10px] font-normal leading-5 text-muted">{help}</span>}</label>;
  }

  return <div className="space-y-5">
    {!connectionOpen && <div role="alert" className="rounded-xl border border-[#9b6652] bg-[#8a4f3518] p-4 text-sm text-[#ffc0ae]">New connections paused: {operationsMessage}</div>}
    <section className="surface overflow-hidden rounded-[24px]"><div className="border-b border-[#31472f] bg-[radial-gradient(circle_at_85%_-20%,rgba(197,255,65,.22),transparent_35%),linear-gradient(135deg,#142619,#0a140c)] p-6 sm:p-8"><p className="eyebrow flex items-center gap-2"><ShieldCheck className="size-4"/> Encrypted connection vault</p><h2 className="mt-3 text-2xl font-black">One exchange connection. Two trading markets.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Verify account reading and order permissions for Spot and Futures. Your assets remain at the exchange. Withdrawals and transfers must stay disabled.</p><p className="mt-4 text-xs text-accent">{new Set(connections.map(item => item.provider)).size} of {exchangeProviders.length} exchanges connected</p></div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5 sm:p-7">{exchangeProviders.map(item => { const rows = connections.filter(row => row.provider === item.id); return <button key={item.id} onClick={() => { setProviderId(item.id); setCredentials(emptyCredentials()); setReplacing(false); setBalances(null); setFeedback(null); }} className={`rounded-2xl border p-4 text-left ${providerId === item.id ? "border-accent bg-accent/10" : "border-[#30452f] bg-[#0d1810] hover:border-[#647f4f]"}`}><span className="inline-flex size-10 items-center justify-center rounded-xl border border-white/10 text-[11px] font-black" style={{ color: item.color }}>{item.mark}</span><p className="mt-4 text-sm font-bold">{item.name}</p><p className="mt-1 text-[10px] text-muted">{rows.length === 2 && rows.every(row => row.status === "connected") ? "Spot + Futures ready" : rows.length ? "Review permissions" : "Not connected"}</p></button>; })}</div>
    </section>
    {feedback && <div role={feedback.good ? "status" : "alert"} className={`flex gap-2 rounded-xl border p-4 text-sm ${feedback.good ? "border-accent/40 text-accent" : "border-[#8f5b4b] text-[#ffd1bb]"}`}>{feedback.good ? <Check className="size-4 shrink-0"/> : <CircleAlert className="size-4 shrink-0"/>}{feedback.text}</div>}
    <section className="surface rounded-[24px] p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">Exchange credentials</p><h2 className="mt-2 text-xl font-black">{provider.name}</h2></div><div className="flex flex-wrap gap-2"><Capability label="Spot read + trade" ready={spot?.status === "connected" && spot.access === "spot_trade"}/><Capability label="Futures read + trade" ready={futures?.status === "connected" && futures.access === "futures_trade"}/></div></div>
      <div className="mt-6 grid gap-7 lg:grid-cols-[.8fr_1.2fr]"><div><p className="text-sm leading-7 text-muted">{provider.description}</p><p className="mt-4 rounded-xl border border-[#47613d] bg-accent/[.04] p-4 text-xs leading-6 text-[#bcd0b5]">Create keys dedicated to Enrivea. Enable only the listed reading and trading permissions. Keep withdrawals and transfers disabled. Restrict keys to your deployment IP when your hosting provides a stable outbound address.</p><a href={provider.managementUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-accent">Open {provider.name} API Management <ExternalLink className="size-4"/></a></div>
        <div>{!configured && <p role="alert" className="mb-4 text-xs text-[#ffd1bb]">Credential encryption is not configured. Ask an administrator to set EXCHANGE_ENCRYPTION_KEY.</p>}{connected && !replacing ? <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{([spot, futures] as const).map((row, index) => <div key={index} className="rounded-xl border border-[#344b31] bg-[#0c170f] p-4 text-xs"><p className="text-muted">{index ? "Futures" : "Spot"}</p><p className="mt-2 font-bold">{row ? `Key ending ····${row.keyLast4}` : "Key needed"}</p><p className="mt-2 text-muted">{row?.lastError ?? (row?.lastCheckedAt ? `Verified ${new Date(row.lastCheckedAt).toLocaleString()}` : "Awaiting verification")}</p></div>)}</div><div className="flex flex-wrap gap-2"><button disabled={!connectionOpen || busy !== null} onClick={() => setReplacing(true)} className="button-primary rounded-xl px-4 py-3 text-xs disabled:opacity-40">Update permissions & keys</button><button disabled={busy !== null} onClick={() => void disconnect()} className="inline-flex items-center gap-2 rounded-xl border border-[#78504a] px-4 py-3 text-xs text-[#f0b4ae]"><Trash2 className="size-4"/>{busy === "disconnect" ? "Disconnecting…" : "Disconnect exchange"}</button></div></div> : <form onSubmit={connect} className="grid gap-4 sm:grid-cols-2">{field("apiKey", provider.id === "kraken" ? "Spot API key" : "API key")}{field("apiSecret", provider.id === "kraken" ? "Spot private key" : "API secret", true)}{provider.credentialFields.some(item => item.key === "passphrase") && field("passphrase", "API passphrase", true)}{provider.id === "kucoin" && field("keyVersion", "API key version")}{provider.id === "kraken" && <><p className="sm:col-span-2 border-t border-[#344b31] pt-4 text-xs text-muted">Kraken Derivatives uses a separate key pair.</p>{field("futuresApiKey", "Derivatives API key")}{field("futuresApiSecret", "Derivatives private key", true)}</>}<div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" disabled={!configured || !connectionOpen || busy !== null} className="button-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs disabled:opacity-40">{busy === "connect" ? <LoaderCircle className="size-4 animate-spin"/> : <ArrowRight className="size-4"/>}{busy === "connect" ? "Verifying both markets…" : replacing ? "Verify replacement" : "Verify and connect"}</button>{replacing && <button type="button" onClick={() => { setReplacing(false); setCredentials(emptyCredentials()); }} className="button-secondary rounded-xl px-4 py-3 text-xs">Cancel</button>}</div></form>}</div></div>
    </section>
    {connected && <section className="surface rounded-[24px] p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="eyebrow">Live balances</p><h2 className="mt-2 text-xl font-black">{provider.name} holdings</h2><p className="mt-2 text-xs text-muted">Loaded on request; balances are not stored here.</p></div><div className="flex gap-2"><select value={balanceMarket} onChange={event => { setBalanceMarket(event.target.value as Market); setBalances(null); }} className="rounded-xl border border-[#40583c] bg-[#0c170f] px-3 text-xs"><option value="spot">Spot balances</option><option value="futures">Futures balances</option></select><button disabled={busy !== null || !(balanceMarket === "spot" ? spot : futures)} onClick={() => void refresh()} className="button-secondary inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs disabled:opacity-40"><RefreshCw className={`size-4 ${busy === "refresh" ? "animate-spin" : ""}`}/>Refresh</button></div></div>{balances === null ? <p className="mt-7 text-xs text-muted">Choose an account and refresh to see balances.</p> : balances.length ? <div className="mt-6 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-muted"><tr><th className="py-3">Asset</th><th>Account</th><th className="text-right">Available</th><th className="text-right">Held</th></tr></thead><tbody>{balances.map((row, index) => <tr key={`${row.asset}:${index}`} className="border-t border-[#30452f]"><td className="py-3 font-bold">{row.asset}</td><td>{row.account ?? "—"}</td><td className="text-right font-mono">{row.available}</td><td className="text-right font-mono">{row.locked}</td></tr>)}</tbody></table></div> : <p className="mt-7 text-xs text-muted">No non-zero balances returned.</p>}</section>}
  </div>;
}

function Capability({ label, ready }: { label: string; ready: boolean }) { return <span className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${ready ? "border-accent/40 bg-accent/10 text-accent" : "border-[#735d3c] text-[#f2cb92]"}`}>{label}: {ready ? "verified" : "needed"}</span>; }

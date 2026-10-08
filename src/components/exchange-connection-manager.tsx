"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Check, CircleAlert, ExternalLink, Eye, EyeOff, KeyRound, Link2, LoaderCircle, RefreshCw, Search, ShieldCheck, Trash2, WalletCards } from "lucide-react";
import { exchangeProviders, getExchangeProvider, type ExchangeProviderId } from "@/lib/exchange-catalog";
import type { ExchangeBalance } from "@/lib/exchange-adapters";
import { futuresCapabilities, type ExchangeMarket } from "@/lib/exchange-futures-policy";

export type ExchangeConnectionView = {
  provider: ExchangeProviderId;
  market: ExchangeMarket;
  status: "connected" | "attention";
  access: "read_only" | "spot_trade" | "futures_trade";
  keyLast4: string;
  accountLabel: string | null;
  ipRestricted: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
};

type CredentialState = { apiKey: string; apiSecret: string; passphrase: string; keyVersion: string };
const emptyCredentials = (): CredentialState => ({ apiKey: "", apiSecret: "", passphrase: "", keyVersion: "3" });

export function ExchangeConnectionManager({ initial, configured, connectionOpen = true, operationsMessage = "" }: { initial: ExchangeConnectionView[]; configured: boolean; connectionOpen?: boolean; operationsMessage?: string }) {
  const [connections, setConnections] = useState(initial);
  const [activeProvider, setActiveProvider] = useState<ExchangeProviderId>(initial[0]?.provider ?? "binance");
  const [activeMarket, setActiveMarket] = useState<ExchangeMarket>(initial[0]?.market ?? "spot");
  const [credentials, setCredentials] = useState<CredentialState>(emptyCredentials);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [replacing, setReplacing] = useState(false);
  const [balances, setBalances] = useState<Record<string, ExchangeBalance[] | undefined>>({});
  const [busy, setBusy] = useState<"connect" | "refresh" | "disconnect" | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [requestedAccess, setRequestedAccess] = useState<"read_only" | "spot_trade" | "futures_trade">("read_only");

  const provider = getExchangeProvider(activeProvider);
  const connection = connections.find((item) => item.provider === activeProvider && item.market === activeMarket) ?? null;
  const balanceKey = `${activeProvider}:${activeMarket}`;
  const providerBalances = balances[balanceKey];
  const filteredProviders = useMemo(() => exchangeProviders.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [query]);

  function selectProvider(id: ExchangeProviderId) {
    setActiveProvider(id); setReplacing(false); setCredentials(emptyCredentials()); setRequestedAccess("read_only"); setVisible({}); setFeedback(null);
  }

  function selectMarket(market: ExchangeMarket) {
    setActiveMarket(market); setReplacing(false); setCredentials(emptyCredentials()); setRequestedAccess("read_only"); setVisible({}); setFeedback(null);
  }

  async function syncConnection(id: ExchangeProviderId) {
    const response = await fetch(`/api/exchange-connections/${id}?market=${activeMarket}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Connection status is unavailable.");
    setConnections((current) => [...current.filter((item) => !(item.provider === id && item.market === activeMarket)), ...(data.connection ? [{ ...data.connection, createdAt: new Date(data.connection.createdAt).toISOString(), lastCheckedAt: data.connection.lastCheckedAt ? new Date(data.connection.lastCheckedAt).toISOString() : null } as ExchangeConnectionView] : [])]);
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("connect"); setFeedback(null);
    try {
      const response = await fetch(`/api/exchange-connections/${activeProvider}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...credentials, market: activeMarket, access: requestedAccess }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `${provider.name} could not be connected.`);
      await syncConnection(activeProvider);
      setCredentials(emptyCredentials()); setVisible({}); setReplacing(false);
      setBalances((current) => ({ ...current, [balanceKey]: undefined }));
      setFeedback({ type: "success", text: data.message ?? `${provider.name} connected.` });
    } catch (cause) { setFeedback({ type: "error", text: cause instanceof Error ? cause.message : "Connection failed." }); }
    finally { setBusy(null); }
  }

  async function refresh() {
    setBusy("refresh"); setFeedback(null);
    try {
      const response = await fetch(`/api/exchange-connections/${activeProvider}/balances?market=${activeMarket}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Balances could not be loaded.");
      setBalances((current) => ({ ...current, [balanceKey]: data.balances }));
      await syncConnection(activeProvider);
      setFeedback({ type: "success", text: `${provider.name} verified and balances refreshed at ${new Date(data.checkedAt).toLocaleTimeString()}.` });
    } catch (cause) {
      setBalances((current) => ({ ...current, [balanceKey]: undefined }));
      setFeedback({ type: "error", text: cause instanceof Error ? cause.message : "Balance check failed." });
      await syncConnection(activeProvider).catch(() => undefined);
    } finally { setBusy(null); }
  }

  async function disconnect() {
    if (!window.confirm(`Disconnect ${provider.name} ${activeMarket} and permanently remove its stored credentials?`)) return;
    setBusy("disconnect"); setFeedback(null);
    try {
      const response = await fetch(`/api/exchange-connections/${activeProvider}?market=${activeMarket}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Connection could not be removed.");
      setConnections((current) => current.filter((item) => !(item.provider === activeProvider && item.market === activeMarket)));
      setBalances((current) => ({ ...current, [balanceKey]: undefined }));
      setReplacing(false); setCredentials(emptyCredentials());
      setFeedback({ type: "success", text: `${provider.name} disconnected. Its stored credentials were permanently removed.` });
    } catch (cause) { setFeedback({ type: "error", text: cause instanceof Error ? cause.message : "Disconnect failed." }); }
    finally { setBusy(null); }
  }

  return <div className="space-y-5">
    {!connectionOpen && <div role="alert" className="rounded-xl border border-[#9b6652] bg-[#8a4f3518] p-4 text-sm leading-6 text-[#ffc0ae]"><b>New connections paused:</b> {operationsMessage} Balance refresh and disconnect remain available for existing accounts.</div>}
    <section className="surface overflow-hidden rounded-[24px]">
      <div className="relative border-b border-[#31472f] bg-[radial-gradient(circle_at_85%_-20%,rgba(197,255,65,.22),transparent_35%),linear-gradient(135deg,#142619,#0a140c)] px-5 py-7 sm:px-7">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-accent"><ShieldCheck className="size-4"/> Encrypted connection vault</div><h2 className="mt-3 text-2xl font-black tracking-[-.03em] sm:text-3xl">Bring every exchange into one view.</h2><p className="mt-3 max-w-xl text-sm leading-7 text-muted">Store separate Spot and Futures keys per exchange. Funds remain at the CEX and credentials never return to your browser.</p></div>
          <div className="grid min-w-[250px] grid-cols-2 gap-3"><Metric value={`${connections.length}/${exchangeProviders.length * 2}`} label="Connections"/><Metric value={connections.some((item) => item.status === "attention") ? "Review" : "Protected"} label="Vault status"/></div>
        </div>
      </div>
      <div className="p-5 sm:p-7">
        <div className="mb-5 grid max-w-md grid-cols-2 rounded-xl border border-[#3b5238] bg-[#0b150d] p-1"><button type="button" onClick={() => selectMarket("spot")} className={`rounded-lg px-4 py-2.5 text-xs font-black ${activeMarket === "spot" ? "bg-accent text-black" : "text-muted"}`}>Spot</button><button type="button" onClick={() => selectMarket("futures")} className={`rounded-lg px-4 py-2.5 text-xs font-black ${activeMarket === "futures" ? "bg-[#f3ba2f] text-black" : "text-muted"}`}>Futures</button></div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold">Supported exchanges</p><p className="mt-1 text-xs text-muted">Select a provider to connect or manage it.</p></div><label className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find exchange" className="h-10 rounded-xl border border-[#344d32] bg-[#0c170f] pl-9 pr-3 text-xs text-white outline-none focus:border-accent"/></label></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{filteredProviders.map((item) => {
          const itemConnection = connections.find((entry) => entry.provider === item.id && entry.market === activeMarket);
          const active = activeProvider === item.id;
          return <button key={item.id} type="button" onClick={() => selectProvider(item.id)} className={`group rounded-2xl border p-4 text-left transition duration-200 ${active ? "border-accent bg-[#c5ff4110] shadow-[0_0_32px_rgba(197,255,65,.08)]" : "border-[#30452f] bg-[#0d1810] hover:-translate-y-0.5 hover:border-[#647f4f]"}`}>
            <div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-[11px] font-black" style={{ color: item.color }}>{item.mark}</span>{itemConnection ? <span className={`size-2.5 rounded-full ${itemConnection.status === "connected" ? "bg-accent shadow-[0_0_12px_#c5ff41]" : "bg-[#f2b96d]"}`}/> : <Link2 className="size-4 text-[#71836c]"/>}</div>
            <p className="mt-4 text-sm font-bold">{item.name}</p><p className="mt-1 text-[11px] text-muted">{itemConnection ? itemConnection.status === "connected" ? itemConnection.access === "futures_trade" ? "Futures execution enabled" : itemConnection.access === "spot_trade" ? "Spot execution enabled" : "Read-only connected" : "Needs attention" : `${activeMarket === "futures" ? "Futures" : "Spot"} available`}</p>
          </button>;
        })}</div>
      </div>
    </section>

    {feedback && <div role={feedback.type === "error" ? "alert" : "status"} aria-live="polite" className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${feedback.type === "error" ? "border-[#8f5b4b] bg-[#8f5b4b19] text-[#ffd1bb]" : "border-[#587c3b] bg-[#c5ff410c] text-[#d8eccd]"}`}>{feedback.type === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0"/> : <Check className="mt-0.5 size-4 shrink-0 text-accent"/>}<span>{feedback.text}</span></div>}

    <section className="surface overflow-hidden rounded-[24px]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#31472f] bg-[#101e13] px-5 py-5 sm:px-7"><div className="flex items-center gap-4"><span className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-sm font-black" style={{ color: provider.color }}>{provider.mark}</span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-accent">{activeMarket === "futures" ? "Perpetual Futures" : provider.accountLabel} connection</p><h2 className="mt-1 text-xl font-bold">{provider.name}</h2></div></div><span className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${connection?.status === "connected" ? "border-[#83ab4f] bg-[#c5ff4117] text-accent" : connection ? "border-[#bd8e4f] bg-[#bd8e4f1a] text-[#f2cb92]" : "border-[#486044] text-[#b0c3a9]"}`}>{connection?.status === "connected" ? connection.access === "futures_trade" ? "Futures execution enabled" : connection.access === "spot_trade" ? "Spot execution enabled" : "Read-only connected" : connection ? "Needs attention" : "Not connected"}</span></div>
      <div className="grid lg:grid-cols-[.78fr_1.22fr]">
        <div className="border-b border-[#31472f] p-5 sm:p-7 lg:border-b-0 lg:border-r"><h3 className="text-base font-bold">Safe by design</h3><p className="mt-3 text-sm leading-7 text-muted">{activeMarket === "futures" ? futuresCapabilities[activeProvider].note : provider.description}</p><div className="mt-6 space-y-3 text-xs text-[#c7d8c0]"><SafetyItem text="Permission check before encrypted storage"/><SafetyItem text={activeMarket === "futures" ? "Dedicated Futures key; withdrawals and transfers refused" : "Withdrawals, transfers, margin and derivatives rejected"}/><SafetyItem text="One account per exchange and market"/></div><div className="mt-6 rounded-xl border border-[#47613d] bg-[#c5ff4109] p-4 text-xs leading-6 text-[#bcd0b5]">Create a dedicated {activeMarket === "futures" ? "Futures" : "Spot"} API key for Enrivea. Never enable withdrawals or transfers. Add an IP allowlist when your deployment has a stable outbound IP.</div><a href={provider.managementUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-accent hover:underline">Open {provider.name} API Management <ExternalLink className="size-4"/></a></div>
        <div className="p-5 sm:p-7">
          {!configured && <Notice>Exchange encryption is not configured. Set a 32-byte EXCHANGE_ENCRYPTION_KEY before accepting credentials.</Notice>}
          {connection && !replacing ? <ConnectedAccount connection={connection} busy={busy} connectionOpen={connectionOpen} onRefresh={refresh} onReplace={() => { setRequestedAccess(connection.access); setReplacing(true); setFeedback(null); }} onDisconnect={disconnect}/> : <ConnectionForm market={activeMarket} provider={provider} credentials={credentials} setCredentials={setCredentials} requestedAccess={requestedAccess} setRequestedAccess={setRequestedAccess} visible={visible} setVisible={setVisible} replacing={replacing} configured={configured} connectionOpen={connectionOpen} busy={busy} onSubmit={connect} onCancel={() => { setReplacing(false); setRequestedAccess("read_only"); setCredentials(emptyCredentials()); setVisible({}); }}/>} 
        </div>
      </div>
    </section>

    {connection && <section className="surface rounded-[22px] p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">{activeMarket === "futures" ? "Margin account" : "Unified holdings"}</p><h2 className="mt-2 text-xl font-bold">{provider.name} {activeMarket} balances</h2><p className="mt-2 text-xs leading-6 text-muted">Loaded directly from the exchange when requested. Enrivea does not persist this balance snapshot.</p></div><button type="button" disabled={busy !== null} onClick={refresh} className="button-secondary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-50"><RefreshCw className={`size-4 ${busy === "refresh" ? "animate-spin" : ""}`}/> Refresh</button></div>
      {providerBalances === undefined ? <div className="mt-6 rounded-xl border border-dashed border-[#405a37] px-5 py-11 text-center"><WalletCards className="mx-auto size-6 text-[#647a5e]"/><p className="mt-3 text-sm text-muted">Refresh to load current non-zero balances.</p></div> : providerBalances.length ? <div className="app-scrollbar mt-6 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-[10px] uppercase tracking-[.16em] text-muted"><tr><th className="px-4 py-3">Asset</th><th className="px-4 py-3">Account</th><th className="px-4 py-3 text-right">Available</th><th className="px-4 py-3 text-right">Locked / held</th></tr></thead><tbody className="divide-y divide-[#30452f]">{providerBalances.map((balance, index) => <tr key={`${balance.asset}:${balance.account ?? ""}:${index}`} className="hover:bg-[#c5ff4105]"><td className="px-4 py-4 font-bold"><span className="mr-3 inline-flex size-7 items-center justify-center rounded-full bg-[#c5ff4110] text-[9px] text-accent">{balance.asset.slice(0, 2)}</span>{balance.asset}</td><td className="px-4 py-4 text-xs text-muted">{balance.account ?? provider.accountLabel}</td><td className="number px-4 py-4 text-right font-mono text-xs">{balance.available}</td><td className="number px-4 py-4 text-right font-mono text-xs text-muted">{balance.locked}</td></tr>)}</tbody></table></div> : <div className="mt-6 rounded-xl border border-[#405a37] px-5 py-9 text-center text-sm text-muted">The exchange returned no non-zero balances for this key.</div>}
    </section>}
  </div>;
}

function Metric({ value, label }: { value: string; label: string }) { return <div className="rounded-2xl border border-[#3a5334] bg-black/20 px-4 py-3"><p className="text-lg font-black text-white">{value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-muted">{label}</p></div>; }
function SafetyItem({ text }: { text: string }) { return <div className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0 text-accent"/><span>{text}</span></div>; }
function Notice({ children }: { children: React.ReactNode }) { return <div className="mb-5 flex gap-2 rounded-xl border border-[#9b793d] bg-[#9b793d19] p-4 text-xs leading-6 text-[#f3dba8]"><CircleAlert className="mt-0.5 size-4 shrink-0"/>{children}</div>; }

function ConnectedAccount({ connection, busy, connectionOpen, onRefresh, onReplace, onDisconnect }: { connection: ExchangeConnectionView; busy: string | null; connectionOpen: boolean; onRefresh: () => void; onReplace: () => void; onDisconnect: () => void }) {
  return <>
    <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-[#c5ff4115] text-accent"><KeyRound className="size-5"/></span><div><p className="text-sm font-bold">Key ending ····{connection.keyLast4}</p><p className="mt-0.5 text-xs text-muted">Connected {new Date(connection.createdAt).toLocaleDateString()}</p></div></div>
    <div className="mt-6 grid gap-3 rounded-xl border border-[#344b31] bg-[#0c170f] p-4 text-xs sm:grid-cols-3"><div><span className="text-muted">Access</span><p className="mt-1 font-bold text-white">{connection.access === "futures_trade" ? "Futures execution" : connection.access === "spot_trade" ? "Spot execution" : "Read only"}</p></div><div><span className="text-muted">IP allowlist</span><p className="mt-1 font-bold text-white">{connection.ipRestricted ? "Enabled" : "Not detected"}</p></div><div><span className="text-muted">Last verified</span><p className="mt-1 font-bold text-white">{connection.lastCheckedAt ? new Date(connection.lastCheckedAt).toLocaleString() : "Not yet"}</p></div></div>
    {connection.lastError && <p className="mt-4 rounded-xl border border-[#735d3c] bg-[#735d3c18] p-3 text-xs leading-6 text-[#f2cb92]">{connection.lastError}</p>}
    <div className="mt-6 flex flex-wrap gap-2"><button type="button" disabled={busy !== null} onClick={onRefresh} className="button-primary inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs disabled:opacity-50">{busy === "refresh" ? <LoaderCircle className="size-4 animate-spin"/> : <RefreshCw className="size-4"/>}{busy === "refresh" ? "Verifying…" : "Verify & refresh"}</button><button type="button" disabled={busy !== null || !connectionOpen} onClick={onReplace} className="button-secondary rounded-xl px-4 py-3 text-xs font-bold disabled:opacity-50">{connectionOpen ? "Replace credentials" : "Replacement paused"}</button><button type="button" disabled={busy !== null} onClick={onDisconnect} className="inline-flex items-center gap-2 rounded-xl border border-[#78504a] px-4 py-3 text-xs font-bold text-[#f0b4ae] disabled:opacity-50"><Trash2 className="size-4"/>{busy === "disconnect" ? "Removing…" : "Disconnect"}</button></div>
  </>;
}

function ConnectionForm({ market, provider, credentials, setCredentials, requestedAccess, setRequestedAccess, visible, setVisible, replacing, configured, connectionOpen, busy, onSubmit, onCancel }: { market: ExchangeMarket; provider: (typeof exchangeProviders)[number]; credentials: CredentialState; setCredentials: React.Dispatch<React.SetStateAction<CredentialState>>; requestedAccess: "read_only" | "spot_trade" | "futures_trade"; setRequestedAccess: React.Dispatch<React.SetStateAction<"read_only" | "spot_trade" | "futures_trade">>; visible: Record<string, boolean>; setVisible: React.Dispatch<React.SetStateAction<Record<string, boolean>>>; replacing: boolean; configured: boolean; connectionOpen: boolean; busy: string | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <>
    <div className="flex items-start justify-between gap-4"><div><h3 className="text-base font-bold">{replacing ? `Replace ${provider.name} credentials` : `Connect ${provider.name}`}</h3><p className="mt-2 text-xs leading-6 text-muted">Credentials are verified live before encrypted storage. Withdrawal and transfer permissions are always refused.</p></div><span className="rounded-full border border-[#45603e] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-accent">One account</span></div>
    <div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setRequestedAccess("read_only")} className={`rounded-xl border p-3 text-left text-xs ${requestedAccess === "read_only" ? "border-accent/40 bg-accent/10" : "border-line"}`}><b>Read only</b><span className="mt-1 block text-muted">Balances and monitoring only.</span></button><button type="button" onClick={() => setRequestedAccess(market === "futures" ? "futures_trade" : "spot_trade")} className={`rounded-xl border p-3 text-left text-xs ${requestedAccess === (market === "futures" ? "futures_trade" : "spot_trade") ? "border-[#f3ba2f] bg-[#f3ba2f12]" : "border-line"}`}><b>{market === "futures" ? "Futures execution" : "Spot execution"}</b><span className="mt-1 block text-muted">Confirmed Approval Desk market orders.</span></button>{requestedAccess !== "read_only" && <p className="sm:col-span-2 rounded-xl border border-[#8a6d35] bg-[#8a6d3515] p-3 text-[11px] leading-5 text-[#f0d49b]">Enable {provider.name} read access and only its {market === "futures" ? "Futures order/position" : "Spot trading"} permission. Keep withdrawals, transfers, unrelated products, and earn disabled. Restrict the key to your deployment IP.</p>}</div>
    <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">{provider.credentialFields.map((field) => <label key={field.key} className={`block text-xs font-bold text-[#c8d9c1] ${provider.credentialFields.length % 2 === 1 && field === provider.credentialFields.at(-1) ? "sm:col-span-2" : ""}`}>{field.label}<span className="relative mt-2 block"><input autoComplete="off" autoCapitalize="off" spellCheck={false} required disabled={!configured || !connectionOpen || busy !== null} type={field.secret && !visible[field.key] ? "password" : "text"} minLength={field.key === "keyVersion" ? 1 : 8} maxLength={field.key === "apiSecret" ? 4096 : 512} value={credentials[field.key]} onChange={(event) => setCredentials((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className="h-12 w-full rounded-xl border border-[#42583d] bg-[#0c170f] px-4 pr-11 text-sm text-white outline-none transition focus:border-accent disabled:opacity-50"/>{field.secret && <button type="button" disabled={!connectionOpen} onClick={() => setVisible((current) => ({ ...current, [field.key]: !current[field.key] }))} className="absolute right-3 top-3 text-muted disabled:opacity-40" aria-label={visible[field.key] ? `Hide ${field.label}` : `Show ${field.label}`}>{visible[field.key] ? <EyeOff className="size-5"/> : <Eye className="size-5"/>}</button>}</span>{field.help && <span className="mt-1.5 block text-[10px] font-normal text-muted">{field.help}</span>}</label>)}<div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={!configured || !connectionOpen || busy !== null} type="submit" className="button-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-xs disabled:opacity-50">{busy === "connect" ? <><LoaderCircle className="size-4 animate-spin"/> Checking permissions…</> : !connectionOpen ? "Connections paused" : <>{replacing ? "Verify replacement" : "Verify and connect"}<ArrowRight className="size-4"/></>}</button>{replacing && <button type="button" disabled={busy !== null} className="button-secondary rounded-xl px-4 text-xs font-bold" onClick={onCancel}>Cancel</button>}</div></form>
  </>;
}

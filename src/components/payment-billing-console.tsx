"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Coins, CreditCard, History, Search, ShieldCheck, Wallet } from "lucide-react";
import { PaymentCoinIcon } from "@/components/payment-coin-icon";

type Gateway = { provider: string; enabled: boolean; ready: boolean; mode: string; currency: string; ratePerUsd: number };
type Coin = { code: string; name: string; network: string; iconUrl?: string };
type Data = {
  isDemo: boolean;
  account: { balance: number; activated: boolean };
  config: { activationOpen: boolean; activationPriceMinor: number; activationCredits: number; creditPacks: { id: string; label: string; credits: number; priceMinor: number; enabled: boolean }[]; billingOpen: boolean; message: string };
  gateways: Gateway[];
  purchases: { reference: string; provider: string; mode: string; kind: string; credits: number; expectedAmount: number; currency: string; status: string; createdAt: string }[];
};

const money = (minor: number, currency = "USD") => new Intl.NumberFormat("en", { style: "currency", currency }).format(minor / 100);

export function PaymentBillingConsole() {
  const [data, setData] = useState<Data | null>(null);
  const [method, setMethod] = useState("paystack");
  const [coins, setCoins] = useState<Coin[]>([]);
  const [payCurrency, setPayCurrency] = useState("usdtbsc");
  const [coinError, setCoinError] = useState("");
  const [coinLoading, setCoinLoading] = useState(true);
  const [coinPickerOpen, setCoinPickerOpen] = useState(false);
  const [coinSearch, setCoinSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/billing/methods", { cache: "no-store" })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result as Data; })
      .then(result => { setData(result); setMethod(result.gateways.find(row => row.enabled && row.ready)?.provider || "paystack"); })
      .catch(error => setError(error instanceof Error ? error.message : "Billing is unavailable."));
  }, []);

  useEffect(() => {
    if (method !== "nowpayments") return;
    let active = true;
    fetch("/api/billing/crypto-currencies", { cache: "no-store" })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body.currencies as Coin[]; })
      .then(list => {
        if (!active) return;
        setCoins(list);
        setCoinError(list.length ? "" : "No merchant currencies are currently available.");
        setPayCurrency(current => list.some(coin => coin.code === current) ? current : list.find(coin => coin.code === "usdtbsc")?.code || list[0]?.code || "");
      })
      .catch(error => { if (active) setCoinError(error instanceof Error ? error.message : "Unable to load currencies."); })
      .finally(() => { if (active) setCoinLoading(false); });
    return () => { active = false; };
  }, [method]);

  useEffect(() => {
    if (!coinPickerOpen) return;
    const close = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setCoinPickerOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [coinPickerOpen]);

  async function checkout(kind: "activation" | "topup", itemId: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, itemId, provider: method, payCurrency }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!/^\/dashboard\/checkout\/enrivea-[a-f0-9]{32}$/.test(result.url)) throw new Error("Invalid checkout destination");
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout unavailable.");
      setBusy(false);
    }
  }

  const gateway = data?.gateways.find(row => row.provider === method);
  const enabled = Boolean(gateway?.enabled && gateway.ready && data?.config.billingOpen && (method !== "nowpayments" || (coins.length > 0 && !coinError && !coinLoading)));
  const selectedCoin = coins.find(coin => coin.code === payCurrency);
  const filteredCoins = coins.filter(coin => `${coin.name} ${coin.code} ${coin.network}`.toLowerCase().includes(coinSearch.toLowerCase()));
  const quote = (minor: number) => gateway?.provider === "paystack" && gateway.mode !== "demo"
    ? `${new Intl.NumberFormat("en", { style: "currency", currency: gateway.currency }).format(Math.round(minor * gateway.ratePerUsd) / 100)} via Paystack`
    : gateway?.provider === "nowpayments" ? "Crypto amount confirmed at checkout" : "USD checkout";

  return <div className="space-y-6">
    <header>
      <p className="eyebrow">Account / Billing</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Credits & billing</h1>
      <p className="mt-2 text-sm text-muted">Your shared balance, refill options, and payment activity in one place.</p>
    </header>

    {error && <div role="alert" className="rounded-2xl border border-red-400/35 bg-red-400/5 px-5 py-4 text-sm text-red-200">{error}</div>}
    {!data && !error && <div role="status" className="surface animate-pulse rounded-2xl p-6 text-sm text-muted">Loading your billing workspace…</div>}

    {data && <>
      {!data.config.billingOpen && <div role="alert" className="rounded-2xl border border-amber-400/35 bg-amber-400/5 px-5 py-4 text-sm text-amber-200">Billing is temporarily paused. {data.config.message}</div>}

      <section className="surface relative overflow-hidden rounded-2xl border-accent/30 px-5 py-5 sm:px-7">
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent"><Coins size={24} /></div>
            <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Available platform credits</p><p className="mt-1 text-4xl font-black tabular-nums leading-none sm:text-5xl">{data.account.balance}<span className="ml-2 text-sm font-medium text-muted">credits</span></p></div>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-accent/25 bg-accent/5 px-3 py-2 text-xs text-accent sm:self-auto"><ShieldCheck size={15}/>{data.account.activated ? "Account activated · no expiry" : "Activation required"}</div>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.85fr)]">
        <section className="order-2 space-y-4 xl:order-1">
          <div className="flex items-end justify-between gap-3"><div><p className="eyebrow">01 / Choose credits</p><h2 className="mt-2 text-2xl font-bold">{data.account.activated ? "Refill your balance" : "Activate your account"}</h2></div></div>
          {data.account.activated ? <div className="grid gap-3 sm:grid-cols-2">
            {data.config.creditPacks.filter(pack => pack.enabled).map(pack => <article key={pack.id} className="surface flex min-h-56 flex-col rounded-2xl p-5 transition-colors hover:border-accent/50">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-accent">Credit pack</p><h3 className="mt-2 text-xl font-bold">{pack.label}</h3></div><span className="rounded-full border border-accent/25 bg-accent/5 px-2.5 py-1 text-xs text-accent">{pack.credits} credits</span></div>
              <p className="mt-5 text-3xl font-black">{money(pack.priceMinor)}</p>
              <p className="mt-1 text-xs text-muted">{quote(pack.priceMinor)}</p>
              <button type="button" disabled={busy || !enabled} onClick={() => void checkout("topup", pack.id)} className="button-primary mt-auto flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Opening checkout…" : "Buy credits"}<ArrowRight size={15}/></button>
            </article>)}
            {!data.config.creditPacks.some(pack => pack.enabled) && <p className="surface rounded-2xl p-5 text-sm text-muted">No refill packs are available right now.</p>}
          </div> : <article className="surface rounded-2xl border-accent/30 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-accent">One-time activation</p><div className="mt-3 flex flex-wrap items-end justify-between gap-3"><h3 className="text-4xl font-black">{money(data.config.activationPriceMinor)}</h3><span className="rounded-full border border-accent/25 bg-accent/5 px-3 py-1.5 text-xs text-accent">Includes {data.config.activationCredits} credits</span></div>
            <p className="mt-4 text-sm text-muted">Activate once. Your included credits are available across the platform. Refill whenever you need more.</p><p className="mt-2 text-xs text-muted">{quote(data.config.activationPriceMinor)}</p>
            <button type="button" disabled={busy || !enabled || !data.config.activationOpen} onClick={() => void checkout("activation", "account_activation")} className="button-primary mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Opening checkout…" : "Continue to activation"}<ArrowRight size={16}/></button>
          </article>}
          <p className="px-1 text-xs text-muted">Credits are shared across enabled products and remain available until used.</p>
        </section>

        <section className="surface order-1 rounded-2xl p-5 sm:p-6 xl:order-2">
          <p className="eyebrow">02 / Payment details</p><h2 className="mt-2 text-xl font-bold">How would you like to pay?</h2><p className="mt-1 text-xs text-muted">Choose a provider before continuing to checkout.</p>
          <div className="mt-5 grid gap-2">
            {data.gateways.map(row => {
              const available = row.enabled && row.ready;
              return <label key={row.provider} className={`flex min-h-16 items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${method === row.provider ? "border-accent/65 bg-accent/8" : "border-line bg-black/10"} ${available ? "cursor-pointer hover:border-accent/40" : "cursor-not-allowed opacity-55"}`}>
                <input type="radio" name="paymentMethod" value={row.provider} checked={method === row.provider} disabled={!available || busy} onChange={() => { setMethod(row.provider); setCoinPickerOpen(false); if (row.provider === "nowpayments") setCoinLoading(true); }} className="accent-[#c5ff39]"/>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white/5 text-accent">{row.provider === "paystack" ? <CreditCard size={18}/> : <Wallet size={18}/>}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{row.provider === "paystack" ? "Paystack" : "Crypto"}</span><span className="block text-xs text-muted">{row.provider === "paystack" ? "Cards & local payment methods" : "NOWPayments · your chosen network"}</span></span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{!available ? "Unavailable" : row.mode === "demo" ? "Demo" : row.mode === "test" ? "Test" : "Live"}</span>
              </label>;
            })}
          </div>
          {method === "nowpayments" && <div className="mt-5 border-t border-line pt-5" ref={pickerRef} onKeyDown={event => { if (event.key === "Escape") setCoinPickerOpen(false); }}>
            <label className="text-xs font-bold uppercase tracking-widest text-muted">Currency & network</label>
            <div className="relative mt-2">
              <button type="button" aria-expanded={coinPickerOpen} aria-controls="billing-currency-list" disabled={busy || coinLoading || coins.length === 0} onClick={() => setCoinPickerOpen(open => !open)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-black/20 px-3 py-3 text-left transition-colors hover:border-accent/50 disabled:opacity-50">
                {selectedCoin ? <PaymentCoinIcon code={selectedCoin.code} logo={selectedCoin.iconUrl}/> : <Coins size={22} className="text-muted"/>}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{coinLoading ? "Loading currencies…" : selectedCoin?.name || "Choose a currency"}</span><span className="block truncate text-xs text-muted">{selectedCoin ? `${selectedCoin.network} · ${selectedCoin.code.toUpperCase()}` : "Select a supported network"}</span></span><ChevronDown size={17} className={`shrink-0 text-muted transition-transform ${coinPickerOpen ? "rotate-180" : ""}`}/>
              </button>
              {coinPickerOpen && <div id="billing-currency-list" role="listbox" aria-label="Currency and network" className="absolute inset-x-0 top-full z-30 mt-2 rounded-2xl border border-accent/30 bg-[#101d14] p-2 shadow-2xl shadow-black/70">
                <div className="flex items-center gap-2 rounded-lg border border-line bg-black/20 px-3"><Search size={15} className="text-muted"/><input autoFocus value={coinSearch} onChange={event => setCoinSearch(event.target.value)} placeholder="Search coin or network" aria-label="Search currency" className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-muted"/></div>
                <div className="app-scrollbar mt-2 max-h-64 overflow-y-auto">{filteredCoins.map(coin => <button type="button" role="option" aria-selected={coin.code === payCurrency} key={coin.code} onClick={() => { setPayCurrency(coin.code); setCoinPickerOpen(false); setCoinSearch(""); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent/10 ${coin.code === payCurrency ? "bg-accent/10" : ""}`}><PaymentCoinIcon code={coin.code} logo={coin.iconUrl}/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{coin.name}</span><span className="block truncate text-xs text-muted">{coin.network} · {coin.code.toUpperCase()}</span></span>{coin.code === payCurrency && <Check size={16} className="text-accent"/>}</button>)}{!filteredCoins.length && <p className="px-3 py-4 text-sm text-muted">No matching currencies.</p>}</div>
              </div>}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">The exact crypto amount and payment address appear at checkout. Always use the selected network.</p>
            {coinError && <p role="alert" className="mt-2 text-xs text-red-300">{coinError}</p>}
          </div>}
          {data.isDemo && <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-200">Shared demo account: payments are simulated. Sign in with your own account to make a live payment.</div>}
        </section>
      </div>

      <section className="surface rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent"><History size={18}/></div><div><h2 className="font-bold">Payment history</h2><p className="text-xs text-muted">Open an order to view its latest status or resume checkout.</p></div></div>
        {data.purchases.length ? <div className="mt-4 divide-y divide-line">{data.purchases.map(row => <Link href={`/dashboard/checkout/${row.reference}`} key={row.reference} className="group flex flex-wrap items-center justify-between gap-3 py-3.5 text-sm transition-colors hover:text-accent"><div><p className="font-semibold">{row.kind === "activation" ? "Account activation" : `${row.credits} credit refill`}</p><p className="mt-1 text-xs text-muted">{new Date(row.createdAt).toLocaleString()} · {row.provider} · {row.mode}</p></div><div className="flex items-center gap-4"><div className="text-right"><p className="font-semibold">{money(row.expectedAmount, row.currency)}</p><p className="mt-1 text-xs capitalize text-accent">{row.status}</p></div><ArrowRight size={15} className="text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent"/></div></Link>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-line p-5 text-sm text-muted">No payments yet. Your first order will appear here.</p>}
      </section>
    </>}
  </div>;
}

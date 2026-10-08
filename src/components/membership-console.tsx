"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, BadgeCheck, Coins, ReceiptText, RotateCcw } from "lucide-react";

type Data = {
  workspace: { activatedAt: string | null; creditBalance: number; receipts: { requestId: string; kind: string; itemId: string; amount: number; credits: number; createdAt: string }[]; activity: { productId: string; amount: number; note: string; createdAt: string }[] };
  config: { activationOpen: boolean; activationPriceMinor: number; activationCredits: number; creditPacks: { id: string; label: string; credits: number; priceMinor: number; enabled: boolean }[]; billingOpen: boolean; billingMessage: string };
};
const button = "mt-4 rounded-xl border border-accent/40 px-4 py-3 text-xs font-bold text-accent disabled:opacity-40";

export function MembershipConsole() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async (): Promise<Data> => { const response = await fetch("/api/demo/billing", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; }, []);
  useEffect(() => { void load().then(setData, error => setMessage(error instanceof Error ? error.message : "Unable to load billing.")); }, [load]);
  async function action(payload: { kind: "activation" | "topup" | "reset"; itemId?: string }) {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/demo/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, requestId: crypto.randomUUID() }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setData(await load()); setMessage("Demo billing state updated. No real payment was taken."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Demo action failed."); }
    finally { setBusy(false); }
  }
  if (!data) return <p role="status" className="surface rounded-2xl p-6">{message || "Loading activation…"}</p>;
  const activated = Boolean(data.workspace.activatedAt);
  return <div className="space-y-5">
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-xs leading-5 text-muted">Interactive demo · Payments update only this isolated sample account. No real charge is made.</div>
    {!data.config.billingOpen && <div role="alert" className="rounded-xl border border-[#9b6652] bg-[#8a4f3518] p-4 text-sm leading-6 text-[#ffc0ae]"><b>Billing paused:</b> {data.config.billingMessage}</div>}
    <section className="surface grid gap-6 rounded-2xl p-6 sm:grid-cols-[1fr_auto]"><div><p className="text-xs uppercase tracking-widest text-accent">{activated ? <BadgeCheck className="mr-2 inline size-4"/> : <Coins className="mr-2 inline size-4"/>}{activated ? "Account activated" : "Activation required"}</p><h2 className="mt-3 text-3xl font-bold">{activated ? `${data.workspace.creditBalance} platform credits` : `$${(data.config.activationPriceMinor / 100).toFixed(2)} one time`}</h2><p className="mt-3 text-sm text-muted">{activated ? "Permanent access is active. Credits are shared across enabled products and do not expire monthly." : `Activation adds ${data.config.activationCredits} credits and permanently unlocks the platform.`}</p>{activated ? <button disabled={busy} className={button} onClick={() => void action({ kind: "reset" })}><RotateCcw className="mr-2 inline size-4"/>Reset activation demo</button> : <button disabled={busy || !data.config.activationOpen || !data.config.billingOpen} className={button} onClick={() => void action({ kind: "activation" })}>Simulate activation <ArrowUpRight className="ml-2 inline size-4"/></button>}</div><div className="flex size-28 items-center justify-center rounded-full border border-accent/30 bg-accent/5 text-4xl font-black text-accent">{data.workspace.creditBalance}</div></section>
    <section><h2 className="mb-1 text-lg font-bold">Refill shared credits</h2><p className="mb-4 text-xs text-muted">Available whenever an activated account needs more usage.</p><div className="grid gap-4 md:grid-cols-2">{data.config.creditPacks.filter(pack => pack.enabled).map(pack => <article key={pack.id} className="surface rounded-2xl p-5"><p className="text-xs font-bold uppercase tracking-widest text-accent">{pack.label}</p><p className="mt-4 text-3xl font-bold">${(pack.priceMinor / 100).toFixed(2)}</p><button disabled={busy || !activated || !data.config.billingOpen} className={button} onClick={() => void action({ kind: "topup", itemId: pack.id })}>Add {pack.credits} credits</button></article>)}</div></section>
    <div className="grid gap-5 xl:grid-cols-2"><section className="surface rounded-2xl p-5"><h2 className="mb-4 font-bold"><ReceiptText className="mr-2 inline size-4 text-accent"/>Simulated payment history</h2>{[...data.workspace.receipts].reverse().slice(0, 20).map(item => <div key={item.requestId} className="flex justify-between gap-4 border-t border-line py-3 text-sm"><div><p className="capitalize">{item.kind.replace("_", " ")} · {item.itemId}</p><p className="mt-1 text-xs text-muted">{new Date(item.createdAt).toLocaleString()}</p></div><span className="text-accent">${item.amount} <small className="block text-[10px] text-muted">SIMULATED</small></span></div>)}</section><section className="surface rounded-2xl p-5"><h2 className="mb-4 font-bold">Credit activity</h2>{[...data.workspace.activity].reverse().slice(0, 20).map((item, index) => <div key={index} className="flex justify-between gap-4 border-t border-line py-3 text-sm"><div>{item.note}<p className="mt-1 text-xs text-muted">{new Date(item.createdAt).toLocaleDateString()}</p></div><span className={item.amount >= 0 ? "text-accent" : "text-red-300"}>{item.amount > 0 ? "+" : ""}{item.amount}</span></div>)}</section></div>
    {message && <p role="status" className="rounded-xl border border-line p-4 text-sm text-muted">{message}</p>}
  </div>;
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { Coins, CalendarClock, ArrowUpRight, ReceiptText } from "lucide-react";
import { hasMonthlyAccess } from "@/lib/membership-policy";
type CatalogProduct = { slug: string; name: string; description: string; enabled: boolean; cost: number; starter: number; trader: number; desk: number; topupCredits: number; topupPrice: number };
type Data = { workspace: { planId: string; periodEnd: string; wallets: Record<string, number>; receipts: { requestId: string; kind: string; itemId: string; productId: string; amount: number; createdAt: string }[]; activity: { productId: string; amount: number; note: string; createdAt: string }[] }; catalog: CatalogProduct[]; plans: { id: "starter" | "trader" | "desk"; name: string; monthlyPrice: number }[] };
const btn = "mt-4 w-full rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm font-bold text-accent transition hover:bg-accent/20 disabled:opacity-40";
export function MembershipConsole() {
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/demo/billing", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/demo/billing", { signal: controller.signal, cache: "no-store" }).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; }).then(setData).catch(e => { if (!controller.signal.aborted) setMessage(e.message); });
    return () => controller.abort();
  }, []);
  async function purchase(payload: object) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/demo/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, requestId: crypto.randomUUID() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load(); setMessage("Demo updated successfully. No real payment was taken.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to update billing."); }
    finally { setBusy(false); }
  }
  if (!data) return <p role="status" className="surface rounded-2xl p-6">{message || "Loading your membership…"}</p>;
  const active = hasMonthlyAccess(data.workspace.periodEnd);
  return <div className="space-y-5">
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-xs leading-5 text-muted">Interactive demo · USD amounts are sample prices, not a live offer. Purchases update this demo wallet only. Preview-product credits cannot be spent until those products launch.</div>
    {message && <p role="status" className="rounded-xl border border-line p-4 text-sm">{message}</p>}
    <section className="surface grid gap-6 rounded-2xl p-6 sm:grid-cols-[1fr_auto]"><div><p className="text-xs uppercase tracking-widest text-accent"><CalendarClock className="mr-2 inline size-4"/>One membership. Your entire workspace.</p><h2 className="mt-3 text-3xl font-bold capitalize">{data.workspace.planId} <span className="text-lg text-muted">/ {active ? "active" : "expired"}</span></h2><p className="mt-3 text-sm text-muted">{active ? "Access until " : "Ended "}{new Date(data.workspace.periodEnd).toLocaleDateString()}. Renew manually each month; top-ups never extend membership.</p><p className="mt-2 text-xs text-muted">Unused balances are preserved. Expired access locks scanning and top-ups until renewal.</p></div><div className="flex flex-col justify-center"><button disabled={busy || !active} className="rounded-xl border border-line px-4 py-3 text-xs" onClick={() => void purchase({ kind: "expire" })}>Test membership expiry</button><span className="mt-2 text-center text-[10px] text-muted">Demo-only control</span></div></section>
    <section><h2 className="mb-4 text-lg font-bold">Product credit wallets</h2><div className="grid gap-4 md:grid-cols-3">{data.catalog.map(product => <article key={product.slug} className="surface rounded-2xl p-5"><div className="flex items-center justify-between"><Coins className="size-6 text-accent"/><span className="rounded-full border border-line px-2 py-1 text-[10px] uppercase text-muted">{product.enabled ? "Available" : "Preview"}</span></div><h3 className="mt-4 font-bold">{product.name}</h3><div className="mt-3 text-4xl font-bold">{data.workspace.wallets[product.slug] ?? 0}<span className="ml-2 text-xs font-normal text-muted">credits</span></div><p className="mt-3 text-xs text-muted">{product.cost} credits per action · Separate balance</p><button disabled={busy || !active || !product.enabled} className={btn} onClick={() => void purchase({ kind: "topup", productId: product.slug })}>Add {product.topupCredits} credits · ${product.topupPrice}</button></article>)}</div></section>
    <section><h2 className="mb-1 text-lg font-bold">{active ? "Renew or change your next month" : "Renew your membership"}</h2><p className="mb-4 text-xs text-muted">Early renewal extends your end date by one calendar month and adds the selected plan’s credits now.</p><div className="grid gap-4 md:grid-cols-3">{data.plans.map(plan => <article key={plan.id} className={"surface rounded-2xl p-5 " + (plan.id === data.workspace.planId ? "border-accent/40" : "")}><p className="text-xs font-bold uppercase tracking-widest text-accent">{plan.name}</p><p className="mt-4 text-3xl font-bold">${plan.monthlyPrice}<span className="text-sm font-normal text-muted"> / month</span></p><ul className="mt-5 space-y-3 text-xs text-muted">{data.catalog.map(product => <li key={product.slug} className="flex justify-between gap-3"><span>{product.name}{!product.enabled && " (preview)"}</span><b className="text-white">{product[plan.id]}</b></li>)}</ul><button disabled={busy} className={btn} onClick={() => void purchase({ kind: "monthly", itemId: plan.id })}>{active ? "Simulate renewal" : "Renew access"}<ArrowUpRight className="ml-2 inline size-4"/></button></article>)}</div></section>
    <div className="grid gap-5 xl:grid-cols-2"><section className="surface rounded-2xl p-5"><h2 className="mb-4 font-bold"><ReceiptText className="mr-2 inline size-4 text-accent"/>Simulated payment history</h2><div className="max-h-96 divide-y divide-line overflow-auto">{data.workspace.receipts.some(item => ["monthly", "topup"].includes(item.kind)) ? [...data.workspace.receipts].filter(item => ["monthly", "topup"].includes(item.kind)).reverse().map(item => <div key={item.requestId} className="flex justify-between gap-4 py-3 text-sm"><div><p className="capitalize">{item.kind} · {item.itemId}</p><p className="mt-1 text-xs text-muted">{new Date(item.createdAt).toLocaleString()} · {item.requestId.slice(0, 8)}</p></div><span className="text-accent">${item.amount} <small className="block text-[10px] text-muted">SIMULATED</small></span></div>) : <p className="py-6 text-sm text-muted">Use a simulated renewal or top-up to create your first receipt.</p>}</div></section><section className="surface rounded-2xl p-5"><h2 className="mb-4 font-bold">Credit activity</h2><div className="max-h-96 divide-y divide-line overflow-auto">{[...data.workspace.activity].reverse().map((item, index) => <div key={index} className="flex justify-between gap-4 py-3 text-sm"><div>{item.note}<p className="mt-1 text-xs text-muted">{item.productId} · {new Date(item.createdAt).toLocaleDateString()}</p></div><span className={item.amount >= 0 ? "text-accent" : "text-red-300"}>{item.amount > 0 ? "+" : ""}{item.amount}</span></div>)}</div></section></div>
  </div>;
}


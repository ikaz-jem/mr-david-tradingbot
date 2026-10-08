"use client";
import { useCallback, useEffect, useState } from "react";
type Product = { _id?: string; slug: string; name: string; description: string; enabled: boolean; cost: number; revision: number };
const field = "mt-2 w-full rounded-lg border border-line bg-[#101b13] p-2.5 text-sm";
export function ProductCatalogEditor() {
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/products", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setProducts(data.catalog); setDemo(data.isDemo);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/products", { signal: controller.signal, cache: "no-store" }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; }).then(data => { setProducts(data.catalog); setDemo(data.isDemo); }).catch(e => { if (!controller.signal.aborted) setMessage(e.message); });
    return () => controller.abort();
  }, []);
  function update(index: number, patch: Partial<Product>) { setProducts(items => items.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  async function save(product: Product) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(product) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load(); setMessage("Product saved. New activity uses this credit cost immediately.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Save failed."); }
    finally { setBusy(false); }
  }
  return <div><p className="mb-5 rounded-xl border border-accent/30 p-4 text-xs leading-5 text-muted">{demo ? "Isolated demo catalog. Changes affect shared demo accounts only." : "Live catalog. Changes apply to new platform activity immediately."} Every enabled product spends credits from the same account balance. Credit refill packs and account activation are configured separately in Platform controls.</p>{message && <p role="status" className="mb-4 rounded-xl border border-line p-4 text-sm">{message}</p>}<div className="grid gap-5 xl:grid-cols-2">{products.map((product, index) => <form key={index} onSubmit={event => { event.preventDefault(); void save(product); }} className="surface space-y-4 rounded-2xl p-5"><div className="flex items-center justify-between"><h2 className="font-bold text-accent">{product.name || "New product"}</h2><label className="text-xs"><input type="checkbox" checked={product.enabled} onChange={e => update(index, { enabled: e.target.checked })} className="mr-2"/>Enabled</label></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted">Product ID<input required pattern="[a-z][a-z0-9-]{1,39}" readOnly={Boolean(product._id)} className={field} value={product.slug} onChange={e => update(index, { slug: e.target.value })}/></label><label className="text-xs text-muted">Display name<input required minLength={3} maxLength={80} className={field} value={product.name} onChange={e => update(index, { name: e.target.value })}/></label></div><label className="block text-xs text-muted">Description<textarea required minLength={10} maxLength={300} className={field} value={product.description} onChange={e => update(index, { description: e.target.value })}/></label><label className="block text-xs text-muted">Credits consumed per successful action<input type="number" required min="1" max="1000" step="1" className={field} value={product.cost} onChange={e => update(index, { cost: Number(e.target.value) })}/></label><button disabled={busy} className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-black disabled:opacity-40">{busy ? "Saving…" : "Save product"}</button></form>)}</div><button type="button" disabled={busy || products.length >= 20} className="mt-5 rounded-xl border border-line px-5 py-3 text-sm disabled:opacity-40" onClick={() => setProducts(items => [...items, { slug: "", name: "", description: "", enabled: false, cost: 1, revision: 0 }])}>Add product</button></div>;
}


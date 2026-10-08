"use client";

import { useCallback, useEffect, useState } from "react";
import { FlaskConical, LockKeyhole, Plus, Save, Trash2 } from "lucide-react";

type Strategy = { _id?: string; slug: string; name: string; description: string; engine: string; sensitivity: "conservative" | "balanced" | "aggressive"; products: string[]; enabled: boolean; experimental: boolean; locked?: boolean; version: number; revision: number };
const field = "mt-2 w-full rounded-xl border border-line bg-[#0c1510] px-3 py-2.5 text-sm text-white outline-none focus:border-accent";
const productLabels: Record<string, string> = { signals: "Research Scanner", "approval-desk": "Approval Desk", autopilot: "Autopilot" };

export function StrategyCatalogEditor() {
  const [items, setItems] = useState<Strategy[]>([]);
  const [engines, setEngines] = useState<string[]>([]);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/strategies", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Strategy catalog unavailable.");
    setItems(data.catalog); setEngines(data.engines); setDemo(Boolean(data.isDemo));
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/strategies", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Strategy catalog unavailable.");
      return data;
    }).then(data => {
      if (!active) return;
      setItems(data.catalog); setEngines(data.engines); setDemo(Boolean(data.isDemo));
    }).catch(error => { if (active) setFeedback({ type: "error", text: error instanceof Error ? error.message : "Strategy catalog unavailable." }); });
    return () => { active = false; };
  }, []);
  function update(index: number, patch: Partial<Strategy>) { setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)); }
  async function save(item: Strategy) {
    setBusy(item.slug || "new"); setFeedback(null);
    try {
      const response = await fetch("/api/admin/strategies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Strategy could not be saved.");
      await load(); setFeedback({ type: "success", text: `${item.name} saved and versioned successfully.` });
    } catch (error) { setFeedback({ type: "error", text: error instanceof Error ? error.message : "Strategy could not be saved." }); }
    finally { setBusy(null); }
  }
  async function remove(item: Strategy) {
    setBusy(item.slug); setFeedback(null);
    try {
      const response = await fetch("/api/admin/strategies", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: item.slug, revision: item.revision }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Strategy could not be deleted.");
      await load(); setFeedback({ type: "success", text: `${item.name} deleted.` });
    } catch (error) { setFeedback({ type: "error", text: error instanceof Error ? error.message : "Strategy could not be deleted." }); }
    finally { setBusy(null); }
  }
  return <div><div className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto]"><div className="rounded-2xl border border-accent/25 bg-accent/[.045] p-5"><p className="flex items-center gap-2 text-sm font-black"><FlaskConical className="size-4 text-accent"/> Controlled strategy publishing</p><p className="mt-2 text-xs leading-6 text-muted">{demo ? "Demo strategy scope: changes affect showcase accounts only." : "Live strategy scope: changes are available to customers immediately."} Custom entries must use a validated engine. Free-form prompts cannot enter execution products.</p></div><div className="rounded-2xl border border-line p-5"><p className="text-[9px] font-black uppercase tracking-wider text-muted">Catalog status</p><p className="mt-2 text-2xl font-black text-accent">{items.filter(item => item.enabled).length} active</p><p className="mt-1 text-[10px] text-muted">{items.length} total definitions</p></div></div>{feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`mb-5 rounded-xl border p-4 text-sm ${feedback.type === "error" ? "border-[#8b4f49] text-[#ffaaa2]" : "border-accent/30 text-accent"}`}>{feedback.text}</p>}<div className="grid gap-5 xl:grid-cols-2">{items.map((item, index) => <form key={item._id ?? `new-${index}`} onSubmit={event => { event.preventDefault(); void save(item); }} className="surface rounded-2xl p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-black">{item.name || "New strategy"}</h2>{item.locked && <LockKeyhole className="size-3 text-muted"/>}{item.experimental && <span className="rounded-full border border-[#97703c] px-2 py-0.5 text-[8px] font-black uppercase text-[#eaca8a]">Experimental</span>}</div><p className="mt-1 text-[9px] uppercase tracking-wider text-muted">Version {item.version} · revision {item.revision}</p></div><label className="text-xs font-bold"><input type="checkbox" checked={item.enabled} onChange={event => update(index, { enabled: event.target.checked })} className="mr-2 accent-[#c5ff41]"/>Enabled</label></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs text-muted">Strategy ID<input className={field} required readOnly={Boolean(item._id)} pattern="[a-z][a-z0-9-]{1,39}" value={item.slug} onChange={event => update(index, { slug: event.target.value })}/></label><label className="text-xs text-muted">Display name<input className={field} required minLength={3} maxLength={80} value={item.name} onChange={event => update(index, { name: event.target.value })}/></label><label className="text-xs text-muted">Validated engine<select className={field} disabled={item.locked} value={item.engine} onChange={event => update(index, { engine: event.target.value })}>{engines.map(engine => <option key={engine}>{engine}</option>)}</select></label><label className="text-xs text-muted">Sensitivity<select className={field} value={item.sensitivity} onChange={event => update(index, { sensitivity: event.target.value as Strategy["sensitivity"] })}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option></select></label></div><label className="mt-4 block text-xs text-muted">Description<textarea className={`${field} min-h-24`} required minLength={20} maxLength={400} value={item.description} onChange={event => update(index, { description: event.target.value })}/></label><div className="mt-4"><p className="text-xs text-muted">Available products</p><div className="mt-2 flex flex-wrap gap-2">{Object.entries(productLabels).map(([product, label]) => <label key={product} className={`rounded-xl border px-3 py-2 text-[10px] font-bold ${item.products.includes(product) ? "border-accent/35 bg-accent/10 text-accent" : "border-line text-muted"}`}><input type="checkbox" className="sr-only" checked={item.products.includes(product)} onChange={event => update(index, { products: event.target.checked ? [...item.products, product] : item.products.filter(value => value !== product) })}/>{label}</label>)}</div></div><label className="mt-4 flex items-start gap-2 rounded-xl border border-line p-3 text-xs text-muted"><input type="checkbox" checked={item.experimental} onChange={event => update(index, { experimental: event.target.checked })} className="mt-0.5 accent-[#c5ff41]"/><span><strong className="block text-white">Experimental method</strong>Excluded from AI Router and automation unless explicitly selected and assigned.</span></label><div className="mt-5 flex gap-2"><button disabled={busy !== null} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-black text-black disabled:opacity-40"><Save className="size-3.5"/>{busy === item.slug ? "Saving…" : "Save strategy"}</button>{!item.locked && <button type="button" disabled={busy !== null} onClick={() => void remove(item)} className="inline-flex items-center gap-2 rounded-xl border border-[#814b48] px-4 py-2.5 text-xs font-black text-[#ffaaa2] disabled:opacity-40"><Trash2 className="size-3.5"/>Delete</button>}</div></form>)}</div><button type="button" disabled={busy !== null || items.length >= 50} onClick={() => setItems(current => [...current, { slug: "", name: "", description: "", engine: "trend-breakout", sensitivity: "balanced", products: ["signals"], enabled: false, experimental: true, version: 1, revision: 0 }])} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-bold text-accent disabled:opacity-40"><Plus className="size-4"/>Add strategy</button></div>;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

type Pack = { id: string; label: string; credits: number; priceMinor: number; enabled: boolean };
type Config = { activationOpen: boolean; activationPriceMinor: number; activationCredits: number; creditPacks: Pack[] };
const fieldClass = "mt-2 h-11 w-full rounded-xl border border-line bg-[#0e1510] px-3 text-sm text-white";
const smallButton = "inline-flex items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-xs font-bold disabled:opacity-40";

export function AdminActivationConfig({ config, demo = false }: { config: Config; demo?: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState(config);
  const [reason, setReason] = useState(demo ? "Interactive demo activation pricing" : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(field: keyof Config, value: Config[keyof Config], success = "Activation billing configuration saved and audited.") {
    if (reason.trim().length < 8) { setMessage("Enter an audit reason of at least 8 characters."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/controls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field, value, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save activation pricing.");
      setCurrent({ activationOpen: result.config.activationOpen, activationPriceMinor: result.config.activationPriceMinor, activationCredits: result.config.activationCredits, creditPacks: result.config.creditPacks });
      setMessage(success);
      setReason(demo ? "Interactive demo activation pricing" : "");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save activation pricing."); }
    finally { setBusy(false); }
  }

  function updatePack(index: number, update: Partial<Pack>) {
    setCurrent(value => ({ ...value, creditPacks: value.creditPacks.map((pack, item) => item === index ? { ...pack, ...update } : pack) }));
  }
  function addPack() {
    if (current.creditPacks.length >= 10) { setMessage("A maximum of 10 refill packs is supported."); return; }
    const used = new Set(current.creditPacks.map(pack => pack.id));
    let number = current.creditPacks.length + 1;
    while (used.has(`custom_pack_${number}`)) number += 1;
    setCurrent(value => ({ ...value, creditPacks: [...value.creditPacks, { id: `custom_pack_${number}`, label: "New credit pack", credits: 25, priceMinor: 1500, enabled: true }] }));
    setMessage("New pack added locally. Edit it, enter an audit reason, then save all packs.");
  }
  function deletePack(index: number) {
    const pack = current.creditPacks[index];
    const packs = current.creditPacks.filter((_, item) => item !== index);
    void save("creditPacks", packs, `${pack.label} deleted. Pricing and billing pages were updated.`);
  }

  const ready = !busy && reason.trim().length >= 8;
  return <div className="space-y-5">
    <div className="rounded-xl border border-accent/25 bg-accent/5 p-4"><p className="text-sm font-bold text-accent">One-time activation</p><p className="mt-2 text-xs leading-5 text-muted">A customer pays once. Included credits enter one shared platform balance. Credit packs become available after activation and can be created, edited, disabled, or deleted here.</p></div>
    <label className="block text-sm font-bold">Audit reason<input value={reason} onChange={event => setReason(event.target.value)} maxLength={300} placeholder="Why is pricing changing?" className={fieldClass}/></label>
    <div className="grid gap-4 lg:grid-cols-3">
      <label className="rounded-xl border border-line bg-[#141e17] p-4 text-sm font-bold">Activation price · USD<input type="number" min="1" max="1000000" step="0.01" value={current.activationPriceMinor / 100} onChange={event => setCurrent(value => ({ ...value, activationPriceMinor: Math.round(Number(event.target.value) * 100) }))} className={fieldClass}/><button type="button" disabled={!ready} onClick={() => void save("activationPriceMinor", current.activationPriceMinor)} className="button-secondary mt-3 rounded-lg px-4 py-2 text-xs disabled:opacity-40">Save price</button></label>
      <label className="rounded-xl border border-line bg-[#141e17] p-4 text-sm font-bold">Credits included<input type="number" min="1" max="100000" step="1" value={current.activationCredits} onChange={event => setCurrent(value => ({ ...value, activationCredits: Number(event.target.value) }))} className={fieldClass}/><button type="button" disabled={!ready} onClick={() => void save("activationCredits", current.activationCredits)} className="button-secondary mt-3 rounded-lg px-4 py-2 text-xs disabled:opacity-40">Save credits</button></label>
      <div className="rounded-xl border border-line bg-[#141e17] p-4"><p className="text-sm font-bold">Activation checkout</p><p className="mt-2 text-xs text-muted">Pause new activation payments without affecting activated accounts.</p><button type="button" disabled={!ready} onClick={() => void save("activationOpen", !current.activationOpen)} className={`mt-5 rounded-lg border px-4 py-2 text-xs font-bold disabled:opacity-40 ${current.activationOpen ? "border-accent/40 text-accent" : "border-amber-300/40 text-amber-200"}`}>{current.activationOpen ? "Active · Pause" : "Paused · Resume"}</button></div>
    </div>
    <section className="rounded-xl border border-line bg-[#141e17] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Credit refill packs</h3><p className="mt-1 text-xs text-muted">{current.creditPacks.length}/10 packs · shared across every current and future product.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || current.creditPacks.length >= 10} onClick={addPack} className={smallButton}><Plus className="size-4"/>Add pack</button><button type="button" disabled={!ready} onClick={() => void save("creditPacks", current.creditPacks, "Credit pack catalog saved. Pricing and billing pages were updated.")} className="button-primary rounded-lg px-4 py-2 text-xs disabled:opacity-40">Save all packs</button></div></div>
      {current.creditPacks.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{current.creditPacks.map((pack, index) => <article key={pack.id} className="grid grid-cols-2 gap-3 rounded-xl border border-line p-4"><label className="text-xs text-muted">Label<input required minLength={3} maxLength={80} value={pack.label} onChange={event => updatePack(index, { label: event.target.value })} className={fieldClass}/></label><label className="text-xs text-muted">Pack ID<input value={pack.id} readOnly className={fieldClass}/></label><label className="text-xs text-muted">Credits<input type="number" min="1" max="100000" value={pack.credits} onChange={event => updatePack(index, { credits: Number(event.target.value) })} className={fieldClass}/></label><label className="text-xs text-muted">Price · USD<input type="number" min="0.01" max="1000000" step="0.01" value={pack.priceMinor / 100} onChange={event => updatePack(index, { priceMinor: Math.round(Number(event.target.value) * 100) })} className={fieldClass}/></label><label className="flex items-center text-xs"><input type="checkbox" checked={pack.enabled} onChange={event => updatePack(index, { enabled: event.target.checked })} className="mr-2"/>Available for purchase</label><button type="button" disabled={!ready} onClick={() => deletePack(index)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-400/30 px-3 py-2 text-xs font-bold text-red-200 disabled:opacity-40"><Trash2 className="size-4"/>Delete pack</button></article>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-line px-5 py-10 text-center"><p className="text-sm font-bold">No refill packs</p><p className="mt-2 text-xs text-muted">Activated users keep their balances, but cannot buy refills until an administrator creates a pack.</p></div>}
    </section>
    {message && <p role="status" className="rounded-xl border border-line p-3 text-sm text-muted">{message}</p>}
  </div>;
}

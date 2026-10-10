"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminOrderReconcile({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function submit() {
    if (reason.trim().length < 8) { setFeedback("Enter at least eight characters."); return; }
    setBusy(true); setFeedback("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/reconcile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Reconciliation failed.");
      setFeedback(`Exchange status reconciled: ${body.status}.`); setOpen(false); router.refresh();
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Reconciliation failed."); }
    finally { setBusy(false); }
  }
  return <div className="min-w-40"><button type="button" disabled={busy} onClick={() => setOpen(value => !value)} className="button-secondary rounded-lg px-3 py-2 text-[10px] font-bold disabled:opacity-40">{busy ? "Checking…" : "Reconcile"}</button>{open && <div className="mt-2 rounded-xl border border-line bg-[#0c1510] p-3"><label className="text-[10px] text-muted">Audit reason<input value={reason} onChange={event => setReason(event.target.value)} minLength={8} maxLength={300} className="mt-2 w-full rounded-lg border border-line bg-[#111a13] px-2 py-2 text-xs text-white" placeholder="Why query this order?"/></label><button type="button" disabled={busy || reason.trim().length < 8} onClick={() => void submit()} className="mt-2 rounded-lg bg-accent px-3 py-2 text-[10px] font-bold text-black disabled:opacity-40">Query exchange</button></div>}{feedback && <p role="status" className="mt-2 max-w-56 text-[10px] leading-4 text-muted">{feedback}</p>}</div>;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminPaymentVerify({ reference }: { reference: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function verify() {
    if (reason.trim().length < 8) { setMessage("Enter at least eight characters."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/billing/${encodeURIComponent(reference)}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Verification failed.");
      setOpen(false); setMessage(`Provider check complete: ${body.status}.`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Verification failed."); }
    finally { setBusy(false); }
  }
  return <div className="mt-2"><button type="button" disabled={busy} onClick={() => setOpen(value => !value)} className="rounded-lg border border-line px-2.5 py-1.5 text-[10px] font-bold text-accent disabled:opacity-40">{busy ? "Checking…" : "Verify with provider"}</button>{open && <div className="mt-2 rounded-lg border border-line bg-[#0c1510] p-2"><input aria-label="Payment verification reason" value={reason} onChange={event => setReason(event.target.value)} minLength={8} maxLength={300} placeholder="Reason for provider check" className="w-full rounded-md border border-line bg-[#111a13] px-2 py-1.5 text-[10px] text-white"/><button type="button" disabled={busy || reason.trim().length < 8} onClick={() => void verify()} className="mt-2 rounded-md bg-accent px-2.5 py-1.5 text-[10px] font-bold text-black disabled:opacity-40">Confirm check</button></div>}{message && <p role="status" className="mt-1 max-w-64 text-[10px] leading-4 text-muted">{message}</p>}</div>;
}

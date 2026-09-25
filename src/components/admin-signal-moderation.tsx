"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminSignalModeration({ signalId }: { signalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  async function invalidate() {
    if (reason.trim().length < 12) { setError("Enter at least 12 characters."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/signals/${signalId}/moderate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Moderation failed.");
      setOpen(false);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Moderation failed."); }
    finally { setBusy(false); }
  }
  return <div className="w-full sm:w-auto"><button disabled={busy} onClick={() => setOpen(!open)} className="rounded-lg border border-[#9c644f] px-3 py-2 text-xs font-bold text-[#f6b795] disabled:opacity-40">Invalidate signal</button>{open && <div className="mt-2 w-full rounded-xl border border-[#9c644f] bg-[#2b1e18] p-3 sm:w-72"><label className="text-xs font-bold text-[#f6b795]">Owner-visible reason<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={300} rows={3} placeholder="Explain why this idea is unsafe or no longer valid" className="mt-2 w-full rounded-lg border border-line bg-[#0e1510] px-3 py-2 text-xs text-white"/></label><button disabled={busy || reason.trim().length < 12} onClick={invalidate} className="mt-2 rounded-lg bg-[#f6b795] px-3 py-2 text-xs font-bold text-[#26170e] disabled:opacity-40">Confirm invalidation</button></div>}{error && <p role="alert" className="mt-2 text-xs text-[#f6b795]">{error}</p>}</div>;
}

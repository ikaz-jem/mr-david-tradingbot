"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminUserAccess({ userId, role, status, countryCode }: { userId: string; role: "user" | "staff"; status: "active" | "suspended"; countryCode?: string | null }) {
  const router = useRouter();
  const [nextRole, setNextRole] = useState(role);
  const [nextStatus, setNextStatus] = useState(status);
  const [nextCountry, setNextCountry] = useState(countryCode ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function apply(action: "set_role" | "set_status" | "set_country", value: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${userId}/access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, value, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Change failed.");
      setMessage(result.unchanged ? "No change needed." : "Change saved and audited.");
      setReason(""); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Change failed."); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 max-w-[440px] space-y-3 rounded-xl border border-line bg-[#141d16] p-4"><label className="block text-xs font-bold text-muted">Reason for change<input value={reason} onChange={event => setReason(event.target.value)} maxLength={300} placeholder="At least 12 characters for country changes" className="mt-1 w-full rounded-lg border border-line bg-[#0d150f] px-3 py-2 text-sm text-white"/></label><div className="flex flex-wrap gap-2"><select aria-label="Account role" value={nextRole} onChange={event => setNextRole(event.target.value as "user" | "staff")} className="rounded-lg border border-line bg-[#0d150f] px-3 py-2 text-xs"><option value="user">User</option><option value="staff">Staff</option></select><button type="button" disabled={busy || reason.trim().length < 8 || nextRole === role} onClick={() => apply("set_role", nextRole)} className="button-secondary rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-40">Save role</button><select aria-label="Account status" value={nextStatus} onChange={event => setNextStatus(event.target.value as "active" | "suspended")} className="rounded-lg border border-line bg-[#0d150f] px-3 py-2 text-xs"><option value="active">Active</option><option value="suspended">Suspended</option></select><button type="button" disabled={busy || reason.trim().length < 8 || nextStatus === status} onClick={() => apply("set_status", nextStatus)} className="button-secondary rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-40">Save status</button></div><div className="border-t border-line pt-3"><label className="block text-xs font-bold text-muted">Verified billing country (ISO 2-letter code)<input value={nextCountry} onChange={event => setNextCountry(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))} maxLength={2} placeholder="NG" className="mt-1 w-24 rounded-lg border border-line bg-[#0d150f] px-3 py-2 text-sm text-white"/></label><p className="mt-1 text-xs text-muted">Set only after independent country and merchant-eligibility checks.</p><button type="button" disabled={busy || reason.trim().length < 12 || nextCountry.length !== 2 || nextCountry === countryCode} onClick={() => apply("set_country", nextCountry)} className="button-secondary mt-2 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-40">Save verified country</button></div>{message && <p role="status" className="text-xs text-muted">{message}</p>}</div>;
}

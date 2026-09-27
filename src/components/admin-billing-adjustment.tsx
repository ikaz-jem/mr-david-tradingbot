"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AdminBillingAdjustment({ users }: { users: { id: string; email: string }[] }) {
  const router = useRouter();
  const [action, setAction] = useState<"credit_adjustment" | "extend_month">("credit_adjustment");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/admin/billing/adjust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUserId: data.get("targetUserId"), action, amount: action === "credit_adjustment" ? Number(data.get("amount")) : undefined, reason: data.get("reason") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Adjustment failed.");
      form.reset(); setMessage("Change applied and audited."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Adjustment failed."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Account<select name="targetUserId" required className="mt-2 block h-11 w-full rounded-xl border border-line bg-[#111a13] px-3 text-sm text-white"><option value="">Choose an account</option>{users.map(user => <option key={user.id} value={user.id}>{user.email}</option>)}</select></label><label className="text-sm font-semibold">Action<select value={action} onChange={event => setAction(event.target.value as typeof action)} className="mt-2 block h-11 w-full rounded-xl border border-line bg-[#111a13] px-3 text-sm text-white"><option value="credit_adjustment">Adjust credits</option><option value="extend_month">Extend access one month</option></select></label>{action === "credit_adjustment" && <label className="text-sm font-semibold">Credit change<input name="amount" type="number" min={-500} max={500} step={1} required placeholder="e.g. +10 or -2" className="mt-2 block h-11 w-full rounded-xl border border-line bg-[#111a13] px-3 text-sm text-white"/></label>}<label className="text-sm font-semibold md:col-span-2">Reason<input name="reason" minLength={12} maxLength={300} required placeholder="Explain the customer support or reconciliation reason" className="mt-2 block h-11 w-full rounded-xl border border-line bg-[#111a13] px-3 text-sm text-white"/></label><div className="md:col-span-2"><button disabled={busy || !users.length} className="button-primary rounded-xl px-5 py-3 text-xs font-bold disabled:opacity-50">{busy ? "Applying…" : "Apply audited change"}</button>{message && <p role="status" className="mt-3 text-sm text-muted">{message}</p>}</div></form>;
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AdminNotificationComposer() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/admin/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Notification could not be sent.");
      form.reset(); setMessage("Notification delivered to the user's in-app inbox and audited."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Notification could not be sent."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={send} className="grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Recipient email<input name="targetEmail" type="email" required maxLength={254} placeholder="customer@example.com" className="mt-2 block h-11 w-full rounded-xl border border-line bg-[#111a13] px-3 text-sm text-white"/></label><label className="text-sm font-semibold">Title<input name="title" required minLength={4} maxLength={120} placeholder="An update about your account" className="mt-2 block h-11 w-full rounded-xl border border-line bg-[#111a13] px-3 text-sm text-white"/></label><label className="text-sm font-semibold md:col-span-2">Message<textarea name="body" required minLength={12} maxLength={500} rows={3} placeholder="Write the exact message this customer should see." className="mt-2 block w-full rounded-xl border border-line bg-[#111a13] px-3 py-2 text-sm text-white"/></label><label className="text-sm font-semibold md:col-span-2">Internal audit reason<input name="reason" required minLength={12} maxLength={300} placeholder="Why is this notification being sent?" className="mt-2 block h-11 w-full rounded-xl border border-line bg-[#111a13] px-3 text-sm text-white"/></label><div className="md:col-span-2"><button disabled={busy} className="button-primary rounded-xl px-5 py-3 text-xs font-bold disabled:opacity-50">{busy ? "Sending…" : "Send in-app notification"}</button><p className="mt-2 text-xs text-muted">This sends an in-app message, not email. Demo admins can only message demo users.</p>{message && <p role="status" className="mt-2 text-sm text-accent">{message}</p>}</div></form>;
}

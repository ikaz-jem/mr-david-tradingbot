"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminEmailTestButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function send() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/emails/test", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Test email failed.");
      setMessage(result.simulated ? "Simulated email saved in the outbox. No external email was sent." : "Test email accepted by Resend. Watch the delivery record below."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Test email failed."); }
    finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={send} className="button-primary rounded-xl px-5 py-3 text-xs font-bold disabled:opacity-50">{busy ? "Sending…" : "Send test to my email"}</button>{message && <p role="status" className="mt-2 text-sm text-muted">{message}</p>}</div>;
}

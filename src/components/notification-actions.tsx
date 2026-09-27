"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NotificationActions({ id }: { id?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function markRead() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update notifications.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update notifications."); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex flex-col items-end gap-1"><button type="button" disabled={busy} onClick={markRead} className="text-xs font-bold text-accent hover:underline disabled:opacity-50">{busy ? "Saving…" : id ? "Mark read" : "Mark all read"}</button>{error && <span role="alert" className="text-xs text-[#ff939b]">{error}</span>}</span>;
}

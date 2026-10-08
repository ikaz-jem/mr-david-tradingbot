"use client";

import { useState } from "react";

export function BillingPurchaseButton({ kind, itemId, label, disabled = false }: { kind: "activation" | "topup"; itemId: string; label: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function checkout() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, itemId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Checkout is unavailable.");
      if (!/^\/dashboard\/checkout\/enrivea-[a-f0-9]{32}$/.test(result.url)) throw new Error("Checkout returned an invalid destination.");
      window.location.assign(result.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Checkout is unavailable."); setBusy(false); }
  }
  return <div><button type="button" onClick={checkout} disabled={disabled || busy} className="button-primary mt-5 rounded-xl px-5 py-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Opening checkout…" : label}</button>{error && <p role="alert" className="mt-2 text-xs text-[#ff939b]">{error}</p>}</div>;
}

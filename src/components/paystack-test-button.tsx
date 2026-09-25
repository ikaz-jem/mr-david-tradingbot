"use client";

import { useState } from "react";
import type { PlanId } from "@/lib/plans";

export function PaystackTestButton({ planId }: { planId: PlanId }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function startCheckout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/billing/paystack/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error ?? "Test checkout unavailable.");
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Test checkout unavailable.");
      setBusy(false);
    }
  }
  return <div className="mt-4"><button type="button" onClick={startCheckout} disabled={busy} className="button-secondary rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50">{busy ? "Opening sandbox…" : "Try Paystack sandbox"}</button>{error && <p role="alert" className="mt-2 text-xs text-[#ff939b]">{error}</p>}</div>;
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { PaymentCoinIcon } from "@/components/payment-coin-icon";
import { shouldVerifyPayment } from "@/lib/payment-display";

type Purchase = { reference: string; kind: string; credits: number; expectedAmount: number; currency: string; status: string; mode: string; provider: string; authorizationUrl: string; payAddress: string; payAmount: string; providerStatus: string; payCurrency: string; payNetwork: string; payExtraId: string; providerPaymentId: string; failureCode: string };
export function PaymentCheckout({ reference }: { reference: string }) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [message, setMessage] = useState("");
  const [syncMessage, setSyncMessage] = useState("Connecting to payment status…");
  const [busy, setBusy] = useState(false);
  const requestInFlight = useRef(false);
  const endpoint = `/api/billing/purchases/${encodeURIComponent(reference)}`;
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { cache: "no-store", signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load payment.");
    return data.purchase as Purchase;
  }, [endpoint]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refresh() {
      if (!active) return;
      if (document.hidden || requestInFlight.current) { clearTimeout(timer); timer = setTimeout(refresh, 20000); return; }
      requestInFlight.current = true;
      let settled = false;
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]);
        let latest = await load(signal);
        if (active) setPurchase(latest);
        if (shouldVerifyPayment(latest)) {
          if (active) setSyncMessage("Checking provider confirmation automatically…");
          const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify" }), signal });
          if (!response.ok && response.status !== 429) throw new Error("Provider check delayed. Retrying automatically; do not pay again.");
          latest = await load(signal);
        }
        if (active) {
          setPurchase(latest);
          setSyncMessage(latest.status === "paid" ? "Payment confirmed. Your credits are ready." : latest.mode === "demo" ? "Simulation only — no blockchain payment is expected." : shouldVerifyPayment(latest) ? "Watching for payment automatically · checks every 20 seconds" : "Latest payment status received.");
        }
        settled = ["paid", "failed"].includes(latest.status) || (latest.status === "review" && latest.providerStatus !== "partially_paid");
      } catch (error) {
        if (active) setSyncMessage(error instanceof Error && error.name !== "AbortError" ? error.message : "Connection interrupted. Retrying automatically.");
      } finally {
        requestInFlight.current = false;
        if (active && !settled) { clearTimeout(timer); timer = setTimeout(refresh, 20000); }
      }
    }
    function resume() { if (!document.hidden) { clearTimeout(timer); void refresh(); } }
    timer = setTimeout(refresh, 0);
    document.addEventListener("visibilitychange", resume);
    return () => { active = false; controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", resume); };
  }, [endpoint, load]);

  async function action(action: "simulate" | "verify") {
    if (requestInFlight.current) return;
    requestInFlight.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }), signal: AbortSignal.timeout(25000) });
      const result = await response.json();
      if (!response.ok && response.status !== 429) throw new Error(result.error);
      const latest = await load(); setPurchase(latest);
      setMessage(latest.status === "paid" ? "Payment confirmed. Your credits are ready." : "Status refreshed. Payment confirmation is automatic.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to check payment."); }
    finally { requestInFlight.current = false; setBusy(false); }
  }
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setMessage(`${label} copied.`); }
    catch { setMessage(`Select and copy the ${label.toLowerCase()} manually.`); }
  }
  const paid = purchase?.status === "paid";
  const canSend = purchase?.status === "pending" && purchase.mode !== "demo";
  const coin = purchase?.payCurrency || "usdtbsc";
  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow">Billing / Secure checkout</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{paid ? "Payment complete" : "Complete your payment"}</h1><p className="mt-2 text-sm text-muted">Your order details and payment status, all in one place.</p></div>
      <Link href="/dashboard/credits" className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-accent/50 hover:text-accent">← Back to billing</Link>
    </header>

    {!purchase ? <div role="status" className="surface rounded-2xl p-6 text-sm text-muted">{syncMessage}</div> : <>
      <div className="surface flex flex-wrap items-center justify-between gap-4 rounded-2xl border-accent/30 p-5 sm:p-6">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">{purchase.kind === "activation" ? "Account activation" : "Credit refill"}</p><p className="mt-1 text-sm text-muted">{purchase.credits} platform credits · {purchase.provider === "paystack" ? "Paystack" : "Crypto via NOWPayments"}</p></div>
        <div className="flex items-center gap-4"><p className="text-3xl font-black tabular-nums">{new Intl.NumberFormat("en", { style: "currency", currency: purchase.currency }).format(purchase.expectedAmount / 100)}</p><span className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${paid ? "border-accent/40 bg-accent/10 text-accent" : purchase.status === "failed" ? "border-red-400/40 bg-red-400/5 text-red-200" : "border-amber-400/35 bg-amber-400/5 text-amber-200"}`}>{purchase.status}</span></div>
      </div>

      <div role="status" aria-live="polite" className={`rounded-2xl border px-5 py-4 text-sm ${paid ? "border-accent/35 bg-accent/5 text-accent" : "border-line bg-white/[.025] text-muted"}`}>{paid ? "Payment confirmed. Your credits are ready." : syncMessage}</div>
      {purchase.mode !== "live" && <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 px-5 py-4 text-sm text-amber-200">{purchase.mode === "demo" ? "Simulation only. No money is collected and only demo credits are granted." : "Provider test mode. Use sandbox funds or test cards only."}</div>}

      {purchase.status === "review" && <div className="rounded-2xl border border-amber-400/35 bg-amber-400/5 px-5 py-4 text-sm text-amber-200">This payment needs review. Partial or mismatched payments are not automatically credited. Do not send another payment without checking with support.</div>}
      {purchase.status === "failed" && <div className="rounded-2xl border border-red-400/35 bg-red-400/5 px-5 py-4 text-sm text-red-200">This payment expired or failed. Return to billing to create a new checkout.</div>}

      {canSend && purchase.provider === "nowpayments" && purchase.payAddress ? <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.7fr)]">
        <section className="surface rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-3"><PaymentCoinIcon code={coin} size={42}/><div><p className="font-bold">Send {coin.toUpperCase()}</p><p className="text-xs text-muted">{purchase.payNetwork || "BNB Smart Chain (BEP20)"}</p></div></div>
          <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm leading-relaxed text-amber-100">Use only <strong>{purchase.payNetwork || "BNB Smart Chain (BEP20)"}</strong>. Sending a different asset or network may result in lost funds. Send the full quoted amount after withdrawal fees.</div>
          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-line bg-black/15 p-4"><p className="text-xs font-bold uppercase tracking-widest text-muted">1 · Amount to send</p><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><p className="break-all font-mono text-xl font-bold">{purchase.payAmount} <span className="text-sm text-accent">{coin.toUpperCase()}</span></p><button type="button" onClick={() => void copy(purchase.payAmount, "Amount")} className="rounded-lg border border-accent/35 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/10">Copy amount</button></div></div>
            <div className="rounded-xl border border-line bg-black/15 p-4"><p className="text-xs font-bold uppercase tracking-widest text-muted">2 · Payment address</p><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><p className="min-w-0 break-all font-mono text-sm">{purchase.payAddress}</p><button type="button" onClick={() => void copy(purchase.payAddress, "Address")} className="shrink-0 rounded-lg border border-accent/35 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/10">Copy address</button></div></div>
            {purchase.payExtraId && <div className="rounded-xl border border-amber-400/35 bg-amber-400/5 p-4"><p className="text-xs font-bold uppercase tracking-widest text-amber-200"><span className="mr-2">3 ·</span><span>Required memo / destination tag</span></p><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><p className="break-all font-mono text-sm">{purchase.payExtraId}</p><button type="button" onClick={() => void copy(purchase.payExtraId, "Memo/tag")} className="shrink-0 rounded-lg border border-amber-400/35 px-3 py-1.5 text-xs font-bold text-amber-200">Copy memo/tag</button></div><p className="mt-2 text-xs text-amber-200">Include this exactly. Omitting it can prevent crediting.</p></div>}
          </div>
        </section>
        <aside className="surface rounded-2xl p-5 text-center sm:p-6"><p className="text-sm font-bold">Scan to pay</p><p className="mt-1 text-xs text-muted">Address QR code</p><div className="mx-auto mt-5 w-fit max-w-full rounded-2xl bg-white p-3"><QRCodeSVG value={purchase.payAddress} size={220} level="M" marginSize={4} title="Payment address QR code" className="h-auto max-w-full"/></div><p className="mx-auto mt-4 max-w-xs text-xs leading-relaxed text-muted">The QR contains the address only. Select the exact network and enter the amount{purchase.payExtraId ? " and required memo/tag" : ""} shown alongside. Verify before sending.</p></aside>
      </div> : null}

      {canSend && purchase.provider === "paystack" && purchase.authorizationUrl.startsWith("https://checkout.paystack.com/") && <section className="surface rounded-2xl p-6 sm:p-8"><p className="eyebrow">Continue securely</p><h2 className="mt-2 text-xl font-bold">Pay with Paystack</h2><p className="mt-2 text-sm text-muted">You’ll complete your payment on Paystack and return here to see confirmation.</p><a href={purchase.authorizationUrl} className="button-primary mt-6 inline-flex rounded-xl px-6 py-3 font-bold">Continue to Paystack ↗</a></section>}
      {!paid && purchase.mode === "demo" && <section className="surface rounded-2xl p-6"><h2 className="text-lg font-bold">Demo checkout</h2><p className="mt-2 text-sm text-muted">Preview the confirmation flow without sending a payment.</p><button type="button" disabled={busy} onClick={() => void action("simulate")} className="button-primary mt-5 rounded-xl px-5 py-3 font-bold disabled:opacity-50">{busy ? "Processing…" : `Simulate successful ${purchase.provider === "paystack" ? "Paystack" : "crypto"} payment`}</button></section>}

      <section className="surface rounded-2xl p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-bold">Payment tracking</h2><p className="mt-1 text-xs text-muted">This page checks for provider confirmation automatically.</p></div>{!paid && purchase.mode !== "demo" && <button type="button" disabled={busy} onClick={() => void action("verify")} className="rounded-lg border border-line px-3 py-2 text-xs text-muted hover:border-accent/40 hover:text-accent disabled:opacity-50">{busy ? "Refreshing…" : "Refresh now (optional)"}</button>}</div>
        {purchase.provider === "nowpayments" && purchase.mode !== "demo" && <p className="mt-4 text-xs text-muted">Provider state: {purchase.providerStatus || "waiting"}. Blockchain confirmations and provider settlement are required before credits are granted.</p>}
        <div className="mt-4 border-t border-line pt-4 text-xs text-muted"><p className="break-all">Order reference: {purchase.reference}</p>{purchase.providerPaymentId && <p className="mt-1 break-all">Provider payment ID: {purchase.providerPaymentId}</p>}{purchase.failureCode && <p className="mt-2 text-amber-200">Checkout diagnostic: {purchase.failureCode}. Contact support with this code and your reference.</p>}</div>
      </section>
      {message && <p role="status" className="rounded-xl border border-line p-3 text-sm">{message}</p>}
      {paid && <Link href="/dashboard/credits" className="button-primary inline-flex rounded-xl px-5 py-3 font-bold">View credits and receipt →</Link>}
    </>}
  </div>;
}

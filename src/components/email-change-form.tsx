"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EmailChangeRequest({ disabled = false }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false), [feedback, setFeedback] = useState(""), [failed, setFailed] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback(""); setFailed(false);
    const form = event.currentTarget, data = new FormData(form);
    try {
      const response = await fetch("/api/account/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not request email change.");
      setFeedback(result.message); form.reset();
    } catch (error) { setFailed(true); setFeedback(error instanceof Error ? error.message : "Could not request email change."); }
    finally { setBusy(false); }
  }
  return <div className="mt-6 border-t border-line pt-5"><h3 className="text-sm font-bold">Change sign-in email</h3><p className="mt-2 text-xs leading-5 text-muted">Verify the new address before it replaces your current email. Confirmation signs out all sessions.</p>{disabled ? <p className="mt-3 text-xs text-muted">Available on your own account after any required password change.</p> : <form onSubmit={submit} className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold">New email<Input name="email" type="email" autoComplete="email" maxLength={254} required className="mt-2 border-line bg-[#111a13]"/></label><label className="text-xs font-semibold">Current password<Input name="password" type="password" autoComplete="current-password" maxLength={128} required className="mt-2 border-line bg-[#111a13]"/></label><div><Button disabled={busy} className="button-secondary">{busy ? "Sending…" : "Send confirmation"}</Button></div>{feedback && <p role={failed ? "alert" : "status"} className={`text-sm md:col-span-2 ${failed ? "text-red-300" : "text-accent"}`}>{feedback}</p>}</form>}</div>;
}

export function EmailChangeConfirmation({ token }: { token?: string }) {
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState("");
  async function confirm() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/change-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not confirm email.");
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not confirm email."); }
    finally { setBusy(false); }
  }
  return <div className="w-full max-w-[440px]"><p className="eyebrow">Account security</p><h1 className="display mt-4 text-4xl">{done ? "Email updated." : "Confirm your new email."}</h1><p className="mt-4 text-sm leading-6 text-muted">{done ? "Your new email is verified. Sign in again using it and your existing password." : "Confirm only if you requested this change from your account settings. The link expires after 30 minutes."}</p>{error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}{!done && token && <Button onClick={() => void confirm()} disabled={busy} className="button-primary mt-6">{busy ? "Confirming…" : "Confirm email change"}</Button>}<Link className="mt-6 block text-sm font-bold text-accent" href={done ? "/login" : "/dashboard/settings"}>{done ? "Sign in" : "Back to settings"}</Link></div>;
}

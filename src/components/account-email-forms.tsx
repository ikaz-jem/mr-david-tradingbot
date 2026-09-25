"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Please try again later.");
  return result;
}

export function VerifyEmailForm({ token, email }: { token?: string; email?: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    try {
      if (token) { await postJson("/api/auth/verify-email", { token }); setDone(true); }
      else { const form = new FormData(event.currentTarget); const result = await postJson("/api/auth/resend-verification", { email: String(form.get("email")) }); setMessage(result.message); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setPending(false); }
  }
  return <div className="w-full max-w-[440px]"><div className="mb-6 flex size-12 items-center justify-center rounded-xl border border-[#5e7d45] bg-[#c5ff4114] text-accent"><MailCheck className="size-6"/></div><p className="eyebrow">Secure your workspace</p><h1 className="display mt-4 text-4xl sm:text-5xl">{done ? "Email confirmed." : token ? "Confirm your email." : "Check your inbox."}</h1><p className="mt-5 text-base leading-7 text-muted">{done ? "Your account is ready. Sign in to continue." : token ? "Confirm this email address to activate your Enrivea Signal account." : "We sent a verification link if your account needs one. You can request another below."}</p>{done ? <Link href="/login" className="button-primary mt-8 inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm">Continue to sign in <ArrowRight className="size-4"/></Link> : <form className="mt-9 space-y-4" onSubmit={submit}>{!token && <div><label className="mb-2 block text-sm font-bold" htmlFor="email">Email address</label><Input id="email" name="email" type="email" defaultValue={email} required autoComplete="email" className="h-12 rounded-xl border-[#3b4b40] bg-[#151e17] text-white"/></div>}{message && <p role="status" className="rounded-lg border border-[#4d6843] bg-[#c5ff4110] p-3 text-sm text-[#d2e8ca]">{message}</p>}<Button type="submit" disabled={pending} className="button-primary h-12 w-full rounded-xl text-sm">{pending ? "Working…" : token ? "Verify email" : "Resend verification"}</Button></form>}<p className="mt-7 text-sm text-muted"><Link href="/login" className="font-bold text-accent hover:underline">Back to sign in</Link></p></div>;
}

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    try { const form = new FormData(event.currentTarget); const result = await postJson("/api/auth/forgot-password", { email: String(form.get("email")) }); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setPending(false); }
  }
  return <div className="w-full max-w-[440px]"><p className="eyebrow">Account recovery</p><h1 className="display mt-4 text-4xl sm:text-5xl">Reset your password.</h1><p className="mt-5 text-base leading-7 text-muted">Enter your account email. If it matches a verified account, we&apos;ll send a one-time reset link.</p><form className="mt-9 space-y-4" onSubmit={submit}><div><label className="mb-2 block text-sm font-bold" htmlFor="email">Email address</label><Input id="email" name="email" type="email" required autoComplete="email" className="h-12 rounded-xl border-[#3b4b40] bg-[#151e17] text-white"/></div>{message && <p role="status" className="rounded-lg border border-[#4d6843] bg-[#c5ff4110] p-3 text-sm text-[#d2e8ca]">{message}</p>}<Button type="submit" disabled={pending} className="button-primary h-12 w-full rounded-xl text-sm">{pending ? "Sending…" : "Send reset link"}</Button></form><p className="mt-7 text-sm text-muted"><Link href="/login" className="font-bold text-accent hover:underline">Back to sign in</Link></p></div>;
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    try { const form = new FormData(event.currentTarget); await postJson("/api/auth/reset-password", { token, password: String(form.get("password")) }); setDone(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setPending(false); }
  }
  return <div className="w-full max-w-[440px]"><p className="eyebrow">Account recovery</p><h1 className="display mt-4 text-4xl sm:text-5xl">{done ? "Password updated." : "Choose a new password."}</h1><p className="mt-5 text-base leading-7 text-muted">{done ? "Your old sessions have been invalidated. Sign in with your new password." : "Use at least 12 characters. This reset link works only once."}</p>{done ? <Link href="/login" className="button-primary mt-8 inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm">Sign in <ArrowRight className="size-4"/></Link> : token ? <form className="mt-9 space-y-4" onSubmit={submit}><div><label className="mb-2 block text-sm font-bold" htmlFor="password">New password</label><Input id="password" name="password" type="password" minLength={12} required autoComplete="new-password" className="h-12 rounded-xl border-[#3b4b40] bg-[#151e17] text-white"/></div>{message && <p role="alert" className="rounded-lg border border-[#b8464b] bg-[#b8464b20] p-3 text-sm text-[#ffb5b8]">{message}</p>}<Button type="submit" disabled={pending} className="button-primary h-12 w-full rounded-xl text-sm">{pending ? "Saving…" : "Set new password"}</Button></form> : <p className="mt-8 text-sm text-[#ffb5b8]">This reset link is missing. <Link href="/forgot-password" className="text-accent underline">Request a new one</Link>.</p>}</div>;
}

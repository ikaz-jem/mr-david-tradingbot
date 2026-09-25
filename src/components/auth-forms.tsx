"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ demoEnabled = false }: { demoEnabled?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await signIn("credentials", { email: String(form.get("email")), password: String(form.get("password")), redirect: false });
      if (!result?.ok) { setError("That email and password did not match."); return; }
      router.push("/dashboard"); router.refresh();
    } catch { setError("Sign in is unavailable right now."); } finally { setPending(false); }
  }
  async function startDemo(role: "user" | "admin") {
    setError(""); setPending(true);
    try {
      const result = await signIn("credentials", { demoRole: role, redirect: false });
      if (!result?.ok) { setError("Demo sign-in is unavailable."); return; }
      router.push(role === "admin" ? "/admin" : "/dashboard"); router.refresh();
    } catch { setError("Demo sign-in is unavailable."); } finally { setPending(false); }
  }
  return <div className="w-full max-w-[440px]"><p className="eyebrow">Welcome back</p><h1 className="display mt-4 text-4xl sm:text-5xl">Sign in to your<br/><span className="text-accent">workspace.</span></h1><p className="mt-4 text-base text-muted">Your research, trades, and performance in one place.</p>{demoEnabled && <div className="mt-7 rounded-2xl border border-[#6e873f] bg-[#1b2a19] p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-accent">Local preview only</p><p className="mt-2 text-sm leading-6 text-muted">Explore both dashboards with temporary demo accounts. No live orders, charges, or AI results are created.</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={pending} onClick={() => startDemo("user")} className="button-secondary rounded-lg px-3 py-2.5 text-xs font-bold disabled:opacity-50">Demo user</button><button type="button" disabled={pending} onClick={() => startDemo("admin")} className="button-primary rounded-lg px-3 py-2.5 text-xs font-bold disabled:opacity-50">Demo admin</button></div></div>}<form className="mt-10 space-y-5" onSubmit={submit}><Field label="Email address" name="email" type="email" autoComplete="email"/><div><label htmlFor="password" className="mb-2 block text-sm font-bold">Password</label><div className="relative"><Input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="h-12 rounded-xl border-[#3b4b40] bg-[#151e17] pr-12 text-white"/><button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-3 text-muted" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff className="size-5"/> : <Eye className="size-5"/>}</button></div></div>{error && <p role="alert" className="rounded-lg border border-[#b8464b] bg-[#b8464b20] p-3 text-sm text-[#ffb5b8]">{error} <Link href="/verify-email" className="text-accent underline">Verify email</Link></p>}<div className="text-right"><Link href="/forgot-password" className="text-sm font-bold text-accent hover:underline">Forgot password?</Link></div><Button disabled={pending} type="submit" className="button-primary h-12 w-full rounded-xl text-sm">{pending ? "Signing in…" : "Sign in"}<ArrowRight className="ml-2 size-4"/></Button></form><p className="mt-7 text-center text-sm text-muted">New to Enrivea Signal? <Link href="/register" className="font-bold text-accent hover:underline">Create an account</Link></p></div>;
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    const form = new FormData(event.currentTarget);
    const data = { name: String(form.get("name")), email: String(form.get("email")), password: String(form.get("password")) };
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const payload = await response.json();
      if (!response.ok) { setError(payload.error ?? "We couldn't create your account."); return; }
      if (payload.verificationRequired) { router.push(`/verify-email?email=${encodeURIComponent(data.email)}`); return; }
      const signedIn = await signIn("credentials", { email: data.email, password: data.password, redirect: false });
      if (!signedIn?.ok) { router.push("/login"); return; }
      router.push("/dashboard"); router.refresh();
    } catch { setError("Registration is unavailable right now."); } finally { setPending(false); }
  }
  return <div className="w-full max-w-[440px]"><p className="eyebrow">Create your workspace</p><h1 className="display mt-4 text-4xl sm:text-5xl">Start with a<br/><span className="text-accent">clearer view.</span></h1><p className="mt-4 text-base text-muted">Create an account and get five welcome analysis credits.</p><form className="mt-9 space-y-4" onSubmit={submit}><Field label="Full name" name="name" autoComplete="name"/><Field label="Email address" name="email" type="email" autoComplete="email"/><Field label="Password" name="password" type="password" autoComplete="new-password" minLength={12}/><p className="text-xs leading-5 text-muted">Use at least 12 characters. By continuing, you agree to the draft <Link className="text-accent underline" href="/terms">terms</Link> and <Link className="text-accent underline" href="/privacy">privacy policy</Link>.</p>{error && <p role="alert" className="rounded-lg border border-[#b8464b] bg-[#b8464b20] p-3 text-sm text-[#ffb5b8]">{error}</p>}<Button disabled={pending} type="submit" className="button-primary h-12 w-full rounded-xl text-sm">{pending ? "Creating account…" : "Create account"}<ArrowRight className="ml-2 size-4"/></Button></form><p className="mt-6 text-center text-sm text-muted">Already have an account? <Link href="/login" className="font-bold text-accent hover:underline">Sign in</Link></p></div>;
}

function Field({ label, name, type = "text", autoComplete, minLength }: { label: string; name: string; type?: string; autoComplete: string; minLength?: number }) { return <div><label htmlFor={name} className="mb-2 block text-sm font-bold">{label}</label><Input id={name} name={name} type={type} autoComplete={autoComplete} minLength={minLength} required className="h-12 rounded-xl border-[#3b4b40] bg-[#151e17] text-white"/></div>; }

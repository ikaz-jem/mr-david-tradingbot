"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { AlertCircle, Bell, Check, ChevronRight, CircleUserRound, Database, Download, Eye, KeyRound, Laptop, LockKeyhole, LogOut, MonitorCog, ShieldCheck, SlidersHorizontal, Trash2, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scanIntervals, scanSymbols } from "@/lib/scan-markets";

type Settings = {
  timezone: string; locale: "en"; defaultSymbol: (typeof scanSymbols)[number]; defaultInterval: (typeof scanIntervals)[number];
  riskProfile: "conservative" | "balanced" | "aggressive"; compactMode: boolean; reducedMotion: boolean;
  inAppResearch: boolean; inAppBilling: boolean; inAppExchange: boolean; emailResearch: boolean; emailBilling: boolean; emailSecurity: boolean;
};
type Props = { name: string; email: string; country: string; role: string; isDemo: boolean; mustChangePassword?: boolean; createdAt: string; lastPasswordChangedAt: string | null; connectionCount: number; settings: Settings };
type Feedback = { kind: "success" | "error"; message: string };
const input = "mt-2 h-11 w-full rounded-xl border border-line bg-[#111a13] px-3 text-sm text-white";
const timezones = ["UTC", "Africa/Casablanca", "Africa/Lagos", "Europe/London", "Europe/Paris", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo"];

export function AccountSettingsForms(props: Props) {
  const [profileName, setProfileName] = useState(props.name);
  const [savedName, setSavedName] = useState(props.name);
  const [preferences, setPreferences] = useState(props.settings);
  const [savedPreferences, setSavedPreferences] = useState(props.settings);
  const [status, setStatus] = useState<Record<string, Feedback | undefined>>({});
  const [toast, setToast] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState("");
  const [dangerOpen, setDangerOpen] = useState(false);
  const setMessage = (key: string, value: string, kind: Feedback["kind"] = "success") => {
    setStatus(current => ({ ...current, [key]: value ? { kind, message: value } : undefined }));
    if (value) setToast({ kind, message: value });
  };

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("profile"); setMessage("profile", "");
    try {
      const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: profileName }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not save your profile.");
      setSavedName(result.name); setMessage("profile", "Profile changes saved.");
    } catch (error) { setMessage("profile", error instanceof Error ? error.message : "Could not save your profile.", "error"); }
    finally { setBusy(""); }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("preferences"); setMessage("preferences", "");
    try {
      const response = await fetch("/api/account/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preferences) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not save preferences.");
      setPreferences(result.settings); setSavedPreferences(result.settings); setMessage("preferences", "Changes saved and applied across your workspace.");
      const workspace = document.querySelector(".workspace-experience");
      workspace?.classList.toggle("workspace-compact", Boolean(result.settings.compactMode));
      workspace?.classList.toggle("workspace-reduced-motion", Boolean(result.settings.reducedMotion));
    } catch (error) { setMessage("preferences", error instanceof Error ? error.message : "Could not save preferences.", "error"); }
    finally { setBusy(""); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("password"); setMessage("password", "");
    const form = event.currentTarget; const data = new FormData(form);
    if (data.get("newPassword") !== data.get("confirmPassword")) { setMessage("password", "New passwords do not match.", "error"); setBusy(""); return; }
    try {
      const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not change your password."); form.reset();
      if (result.simulated) { setMessage("password", "Demo password saved. One-click demo access remains available."); return; }
      setMessage("password", "Password updated. Signing out every session…"); await signOut({ callbackUrl: "/login" });
    } catch (error) { setMessage("password", error instanceof Error ? error.message : "Could not change your password.", "error"); }
    finally { setBusy(""); }
  }

  async function revokeSessions() {
    setBusy("sessions"); setMessage("sessions", "");
    try {
      const response = await fetch("/api/account/sessions", { method: "DELETE" }); const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not revoke sessions.");
      if (result.simulated) { setMessage("sessions", "Demo session revocation completed in simulation."); return; }
      await signOut({ callbackUrl: "/login" });
    } catch (error) { setMessage("sessions", error instanceof Error ? error.message : "Could not revoke sessions.", "error"); }
    finally { setBusy(""); }
  }

  async function closeAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("close"); setMessage("close", ""); const form = event.currentTarget; const data = new FormData(form);
    try {
      const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: data.get("password"), confirmation: data.get("confirmation") }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not close the account.");
      if (result.simulated) { form.reset(); setMessage("close", "Demo account closure completed in simulation. Shared demo access remains available."); return; }
      await signOut({ callbackUrl: "/" });
    } catch (error) { setMessage("close", error instanceof Error ? error.message : "Could not close the account.", "error"); }
    finally { setBusy(""); }
  }

  const preferencesDirty = JSON.stringify(preferences) !== JSON.stringify(savedPreferences);
  return <><div className="grid items-start gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
    <aside className="surface sticky top-24 hidden rounded-[20px] p-3 xl:block"><p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[.18em] text-muted">Account settings</p>{[
      ["profile", CircleUserRound, "Profile"], ["preferences", SlidersHorizontal, "Preferences"], ["notifications", Bell, "Notifications"], ["security", ShieldCheck, "Security"], ["data", Database, "Data & privacy"],
    ].map(([href, Icon, label]) => <a key={String(href)} href={`#${href}`} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted hover:bg-white/5 hover:text-white"><Icon className="size-4 text-accent"/>{String(label)}</a>)}</aside>
    <div className="min-w-0 space-y-5">
      {props.mustChangePassword && <div role="alert" className="rounded-[20px] border border-accent/45 bg-accent/10 p-5"><p className="font-bold text-accent">Secure this account before continuing</p><p className="mt-2 text-sm leading-6 text-muted">Set a unique password of at least 12 characters. Other administrator operations remain unavailable until this is complete.</p></div>}
      <div className="grid gap-4 sm:grid-cols-3"><Summary icon={<CircleUserRound/>} label="Account" value={props.role}/><Summary icon={<WalletCards/>} label="Exchange connections" value={String(props.connectionCount)}/><Summary icon={<Laptop/>} label="Member since" value={new Date(props.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}/></div>

      <Section id="profile" icon={<CircleUserRound/>} title="Profile" description="Personal information shown throughout your workspace.">
        <form onSubmit={updateProfile} className="grid gap-5 md:grid-cols-2"><Field label="Display name"><Input value={profileName} onChange={event => setProfileName(event.target.value)} minLength={2} maxLength={100} className="mt-2 h-11 border-line bg-[#111a13]"/></Field><Field label="Email address"><Input value={props.email} readOnly className="mt-2 h-11 border-line bg-[#111a13] text-muted"/><small className="mt-2 block text-muted">Your verified sign-in and security email.</small></Field><Field label="Verified billing country"><Input value={props.country || "Not verified"} readOnly className="mt-2 h-11 border-line bg-[#111a13] text-muted"/><small className="mt-2 block text-muted">Country changes require compliance review. <Link href="/dashboard/support" className="text-accent">Contact support</Link>.</small></Field><div className="flex items-end"><Button disabled={busy === "profile" || profileName.trim() === savedName || profileName.trim().length < 2 || props.mustChangePassword} className="bg-accent text-black">{busy === "profile" ? "Saving…" : "Save profile"}</Button></div>{status.profile && <Status feedback={status.profile}/>}</form>
      </Section>

      <Section id="preferences" icon={<SlidersHorizontal/>} title="Workspace preferences" description="Defaults that make research faster and easier to read.">
        <form onSubmit={savePreferences}><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"><Select label="Default market" value={preferences.defaultSymbol} onChange={value => setPreferences({ ...preferences, defaultSymbol: value as Settings["defaultSymbol"] })}>{scanSymbols.map(value => <option key={value} value={value}>{value.replace("USDT", "/USDT")}</option>)}</Select><Select label="Default candle" value={preferences.defaultInterval} onChange={value => setPreferences({ ...preferences, defaultInterval: value as Settings["defaultInterval"] })}>{scanIntervals.map(value => <option key={value}>{value}</option>)}</Select><Select label="Risk posture" value={preferences.riskProfile} onChange={value => setPreferences({ ...preferences, riskProfile: value as Settings["riskProfile"] })}><option value="conservative">Conservative</option><option value="balanced">Balanced</option><option value="aggressive">Aggressive</option></Select><Select label="Timezone" value={preferences.timezone} onChange={value => setPreferences({ ...preferences, timezone: value })}>{[...new Set([preferences.timezone, ...timezones])].map(value => <option key={value}>{value}</option>)}</Select><Select label="Language" value={preferences.locale} onChange={() => undefined}><option value="en">English</option></Select></div><div className="mt-6 grid gap-3 md:grid-cols-2"><Toggle checked={preferences.compactMode} onChange={checked => setPreferences({ ...preferences, compactMode: checked })} title="Compact data tables" text="Fit more market rows and history on screen."/><Toggle checked={preferences.reducedMotion} onChange={checked => setPreferences({ ...preferences, reducedMotion: checked })} title="Reduce motion" text="Use calmer transitions throughout the workspace."/></div><Button disabled={busy === "preferences" || !preferencesDirty || props.mustChangePassword} className="mt-6 bg-accent text-black">{busy === "preferences" ? "Saving…" : preferencesDirty ? "Save preferences" : "No changes to save"}</Button>{status.preferences && <Status feedback={status.preferences}/>}</form>
      </Section>

      <Section id="notifications" icon={<Bell/>} title="Notification preferences" description="Choose where product updates reach you. Critical security messages cannot be disabled.">
        <form onSubmit={savePreferences} className="space-y-6"><PreferenceGroup title="In-app notifications"><Toggle checked={preferences.inAppResearch} onChange={checked => setPreferences({ ...preferences, inAppResearch: checked })} title="Research activity" text="Completed scans, trade ideas, and failed runs."/><Toggle checked={preferences.inAppBilling} onChange={checked => setPreferences({ ...preferences, inAppBilling: checked })} title="Billing & credits" text="Activations, refills, and credit adjustments."/><Toggle checked={preferences.inAppExchange} onChange={checked => setPreferences({ ...preferences, inAppExchange: checked })} title="Exchange connections" text="Connection, permission, and health events."/></PreferenceGroup><PreferenceGroup title="Email notifications"><Toggle checked={preferences.emailResearch} onChange={checked => setPreferences({ ...preferences, emailResearch: checked })} title="Research summaries" text="Important scanner and product updates."/><Toggle checked={preferences.emailBilling} onChange={checked => setPreferences({ ...preferences, emailBilling: checked })} title="Billing receipts" text="Payment and credit confirmations."/><Toggle checked={preferences.emailSecurity} onChange={checked => setPreferences({ ...preferences, emailSecurity: checked })} title="Security alerts" text="Password and sensitive account events." locked/></PreferenceGroup><Button disabled={busy === "preferences" || !preferencesDirty || props.mustChangePassword} className="bg-accent text-black">{busy === "preferences" ? "Saving…" : preferencesDirty ? "Save notification settings" : "No changes to save"}</Button>{status.preferences && <Status feedback={status.preferences}/>}</form>
      </Section>

      <Section id="security" icon={<ShieldCheck/>} title="Password & security" description="Protect access to your account and connected exchange data.">
        <div className="grid gap-6 lg:grid-cols-2"><form onSubmit={changePassword} className="rounded-2xl border border-line p-5"><div className="flex items-center gap-3"><KeyRound className="size-5 text-accent"/><h3 className="font-bold">Change password</h3></div><p className="mt-2 text-xs leading-5 text-muted">{props.isDemo ? "Use DemoPassword123! as the current password. Changes remain inside the demo workspace." : "At least 12 characters. A change invalidates all existing sessions."}</p><Input name="currentPassword" type="password" autoComplete="current-password" required placeholder="Current password" className={input}/><Input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required placeholder="New password" className={input}/><Input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required placeholder="Confirm new password" className={input}/><Button disabled={busy === "password"} className="mt-4 bg-accent text-black">{busy === "password" ? "Updating…" : "Change password"}</Button>{status.password && <Status feedback={status.password}/>}</form><div className="rounded-2xl border border-line p-5"><div className="flex items-center gap-3"><MonitorCog className="size-5 text-accent"/><h3 className="font-bold">Sessions</h3></div><p className="mt-3 text-sm leading-6 text-muted">Signed in on a device you no longer use? Revoke every active session and sign in again on trusted devices.</p><p className="mt-4 text-xs text-muted">Password last changed: {props.lastPasswordChangedAt ? new Date(props.lastPasswordChangedAt).toLocaleString() : "No recorded change"}</p><Button type="button" onClick={() => void revokeSessions()} disabled={busy === "sessions"} className="button-secondary mt-5"><LogOut className="mr-2 size-4"/>{busy === "sessions" ? "Revoking…" : "Sign out all sessions"}</Button>{status.sessions && <Status feedback={status.sessions}/>}</div></div>
      </Section>

      <Section id="data" icon={<Database/>} title="Data & privacy" description="Control your data, cookies, connected services, and account lifecycle.">
        <div className="divide-y divide-line"><ActionRow icon={<Download/>} title="Download your data" text="Export your profile, connections metadata, research, billing, notifications, and support history." action={<a href="/api/account/export" className="button-secondary rounded-xl px-4 py-2.5 text-xs font-bold">Download JSON</a>}/><ActionRow icon={<Eye/>} title="Cookie preferences" text="Review optional analytics consent on this device." action={<button type="button" className="button-secondary rounded-xl px-4 py-2.5 text-xs font-bold" onClick={() => { localStorage.removeItem("enrivea_signal_cookie_choice"); window.dispatchEvent(new Event("enrivea-cookie-choice")); }}>Review cookies</button>}/><ActionRow icon={<LockKeyhole/>} title="Connected exchanges" text={`${props.connectionCount} connection${props.connectionCount === 1 ? "" : "s"}. API credentials can be removed at any time.`} action={<Link href="/dashboard/exchanges" className="button-secondary inline-flex items-center rounded-xl px-4 py-2.5 text-xs font-bold">Manage <ChevronRight className="ml-1 size-4"/></Link>}/></div>
        <div className="mt-6 rounded-2xl border border-red-400/25 bg-red-400/[.04] p-5"><div className="flex items-start gap-3"><Trash2 className="mt-0.5 size-5 text-red-300"/><div><h3 className="font-bold">Close account</h3><p className="mt-2 text-sm leading-6 text-muted">Disables login immediately and permanently removes stored exchange API credentials. Billing and audit records may be retained where legally required.</p></div></div>{!dangerOpen ? <button type="button" onClick={() => setDangerOpen(true)} className="mt-4 text-xs font-bold text-red-300">Start account closure</button> : <form onSubmit={closeAccount} className="mt-5 grid gap-3 sm:grid-cols-2"><Input name="password" type="password" required placeholder="Current password" className="border-red-400/30 bg-[#111a13]"/><Input name="confirmation" required pattern="CLOSE" placeholder="Type CLOSE" className="border-red-400/30 bg-[#111a13]"/><div className="flex gap-3 sm:col-span-2"><Button disabled={busy === "close"} className="bg-red-500 text-white hover:bg-red-400">{busy === "close" ? "Closing…" : "Close account permanently"}</Button><Button type="button" onClick={() => setDangerOpen(false)} className="button-secondary">Cancel</Button></div>{status.close && <Status feedback={status.close}/>}</form>}</div>
      </Section>
      {props.isDemo && <p className="rounded-xl border border-accent/25 bg-accent/5 p-4 text-xs leading-5 text-muted">Demo workspace: settings behave like the production controls, while password, session, and account-closure actions are safely simulated. Do not enter private information.</p>}
    </div>
  </div>{toast && <Toast feedback={toast} onClose={() => setToast(null)}/>}</>;
}

function Section({ id, icon, title, description, children }: { id: string; icon: ReactNode; title: string; description: string; children: ReactNode }) { return <section id={id} className="surface scroll-mt-24 rounded-[20px] p-5 sm:p-6"><div className="mb-6 flex items-start gap-4 border-b border-line pb-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent [&>svg]:size-5">{icon}</span><div><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm leading-6 text-muted">{description}</p></div></div>{children}</section>; }
function Summary({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="surface rounded-2xl p-4"><span className="text-accent [&>svg]:size-4">{icon}</span><p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-muted">{label}</p><p className="mt-1 truncate text-sm font-bold capitalize">{value}</p></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-semibold">{label}{children}</label>; }
function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) { return <label className="text-sm font-semibold">{label}<select value={value} onChange={event => onChange(event.target.value)} className={input}>{children}</select></label>; }
function Toggle({ checked, onChange, title, text, locked = false }: { checked: boolean; onChange: (value: boolean) => void; title: string; text: string; locked?: boolean }) { return <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-[#111a13] p-4"><span><span className="block text-sm font-bold">{title}{locked && <LockKeyhole className="ml-2 inline size-3 text-accent"/>}</span><span className="mt-1 block text-xs leading-5 text-muted">{text}</span></span><input type="checkbox" checked={checked} disabled={locked} onChange={event => onChange(event.target.checked)} className="peer sr-only"/><span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-[#344038] transition peer-checked:bg-accent peer-disabled:opacity-60 after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"/></label>; }
function PreferenceGroup({ title, children }: { title: string; children: ReactNode }) { return <div><h3 className="mb-3 text-xs font-black uppercase tracking-widest text-muted">{title}</h3><div className="grid gap-3 md:grid-cols-2">{children}</div></div>; }
function ActionRow({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action: ReactNode }) { return <div className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center"><span className="text-accent [&>svg]:size-5">{icon}</span><div className="min-w-0 flex-1"><h3 className="font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-muted">{text}</p></div><div className="shrink-0">{action}</div></div>; }
function Status({ feedback }: { feedback: Feedback }) { const Icon = feedback.kind === "success" ? Check : AlertCircle; return <p role={feedback.kind === "error" ? "alert" : "status"} className={`mt-3 text-sm md:col-span-2 ${feedback.kind === "success" ? "text-accent" : "text-red-300"}`}><Icon className="mr-1 inline size-4"/>{feedback.message}</p>; }
function Toast({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) { const Icon = feedback.kind === "success" ? Check : AlertCircle; return <div role={feedback.kind === "error" ? "alert" : "status"} aria-live="polite" className={`fixed bottom-5 right-5 z-[80] flex max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${feedback.kind === "success" ? "border-accent/40 bg-[#172519]/95 text-white" : "border-red-400/40 bg-[#2a1517]/95 text-red-50"}`}><span className={`grid size-8 shrink-0 place-items-center rounded-full ${feedback.kind === "success" ? "bg-accent text-black" : "bg-red-400/15 text-red-300"}`}><Icon className="size-4"/></span><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-widest">{feedback.kind === "success" ? "Changes saved" : "Could not save"}</p><p className="mt-1 text-sm leading-5 text-muted">{feedback.message}</p></div><button type="button" onClick={onClose} aria-label="Dismiss message" className="rounded-lg p-1 text-muted hover:bg-white/10 hover:text-white"><X className="size-4"/></button></div>; }

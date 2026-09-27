"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AccountSettingsForms({ name, email, isDemo }: { name: string; email: string; isDemo: boolean }) {
  const router = useRouter();
  const [profileName, setProfileName] = useState(name);
  const [profileStatus, setProfileStatus] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setProfileStatus("");
    try {
      const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: profileName }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save your profile.");
      setProfileStatus("Profile saved."); router.refresh();
    } catch (error) { setProfileStatus(error instanceof Error ? error.message : "Could not save your profile."); }
    finally { setSaving(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setChanging(true); setPasswordStatus("");
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get("newPassword") !== data.get("confirmPassword")) { setPasswordStatus("New passwords do not match."); setChanging(false); return; }
    try {
      const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not change your password.");
      form.reset(); setPasswordStatus("Password updated. Signing you out of all sessions…");
      await signOut({ callbackUrl: "/login" });
    } catch (error) { setPasswordStatus(error instanceof Error ? error.message : "Could not change your password."); }
    finally { setChanging(false); }
  }

  return <div className="grid gap-5 xl:grid-cols-2"><form onSubmit={updateProfile} className="surface rounded-[20px] p-6"><h2 className="text-xl font-bold">Profile</h2><p className="mt-2 text-sm text-muted">Your public display name and sign-in email.</p><label className="mt-6 block text-sm font-semibold" htmlFor="account-name">Display name</label><Input id="account-name" value={profileName} onChange={event => setProfileName(event.target.value)} minLength={2} maxLength={100} disabled={isDemo} className="mt-2 h-11 border-line bg-[#111a13]"/><label className="mt-5 block text-sm font-semibold" htmlFor="account-email">Email address</label><Input id="account-email" value={email} readOnly className="mt-2 h-11 border-line bg-[#111a13] text-muted"/><p className="mt-2 text-xs text-muted">Email changes require a verified change workflow and are not available yet.</p><Button disabled={isDemo || saving || profileName.trim() === name} className="mt-6 bg-accent text-[#101810] hover:bg-[#dcff88]">{saving ? "Saving…" : "Save profile"}</Button>{isDemo && <p className="mt-3 text-xs text-muted">Demo profiles cannot be edited.</p>}{profileStatus && <p role="status" className="mt-3 text-sm text-accent">{profileStatus}</p>}</form><form onSubmit={changePassword} className="surface rounded-[20px] p-6"><h2 className="text-xl font-bold">Password & sessions</h2><p className="mt-2 text-sm text-muted">Changing your password signs out every existing session, including this one.</p><label className="mt-6 block text-sm font-semibold" htmlFor="current-password">Current password</label><Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required disabled={isDemo} className="mt-2 h-11 border-line bg-[#111a13]"/><label className="mt-4 block text-sm font-semibold" htmlFor="new-password">New password</label><Input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={isDemo} className="mt-2 h-11 border-line bg-[#111a13]"/><label className="mt-4 block text-sm font-semibold" htmlFor="confirm-password">Confirm new password</label><Input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={isDemo} className="mt-2 h-11 border-line bg-[#111a13]"/><Button disabled={isDemo || changing} className="mt-6 bg-accent text-[#101810] hover:bg-[#dcff88]">{changing ? "Updating…" : "Change password"}</Button>{passwordStatus && <p role="status" className="mt-3 text-sm text-accent">{passwordStatus}</p>}</form></div>;
}

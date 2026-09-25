"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Config = { registrationOpen: boolean; scansOpen: boolean; announcement: string };

export function AdminPlatformControls({ config }: { config: Config }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState(config.announcement);
  async function change(field: keyof Config, value: boolean | string) {
    const reason = window.prompt(`Why are you changing ${field}? This reason will be retained in the audit log.`);
    if (reason === null) return;
    if (reason.trim().length < 8) { setMessage("Enter an audit reason of at least 8 characters."); return; }
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/admin/controls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field, value, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Change failed.");
      setMessage("Control updated and recorded in the audit trail.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Change failed."); }
    finally { setPending(false); }
  }
  return <div className="space-y-4">
    <Control title="New registrations" detail="Pause creation of new user accounts without affecting existing sessions." active={config.registrationOpen} pending={pending} onClick={() => change("registrationOpen", !config.registrationOpen)}/>
    <Control title="AI research scans" detail="Stop new scan requests before any credit is charged. Existing records remain visible." active={config.scansOpen} pending={pending} onClick={() => change("scansOpen", !config.scansOpen)}/>
    <div className="rounded-xl border border-line bg-[#141e17] p-4"><label htmlFor="platform-announcement" className="text-sm font-bold">Workspace announcement</label><p className="mt-1 text-xs text-muted">Shown to signed-in users. Keep it factual and under 180 characters.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input id="platform-announcement" maxLength={180} value={announcement} onChange={event => setAnnouncement(event.target.value)} placeholder="No announcement" className="min-w-0 flex-1 rounded-lg border border-line bg-[#0e1510] px-3 py-2 text-sm text-white"/><button disabled={pending || announcement === config.announcement} onClick={() => change("announcement", announcement)} className="button-secondary rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-40">Save message</button></div></div>
    {message && <p role="status" className="text-xs text-[#d5efaa]">{message}</p>}
  </div>;
}

function Control({ title, detail, active, pending, onClick }: { title: string; detail: string; active: boolean; pending: boolean; onClick: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-[#141e17] p-4"><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-xs text-muted">{detail}</p></div><button disabled={pending} onClick={onClick} aria-label={`${title}: ${active ? "enabled" : "paused"}. Click to ${active ? "pause" : "resume"}.`} className={`min-w-28 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40 ${active ? "border-[#5c7c38] bg-[#c5ff4118] text-accent" : "border-[#9c644f] bg-[#ae694018] text-[#f6b795]"}`}>{active ? "Active · Pause" : "Paused · Resume"}</button></div>;
}

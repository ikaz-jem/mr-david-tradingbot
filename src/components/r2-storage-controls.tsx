"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = { accountId: string; bucketName: string; configured: boolean; source: "dashboard" | "deployment" | "unset"; encryptionReady: boolean; demo: boolean };
const field = "mt-2 block h-11 w-full rounded-xl border border-line bg-[#0e1510] px-3 text-sm text-white";
export function R2StorageControls({ initial, canUpdate }: { initial: Status; canUpdate: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [values, setValues] = useState({ accountId: initial.accountId ?? "", bucketName: initial.bucketName ?? "", accessKeyId: "", secretAccessKey: "" });
  const [reason, setReason] = useState(initial.demo ? "Interactive demo storage configuration" : "");
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  async function submit(action: "test" | "save" | "clear") {
    if (action === "clear" && !window.confirm("Remove the dashboard R2 override? Existing images must still be accessible through the deployment configuration.")) return;
    setPending(action); setMessage(null);
    try {
      const response = await fetch("/api/admin/storage-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...values, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Storage settings could not be updated.");
      if (result.status) {
        setStatus(result.status);
        setValues({ accountId: result.status.accountId ?? "", bucketName: result.status.bucketName ?? "", accessKeyId: "", secretAccessKey: "" });
        setReason(initial.demo ? "Interactive demo storage configuration" : "");
        router.refresh();
      }
      setMessage({ text: action === "test" ? "Connection verified: upload, read, and delete all worked. Nothing was saved." : action === "save" ? "R2 settings saved. Help Center images now use this storage." : "Dashboard override removed.", error: false });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : "Storage operation failed.", error: true }); }
    finally { setPending(""); }
  }
  const credentialsReady = Boolean(values.accountId && values.bucketName && values.accessKeyId && values.secretAccessKey);
  return <div className="space-y-6">
    <div className="rounded-xl border border-accent/25 bg-accent/5 p-4 text-sm leading-6 text-muted">
      <p className="font-semibold text-white">{status.demo ? "Demo storage scope" : "Live storage scope"} · {status.configured ? "Configured" : "Not configured"} · {status.source}</p>
      <p className="mt-1">Images stay in a private R2 bucket. The app serves only published live images publicly; draft and demo images require staff access. Credentials are encrypted and never displayed after saving. Enter all four fields to verify or replace a connection.</p>
    </div>
    {!status.encryptionReady && <p role="alert" className="rounded-xl border border-amber-500/40 p-4 text-sm text-amber-200">Configure SERVICE_CONFIG_ENCRYPTION_KEY or a strong NEXTAUTH_SECRET in the deployment first. This bootstrap secret cannot safely be managed from this page.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Cloudflare account ID<input autoComplete="off" value={values.accountId} onChange={event => setValues(current => ({ ...current, accountId: event.target.value }))} placeholder="32-character account ID" className={field}/></label>
      <label className="text-sm font-semibold">R2 bucket name<input autoComplete="off" value={values.bucketName} onChange={event => setValues(current => ({ ...current, bucketName: event.target.value }))} placeholder="Private image bucket" className={field}/></label>
      <label className="text-sm font-semibold">Access key ID<input type="password" autoComplete="new-password" value={values.accessKeyId} onChange={event => setValues(current => ({ ...current, accessKeyId: event.target.value }))} placeholder="Enter to test or save" className={field}/></label>
      <label className="text-sm font-semibold">Secret access key<input type="password" autoComplete="new-password" value={values.secretAccessKey} onChange={event => setValues(current => ({ ...current, secretAccessKey: event.target.value }))} placeholder="Enter to test or save" className={field}/></label>
    </div>
    <label className="block text-sm font-semibold">Reason for change<input value={reason} onChange={event => setReason(event.target.value)} maxLength={300} placeholder="Required to save or remove (at least 8 characters)" className={field}/></label>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={!canUpdate || !status.encryptionReady || !credentialsReady || reason.trim().length < 8 || Boolean(pending)} onClick={() => void submit("test")} className="button-secondary rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-40">{pending === "test" ? "Testing…" : "Test connection"}</button>
      <button type="button" disabled={!canUpdate || !status.encryptionReady || !credentialsReady || reason.trim().length < 8 || Boolean(pending)} onClick={() => void submit("save")} className="button-primary rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-40">{pending === "save" ? "Verifying and saving…" : "Verify & save"}</button>
      {status.source === "dashboard" && <button type="button" disabled={!canUpdate || reason.trim().length < 8 || Boolean(pending)} onClick={() => void submit("clear")} className="rounded-xl border border-red-400/40 px-5 py-3 text-sm text-red-200 disabled:opacity-40">{pending === "clear" ? "Removing…" : "Remove override"}</button>}
    </div>
    {message && <p role={message.error ? "alert" : "status"} className={`rounded-xl border p-4 text-sm ${message.error ? "border-red-400/40 text-red-200" : "border-accent/30 text-accent"}`}>{message.text}</p>}
    <p className="text-xs leading-6 text-muted">The storage check creates a small temporary object, reads it, and deletes it. Existing images prevent changing the account or bucket without a migration. Saving a new key for the same bucket is allowed.</p>
  </div>;
}

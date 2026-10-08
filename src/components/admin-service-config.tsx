"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { describeOpenAIModel, fallbackOpenAIModels, type OpenAIModelOption } from "@/lib/openai-model-catalog";

type Field = "openaiApiKey" | "openaiModel" | "resendApiKey" | "resendFromEmail" | "resendSupportEmail" | "resendWebhookSecret";
type Status = { openaiApiKey: boolean; openaiModel: string; openaiVerifiedAt: string | null; openaiLastError: string; resendApiKey: boolean; resendFromEmail: string; resendSupportEmail: string; resendWebhookSecret: boolean; encryptionReady: boolean; source: Record<Field, string> };
type ModelResult = { models: OpenAIModelOption[]; notice: string };
const entries: { field: Field; title: string; hint: string; secret: boolean; placeholder: string }[] = [
  { field: "openaiApiKey", title: "OpenAI API key", hint: "Used server-side to explain qualifying market setups. Never returned after saving.", secret: true, placeholder: "Paste a new API key" },
  { field: "openaiModel", title: "OpenAI model", hint: "Select a Responses-compatible model available to your OpenAI API project.", secret: false, placeholder: "Choose an OpenAI model" },
  { field: "resendApiKey", title: "Resend API key", hint: "Used for verification, password reset, account, and contact emails.", secret: true, placeholder: "Paste a new Resend key" },
  { field: "resendFromEmail", title: "Verified sender", hint: "Must match a domain verified in your Resend account.", secret: false, placeholder: "Enrivea <updates@example.com>" },
  { field: "resendSupportEmail", title: "Support inbox", hint: "Contact-form messages are sent here.", secret: false, placeholder: "support@example.com" },
  { field: "resendWebhookSecret", title: "Resend webhook secret", hint: "Verifies delivery and bounce events from Resend.", secret: true, placeholder: "Paste a new webhook secret" },
];

async function fetchModelOptions(): Promise<ModelResult> {
  const response = await fetch("/api/admin/service-config", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Models could not be loaded.");
  return result;
}

export function AdminServiceConfig({ initial, demo = false, category = "all" }: { initial: Status; demo?: boolean; category?: "all" | "ai" | "email" }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [values, setValues] = useState<Record<Field, string>>({ openaiApiKey: "", openaiModel: initial.openaiModel, resendApiKey: "", resendFromEmail: initial.resendFromEmail, resendSupportEmail: initial.resendSupportEmail, resendWebhookSecret: "" });
  const [reason, setReason] = useState(demo ? "Interactive demo configuration" : "");
  const [pending, setPending] = useState<Field | null>(null);
  const [message, setMessage] = useState("");
  const [models, setModels] = useState<OpenAIModelOption[]>(() => initial.openaiModel && !fallbackOpenAIModels.some((model) => model.id === initial.openaiModel) ? [describeOpenAIModel(initial.openaiModel), ...fallbackOpenAIModels] : fallbackOpenAIModels);
  const [modelsLoading, setModelsLoading] = useState(category !== "email");
  const [modelNotice, setModelNotice] = useState("Loading models available to this OpenAI project…");

  async function refreshModelOptions() {
    setModelsLoading(true);
    try {
      const result = await fetchModelOptions();
      setModels(result.models);
      setModelNotice(result.notice);
      setValues((previous) => ({ ...previous, openaiModel: previous.openaiModel || result.models.find((model: OpenAIModelOption) => model.recommended)?.id || result.models[0]?.id || "" }));
    } catch (error) {
      setModelNotice(error instanceof Error ? error.message : "Models could not be loaded.");
    } finally { setModelsLoading(false); }
  }

  useEffect(() => {
    if (category === "email") return;
    let active = true;
    void fetchModelOptions().then((result) => {
      if (!active) return;
      setModels(result.models);
      setModelNotice(result.notice);
      setValues((previous) => ({ ...previous, openaiModel: previous.openaiModel || result.models.find((model) => model.recommended)?.id || result.models[0]?.id || "" }));
    }).catch((error) => { if (active) setModelNotice(error instanceof Error ? error.message : "Models could not be loaded."); }).finally(() => { if (active) setModelsLoading(false); });
    return () => { active = false; };
  }, [category]);

  async function save(field: Field, action: "set" | "clear") {
    setPending(field); setMessage("");
    try {
      const response = await fetch("/api/admin/service-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field, action, value: action === "set" ? values[field] : "", reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Configuration was not saved.");
      setStatus(result.status);
      if (entries.find(entry => entry.field === field)?.secret) setValues(previous => ({ ...previous, [field]: "" }));
      else if (action === "clear") setValues(previous => ({ ...previous, [field]: result.status[field] }));
      setReason(demo ? "Interactive demo configuration" : ""); setMessage(`${entries.find(entry => entry.field === field)?.title} ${action === "set" ? "saved" : "cleared"}. The change is active on the next request.`);
      if (field === "openaiApiKey" && action === "set") void refreshModelOptions();
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Configuration was not saved."); }
    finally { setPending(null); }
  }

  const ready = status.encryptionReady && reason.trim().length >= 8 && pending === null;
  return <div className="space-y-5">
    <p className="text-xs leading-6 text-muted">Dashboard overrides take effect on the next server request. OpenAI credentials are verified before replacing the current key. Existing deployment values remain a fallback. Stored credentials are encrypted and never displayed again. Keep the deployment authentication secret stable: rotating it without migration makes stored credentials unreadable.</p>
    {category !== "email" && status.openaiApiKey && <p className={`rounded-xl border p-4 text-sm ${status.openaiVerifiedAt ? "border-accent/25 text-[#d5efaa]" : "border-[#9c644f] text-[#f6b795]"}`}>{status.openaiVerifiedAt ? `OpenAI credential verified ${new Date(status.openaiVerifiedAt).toLocaleString()}.` : "The stored OpenAI credential predates verification or failed a live scan. Save a valid key before enabling automatic discovery."}</p>}
    {!status.encryptionReady && <p className="rounded-xl border border-[#9c644f] bg-[#ae694018] p-4 text-sm text-[#f6b795]">Set a strong NEXTAUTH_SECRET of at least 32 characters in the deployment before saving credentials here.</p>}
    <label className="block text-sm font-semibold">Reason for change<input value={reason} onChange={event => setReason(event.target.value)} maxLength={300} placeholder="Required audit reason (at least 8 characters)" className="mt-2 block h-11 w-full rounded-xl border border-line bg-[#111a13] px-3 text-sm text-white"/></label>
    <div className="grid gap-4 xl:grid-cols-2">{entries.filter(entry => category === "all" || (category === "ai" ? entry.field.startsWith("openai") : entry.field.startsWith("resend"))).map(entry => {
      const effective = entry.secret ? status[entry.field] ? "Configured" : "Not configured" : status[entry.field] || "Not configured";
      const changed = entry.secret ? values[entry.field].trim().length >= 20 : Boolean(values[entry.field].trim()) && values[entry.field].trim() !== status[entry.field];
      return <div key={entry.field} className="rounded-xl border border-line bg-[#141e17] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{entry.title}</h3><span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent">{status.source[entry.field]}</span></div><p className="mt-2 text-xs leading-5 text-muted">{entry.hint}</p><p className="mt-3 text-xs">Current: <span className="text-accent">{effective}</span></p>{entry.field === "openaiModel" ? <><div className="mt-3 flex gap-2"><select aria-label="OpenAI model" value={values.openaiModel} onChange={event => setValues(previous => ({ ...previous, openaiModel: event.target.value }))} className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-[#0e1510] px-3 text-sm text-white"><option value="" disabled>Choose an OpenAI model</option>{models.map((model) => <option key={model.id} value={model.id}>{model.label}{model.recommended ? " · Recommended" : ""} — {model.id}</option>)}</select><button type="button" aria-label="Refresh OpenAI models" title="Refresh models from OpenAI" disabled={modelsLoading || pending !== null} onClick={() => void refreshModelOptions()} className="button-secondary flex size-11 shrink-0 items-center justify-center rounded-lg disabled:opacity-40"><RefreshCw className={`size-4 ${modelsLoading ? "animate-spin" : ""}`}/></button></div><p className="mt-2 text-[11px] leading-5 text-muted">{models.find((model) => model.id === values.openaiModel)?.description ?? modelNotice}</p><p className="mt-1 text-[10px] text-[#82917f]">{modelNotice}</p></> : <input type={entry.secret ? "password" : "text"} autoComplete="off" value={values[entry.field]} onChange={event => setValues(previous => ({ ...previous, [entry.field]: event.target.value }))} placeholder={entry.placeholder} maxLength={entry.secret ? 500 : 160} className="mt-3 h-11 w-full rounded-lg border border-line bg-[#0e1510] px-3 text-sm text-white"/>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!ready || !changed} onClick={() => save(entry.field, "set")} className="button-primary rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-40">{pending === entry.field ? "Saving…" : `Save ${entry.title}`}</button>{status.source[entry.field] === "dashboard" && <button type="button" disabled={!ready} onClick={() => save(entry.field, "clear")} className="button-secondary rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-40">Remove override</button>}</div></div>;
    })}</div>
    {message && <p role="status" className="rounded-lg border border-line bg-[#0e1510] p-3 text-sm text-[#d5efaa]">{message}</p>}
  </div>;
}

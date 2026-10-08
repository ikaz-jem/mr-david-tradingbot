"use client";

import { useState } from "react";
import { Bot, Check, CircleAlert, CreditCard, Headphones, Info, LoaderCircle, MessageSquareText, PlugZap, Radar, RefreshCw, Save, ShieldAlert, UserPlus } from "lucide-react";

type GateKey = "registrationOpen" | "scansOpen" | "approvalDiscoveryOpen" | "autopilotOpen" | "exchangeConnectionsOpen" | "billingOpen" | "supportOpen" | "paperReconciliationOpen" | "contactIntakeOpen";
type MessageKey = "registrationPausedMessage" | "scansPausedMessage" | "approvalPausedMessage" | "autopilotPausedMessage" | "exchangeConnectionsPausedMessage" | "billingPausedMessage" | "supportPausedMessage" | "paperReconciliationPausedMessage" | "contactIntakePausedMessage";
type OperationsConfig = Record<GateKey, boolean> & Record<MessageKey, string> & { maintenanceMode: boolean; maintenanceMessage: string };
type ConfigKey = keyof OperationsConfig;

const services: { gate: GateKey; message: MessageKey; title: string; detail: string; icon: typeof Radar }[] = [
  { gate: "registrationOpen", message: "registrationPausedMessage", title: "New registrations", detail: "Controls creation of new customer accounts.", icon: UserPlus },
  { gate: "scansOpen", message: "scansPausedMessage", title: "Research Scanner", detail: "Stops new manual AI research before credits or provider calls.", icon: Radar },
  { gate: "approvalDiscoveryOpen", message: "approvalPausedMessage", title: "Approval Desk discovery", detail: "Stops scheduled discovery and paid setup unlock actions.", icon: Radar },
  { gate: "autopilotOpen", message: "autopilotPausedMessage", title: "Autopilot", detail: "Stops new automatic runs while preserving controls and history.", icon: Bot },
  { gate: "exchangeConnectionsOpen", message: "exchangeConnectionsPausedMessage", title: "Exchange connections", detail: "Stops new credential connections; users can still disconnect.", icon: PlugZap },
  { gate: "billingOpen", message: "billingPausedMessage", title: "Activation and billing", detail: "Prevents new checkout sessions and credit purchases.", icon: CreditCard },
  { gate: "supportOpen", message: "supportPausedMessage", title: "New support tickets", detail: "Stops new tickets while existing conversations remain readable.", icon: Headphones },
  { gate: "paperReconciliationOpen", message: "paperReconciliationPausedMessage", title: "Paper reconciliation", detail: "Stops market refreshes without changing stored outcomes.", icon: RefreshCw },
  { gate: "contactIntakeOpen", message: "contactIntakePausedMessage", title: "Public contact intake", detail: "Stops new website contact-form submissions.", icon: MessageSquareText },
];

const configFields: ConfigKey[] = [
  "registrationOpen", "scansOpen", "approvalDiscoveryOpen", "autopilotOpen", "exchangeConnectionsOpen", "billingOpen", "supportOpen", "paperReconciliationOpen", "contactIntakeOpen",
  "maintenanceMode", "maintenanceMessage", "registrationPausedMessage", "scansPausedMessage", "approvalPausedMessage", "autopilotPausedMessage", "exchangeConnectionsPausedMessage", "billingPausedMessage", "supportPausedMessage", "paperReconciliationPausedMessage", "contactIntakePausedMessage",
];

export function OperationsControlCenter({ config, demo = false }: { config: OperationsConfig; demo?: boolean }) {
  const [current, setCurrent] = useState(config);
  const [draft, setDraft] = useState(config);
  const [reason, setReason] = useState(demo ? "Interactive demo operations configuration" : "");
  const [pendingField, setPendingField] = useState<ConfigKey | "messages" | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const changed = configFields.filter(field => draft[field] !== current[field]);
  const changedMessages = changed.filter(field => typeof draft[field] === "string");
  const active = services.filter(service => draft[service.gate]).length;

  async function persist(updates: { field: ConfigKey; value: OperationsConfig[ConfigKey] }[], successText: string, pending: ConfigKey | "messages") {
    if (reason.trim().length < 8) {
      setFeedback({ type: "error", text: `Enter an audit reason of at least 8 characters before changing ${demo ? "demo" : "live"} availability.` });
      return false;
    }
    if (updates.some(update => typeof update.value === "string" && update.value.trim().length < 8)) {
      setFeedback({ type: "error", text: "Customer messages must contain at least 8 characters." });
      return false;
    }
    setPendingField(pending); setFeedback(null);
    try {
      let latest = current;
      for (const update of updates) {
        const response = await fetch("/api/admin/controls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field: update.field, value: update.value, reason }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? `Could not save ${update.field}.`);
        latest = Object.fromEntries(configFields.map(key => [key, result.config[key]])) as OperationsConfig;
      }
      const saved = new Set(updates.map(update => update.field));
      setCurrent(latest);
      setDraft(previous => Object.fromEntries(configFields.map(field => [field, previous[field] !== current[field] && !saved.has(field) ? previous[field] : latest[field]])) as OperationsConfig);
      setFeedback({ type: "success", text: successText });
      return true;
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Operations policy could not be saved." });
      return false;
    } finally { setPendingField(null); }
  }

  async function toggleGate(gate: GateKey, message: MessageKey, title: string) {
    const next = !current[gate];
    const updates: { field: ConfigKey; value: OperationsConfig[ConfigKey] }[] = [];
    if (draft[message] !== current[message]) updates.push({ field: message, value: draft[message] });
    updates.push({ field: gate, value: next });
    await persist(updates, `${title} is now ${next ? "available" : "paused"}. The policy is active immediately.`, gate);
  }

  async function toggleMaintenance() {
    const next = !current.maintenanceMode;
    const updates: { field: ConfigKey; value: OperationsConfig[ConfigKey] }[] = [];
    if (draft.maintenanceMessage !== current.maintenanceMessage) updates.push({ field: "maintenanceMessage", value: draft.maintenanceMessage });
    updates.push({ field: "maintenanceMode", value: next });
    await persist(updates, next ? "Maintenance mode is active immediately." : "Maintenance mode is off and normal service is restored.", "maintenanceMode");
  }

  async function saveMessages() {
    if (!changedMessages.length) return;
    await persist(changedMessages.map(field => ({ field, value: draft[field] })), "Customer-facing messages saved and active.", "messages");
  }

  return <div className="space-y-5">
    <section className="rounded-[18px] border border-accent/25 bg-accent/[.06] p-4"><div className="flex items-start gap-3"><Info className="mt-0.5 size-4 shrink-0 text-accent"/><div><p className="text-xs font-black uppercase tracking-wider">{demo ? "Demo operations scope" : "Global operations scope"}</p><p className="mt-1 text-xs leading-5 text-muted">{demo ? "These controls affect demo workspaces only. Public registration and real customer services require a private live administrator account. Changes are saved and audited." : "Changes on this page affect public registration and every real customer workspace immediately. Every change is recorded in the audit trail. Safety actions such as disconnecting an exchange remain available during pauses."}</p></div></div></section>
    <section className="sticky top-[76px] z-20 rounded-[18px] border border-[#48613d] bg-[#0d170f]/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl"><div className="flex flex-col gap-3 xl:flex-row xl:items-end"><label className="min-w-0 flex-1 text-[10px] font-black uppercase tracking-wider text-muted">Audit reason<input value={reason} onChange={event => setReason(event.target.value)} maxLength={300} placeholder="Why is service availability changing?" className="mt-2 h-11 w-full rounded-xl border border-line bg-[#07100a] px-3 text-sm font-normal normal-case text-white"/></label><button type="button" disabled={pendingField !== null || !changedMessages.length} onClick={() => void saveMessages()} className="button-primary flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-xs disabled:opacity-40">{pendingField === "messages" ? <LoaderCircle className="size-4 animate-spin"/> : <Save className="size-4"/>} Save message edits {changedMessages.length ? `(${changedMessages.length})` : ""}</button></div>{feedback && <p role={feedback.type === "error" ? "alert" : "status"} className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${feedback.type === "error" ? "border-[#7c4947] bg-[#2a1514] text-[#ffaaa2]" : "border-accent/25 bg-accent/[.05] text-[#d5efaa]"}`}>{feedback.type === "error" ? <CircleAlert className="mt-0.5 size-4 shrink-0"/> : <Check className="mt-0.5 size-4 shrink-0 text-accent"/>}{feedback.text}</p>}</section>
    <section className={`overflow-hidden rounded-[22px] border p-5 sm:p-6 ${draft.maintenanceMode ? "border-[#a96855] bg-[radial-gradient(circle_at_90%_0%,rgba(255,125,96,.13),transparent_35%),#20130f]" : "border-[#46623f] bg-[radial-gradient(circle_at_90%_0%,rgba(197,255,65,.09),transparent_35%),#111b13]"}`}><div className="flex flex-wrap items-start justify-between gap-5"><div className="flex max-w-3xl items-start gap-4"><span className={`flex size-12 shrink-0 items-center justify-center rounded-xl border ${draft.maintenanceMode ? "border-[#b96f5b] bg-[#ff795315] text-[#ff9b83]" : "border-accent/25 bg-accent/10 text-accent"}`}><ShieldAlert className="size-5"/></span><div><p className="eyebrow">Global safety state</p><h2 className="mt-2 text-2xl font-black">Maintenance mode</h2><p className="mt-2 text-sm leading-6 text-muted">Creates a read-only customer experience and blocks new operational actions. Administrators retain access to this control center so the platform cannot lock out its operators.</p></div></div><button type="button" disabled={pendingField !== null} onClick={() => void toggleMaintenance()} className={`min-w-32 rounded-full border px-4 py-2 text-[10px] font-black uppercase disabled:opacity-50 ${draft.maintenanceMode ? "border-[#b96f5b] bg-[#ff795315] text-[#ff9b83]" : "border-accent/30 bg-accent/10 text-accent"}`}>{pendingField === "maintenanceMode" ? <LoaderCircle className="mx-auto size-4 animate-spin"/> : draft.maintenanceMode ? "Maintenance active" : "Platform operational"}</button></div><label className="mt-5 block text-[10px] font-black uppercase tracking-wider text-muted">Customer maintenance message<textarea value={draft.maintenanceMessage} onChange={event => setDraft(previous => ({ ...previous, maintenanceMessage: event.target.value }))} maxLength={240} rows={2} className="mt-2 w-full resize-none rounded-xl border border-line bg-black/20 p-3 text-sm font-normal normal-case leading-6 text-white"/></label></section>
    <section className="grid gap-3 sm:grid-cols-3"><Metric label="Services available" value={`${active}/${services.length}`} tone={active === services.length ? "good" : "warning"}/><Metric label="Maintenance" value={draft.maintenanceMode ? "Active" : "Off"} tone={draft.maintenanceMode ? "danger" : "good"}/><Metric label="Unsaved message edits" value={String(changedMessages.length)} tone={changedMessages.length ? "warning" : "neutral"}/></section>
    <section><div className="mb-4"><p className="eyebrow">Independent service gates</p><h2 className="mt-2 text-2xl font-black">Availability and customer messaging</h2><p className="mt-2 text-xs leading-6 text-muted">Availability switches save immediately. Message edits are saved from the sticky policy bar above.</p></div><div className="grid items-start gap-4 xl:grid-cols-2">{services.map(service => { const Icon = service.icon; const open = draft[service.gate]; return <article key={service.gate} className={`rounded-[18px] border p-5 ${open ? "border-[#3e573b] bg-[#111b13]" : "border-[#765044] bg-[#1c1411]"}`}><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${open ? "border-accent/20 bg-accent/[.07] text-accent" : "border-[#8e5b4c] bg-[#ff795310] text-[#ff9b83]"}`}><Icon className="size-4"/></span><div><h3 className="text-sm font-black">{service.title}</h3><p className="mt-1 text-xs leading-5 text-muted">{service.detail}</p></div></div><button type="button" aria-label={`${open ? "Pause" : "Resume"} ${service.title}`} aria-pressed={!open} disabled={pendingField !== null} onClick={() => void toggleGate(service.gate, service.message, service.title)} className={`min-w-24 shrink-0 rounded-full border px-3 py-2 text-[9px] font-black uppercase disabled:opacity-50 ${open ? "border-accent/30 bg-accent/10 text-accent" : "border-[#985f4e] bg-[#ff795310] text-[#ff9b83]"}`}>{pendingField === service.gate ? <LoaderCircle className="mx-auto size-4 animate-spin"/> : open ? "Available" : "Paused"}</button></div><label className="mt-4 block text-[9px] font-black uppercase tracking-wider text-muted">Message shown when paused<textarea value={draft[service.message]} onChange={event => setDraft(previous => ({ ...previous, [service.message]: event.target.value }))} maxLength={240} rows={2} className="mt-2 w-full resize-none rounded-xl border border-line bg-black/20 p-3 text-xs font-normal normal-case leading-5 text-white"/></label></article>; })}</div></section>
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "good" | "warning" | "danger" | "neutral" }) { const color = tone === "good" ? "text-accent" : tone === "danger" ? "text-[#ff9b83]" : tone === "warning" ? "text-[#efc16f]" : "text-white"; return <div className="surface rounded-xl p-4"><p className="text-[9px] font-black uppercase tracking-wider text-muted">{label}</p><p className={`mt-2 text-xl font-black ${color}`}>{value}</p></div>; }

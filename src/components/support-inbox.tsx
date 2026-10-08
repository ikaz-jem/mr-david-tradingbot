"use client";
import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, Plus, Send, RefreshCw } from "lucide-react";

type Ticket = { _id: string; subject: string; category: string; status: string; priority: string; assignedName: string; revision: number; updatedAt: string; messages: { _id: string; authorName: string; staff: boolean; internal: boolean; body: string; createdAt: string }[] };
const field = "w-full rounded-xl border border-line bg-[#101b13] px-3 py-2.5 text-sm";
const button = "rounded-xl border border-line px-3 py-2 text-xs font-bold hover:border-accent disabled:opacity-40";
export function SupportInbox({ staff = false, canUpdate = true }: { staff?: boolean; canUpdate?: boolean }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [creationOpen, setCreationOpen] = useState(true);
  const [operationsMessage, setOperationsMessage] = useState("");
  const suffix = staff ? "?view=staff" : "";
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/support" + suffix, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setTickets(result.tickets); setCreationOpen(result.creationOpen ?? true); setOperationsMessage(result.operationsMessage ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load tickets."); }
  }, [suffix]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/support" + suffix, { signal: controller.signal, cache: "no-store" }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; }).then(data => { setTickets(data.tickets); setCreationOpen(data.creationOpen ?? true); setOperationsMessage(data.operationsMessage ?? ""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [suffix]);
  const ticket = tickets.find(item => item._id === selected) ?? tickets[0];
  async function update(data: object) {
    if (!ticket || busy || (staff && !canUpdate)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/support/" + ticket._id + suffix, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: ticket.revision, ...data }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setBody(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed."); }
    finally { setBusy(false); }
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCreating(false); setSelected(result.id); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create ticket."); }
    finally { setBusy(false); }
  }
  const visible = tickets.filter(item => (filter === "all" || item.status === filter) && (item.subject + item.category).toLowerCase().includes(search.toLowerCase()));
  return <div>
    {!creationOpen && !staff && <p role="alert" className="mb-5 rounded-xl border border-[#9b6652] bg-[#8a4f3518] p-4 text-sm leading-6 text-[#ffc0ae]"><b>New tickets paused:</b> {operationsMessage} Existing conversations remain available.</p>}
    <div className="mb-5 grid grid-cols-3 gap-3">{[["Active", tickets.filter(t => !["closed", "resolved"].includes(t.status)).length], ["Awaiting customer", tickets.filter(t => t.status === "waiting").length], ["Resolved", tickets.filter(t => ["resolved", "closed"].includes(t.status)).length]].map(([label, value]) => <div className="surface rounded-2xl p-4" key={label}><p className="text-xs text-muted">{label}</p><p className="mt-2 text-3xl font-bold text-accent">{value}</p></div>)}</div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/40 p-3 text-sm text-red-200">{error}</p>}
    <div className="mb-4 flex flex-wrap gap-2"><input aria-label="Search tickets" placeholder="Search conversations…" value={search} onChange={e => setSearch(e.target.value)} className={field + " max-w-xs"}/><select aria-label="Filter tickets" className={field + " max-w-44"} value={filter} onChange={e => setFilter(e.target.value)}>{["all", "open", "in_progress", "waiting", "resolved", "closed"].map(value => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select><button className={button} onClick={() => void load()}><RefreshCw className="mr-2 inline size-4"/>Refresh</button><button disabled={!creationOpen} className={button + " bg-accent text-black"} onClick={() => setCreating(!creating)}><Plus className="mr-2 inline size-4"/>{creationOpen ? "New ticket" : "Tickets paused"}</button></div>
    {creating && <form onSubmit={create} className="surface mb-5 space-y-3 rounded-2xl p-5"><h2 className="font-bold">Start a conversation</h2><input required minLength={5} maxLength={160} name="subject" placeholder="What can we help with?" aria-label="Ticket subject" className={field}/><select name="category" aria-label="Category" className={field}>{["account", "billing", "research", "exchange", "other"].map(value => <option key={value}>{value}</option>)}</select><textarea required minLength={10} maxLength={4000} name="body" placeholder="Describe the issue. Never include passwords, API keys, or payment details." aria-label="Ticket message" rows={4} className={field}/><button disabled={busy} className={button}>Create ticket</button></form>}
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]"><aside className="surface max-h-[650px] space-y-2 overflow-y-auto rounded-2xl p-3">{visible.length ? visible.map(item => <button key={item._id} onClick={() => { setSelected(item._id); setBody(""); }} className={"w-full rounded-xl border p-4 text-left " + (ticket?._id === item._id ? "border-accent/50 bg-accent/5" : "border-line hover:bg-white/5")}><span className="text-[10px] uppercase tracking-widest text-accent">{item.category} · {item.status.replace("_", " ")}</span><strong className="my-2 block text-sm">{item.subject}</strong><span className="text-xs text-muted">{new Date(item.updatedAt).toLocaleDateString()} · {item.messages.length} messages</span></button>) : <p className="p-5 text-sm text-muted">No matching tickets.</p>}</aside>
      <section className="surface rounded-2xl p-5">{ticket ? <><div className="border-b border-line pb-4"><p className="text-xs text-accent">#{ticket._id.slice(-8)} · {ticket.priority} priority</p><h2 className="mt-2 text-xl font-bold">{ticket.subject}</h2><p className="mt-2 text-xs text-muted">Assigned to: {ticket.assignedName || "Unassigned"}</p><div className="mt-4 flex flex-wrap gap-2">{staff && canUpdate ? <><select disabled={busy} aria-label="Ticket status" className={button + " bg-[#101b13]"} value={ticket.status} onChange={e => void update({ status: e.target.value })}>{["open", "in_progress", "waiting", "resolved", "closed"].map(value => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select><select disabled={busy} aria-label="Ticket priority" className={button + " bg-[#101b13]"} value={ticket.priority} onChange={e => void update({ priority: e.target.value })}>{["normal", "high", "urgent"].map(value => <option key={value}>{value}</option>)}</select><button disabled={busy} className={button} onClick={() => void update({ assignToMe: true })}>Assign to me</button><button disabled={busy} className={button} onClick={() => void update({ assignToMe: false })}>Unassign</button></> : !staff ? <button disabled={busy} className={button} onClick={() => void update({ status: ["closed", "resolved"].includes(ticket.status) ? "open" : "closed" })}>{["closed", "resolved"].includes(ticket.status) ? "Reopen ticket" : "Close ticket"}</button> : <span className="text-xs text-muted">Read-only support access</span>}</div></div>
      <div className="my-5 max-h-[450px] space-y-4 overflow-y-auto">{ticket.messages.map(message => <article key={message._id} className={"rounded-xl border p-4 " + (message.internal ? "border-amber-500/30 bg-amber-500/5" : message.staff ? "border-accent/25 bg-accent/5" : "border-line")}><p className="text-xs font-bold">{message.authorName} <span className="ml-2 font-normal text-muted">{message.internal ? "Staff note" : message.staff ? "Support" : "Customer"} · {new Date(message.createdAt).toLocaleString()}</span></p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p></article>)}</div>
      {(!staff || canUpdate) && <form onSubmit={event => { event.preventDefault(); void update({ body, internal: staff && internal }); }}><textarea required maxLength={4000} aria-label="Reply" placeholder="Write a reply…" value={body} onChange={e => setBody(e.target.value)} rows={3} className={field}/><div className="mt-3 flex items-center justify-between gap-3">{staff ? <label className="text-xs text-muted"><input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} className="mr-2"/>Internal note (staff only)</label> : <span className="text-xs text-muted">Do not share credentials.</span>}<button disabled={busy || !body.trim()} className={button + " bg-accent text-black"}><Send className="mr-2 inline size-4"/>{busy ? "Saving…" : internal && staff ? "Add note" : "Send reply"}</button></div></form>}</> : <div className="py-20 text-center"><LifeBuoy className="mx-auto size-10 text-accent"/><h2 className="mt-4 text-xl font-bold">Your support desk</h2><p className="mt-2 text-sm text-muted">Open a ticket to keep the whole conversation in one place.</p></div>}</section>
    </div>
  </div>;
}


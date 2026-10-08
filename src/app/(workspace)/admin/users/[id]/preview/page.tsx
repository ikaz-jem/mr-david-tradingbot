import mongoose from "mongoose";
import Link from "next/link";
import { notFound } from "next/navigation";
import { workspaceActor } from "@/lib/workspace-access";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { User } from "@/models/User";
import { Signal } from "@/models/Signal";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { SupportTicket } from "@/models/SupportTicket";
import { PageIntro } from "@/components/dashboard-ui";
export const dynamic = "force-dynamic";
export default async function UserPreview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ audit?: string }> }) {
  const actor = await workspaceActor();
  if (!actor?.can("users:impersonate") || actor.organizationKind !== "platform") notFound();
  const { id } = await params;
  const { audit } = await searchParams;
  if (!mongoose.isObjectIdOrHexString(id) || !mongoose.isObjectIdOrHexString(audit)) notFound();
  const grant = await AdminAuditEvent.findOne({ _id: audit, actorId: actor.id, targetUserId: id, action: "view_as_user", status: "applied", createdAt: { $gt: new Date(new Date().getTime() - 15 * 60_000) } }).lean();
  if (!grant) return <div className="surface rounded-2xl p-8"><h1 className="text-2xl font-bold">Preview expired</h1><p className="mt-3 text-muted">Return to Users and start a new audited preview.</p><Link href="/admin/users" className="mt-5 inline-block text-accent">Return to Users →</Link></div>;
  const target = await User.findOne({ _id: id, role: { $ne: "admin" }, isDemo: actor.isDemo ? true : { $ne: true } }).select("name email status isDemo activatedAt creditBalance createdAt").lean();
  if (!target) notFound();
  const [demo, signals, tickets] = await Promise.all([
    DemoWorkspace.findOne({ userId: id }),
    Signal.find({ userId: id }).sort({ createdAt: -1 }).limit(8).lean(),
    SupportTicket.find({ userId: id }).select("subject status updatedAt").sort({ updatedAt: -1 }).limit(5).lean(),
  ]);
  const activatedAt = demo?.activatedAt ?? target.activatedAt;
  const credits = demo?.creditBalance ?? target.creditBalance;
  return <><div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/40 bg-amber-300/10 p-4"><div><strong className="text-sm text-amber-100">Viewing {target.name} · Read-only</strong><p className="mt-1 text-xs text-muted">Audited preview expires {new Date(grant.createdAt.getTime() + 900000).toLocaleTimeString()}. Your administrator identity has not changed.</p></div><Link href="/admin/users" className="rounded-lg border border-line px-4 py-2 text-xs font-bold">Exit preview</Link></div><PageIntro eyebrow="Customer workspace preview" title={target.name + "’s workspace"} description="Inspect the customer's activation, shared credit balance, research, and support status. Trading, billing, credentials, and customer actions are intentionally unavailable here."/><div className="surface mb-5 rounded-2xl p-5"><p className="text-sm">{target.email}</p><p className="mt-2 text-xs capitalize text-muted">Account: {target.status} · Activation: {activatedAt ? "permanent access" : "required"}</p></div><div className="surface mb-5 rounded-2xl p-5"><p className="text-xs text-muted">Shared platform credits</p><p className="mt-3 text-3xl font-bold text-accent">{credits}</p>{activatedAt && <p className="mt-2 text-xs text-muted">Activated {new Date(activatedAt).toLocaleString()}</p>}</div><section className="surface rounded-2xl p-5"><h2 className="mb-4 font-bold">Recent research</h2>{signals.length ? signals.map(signal => <article key={String(signal._id)} className="border-t border-line py-4"><p className="font-bold">{signal.symbol} <span className="text-xs text-muted">{signal.interval} · {signal.status}</span></p><p className="mt-2 text-sm leading-6 text-muted">{signal.thesis}</p><p className="mt-2 text-xs text-muted">Entry {signal.entry} · Stop {signal.stop} · Target {signal.target}</p></article>) : <p className="text-sm text-muted">This customer has no research history yet.</p>}</section><section className="surface mt-5 rounded-2xl p-5"><h2 className="mb-4 font-bold">Support requests</h2>{tickets.length ? tickets.map(ticket => <div key={String(ticket._id)} className="flex justify-between gap-3 border-t border-line py-3 text-sm"><span>{ticket.subject}</span><span className="capitalize text-accent">{ticket.status}</span></div>) : <p className="text-sm text-muted">No support requests.</p>}</section></>;
}

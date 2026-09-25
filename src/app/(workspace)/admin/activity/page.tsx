import { AdminActivityRefresh } from "@/components/admin-activity-refresh";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { CreditEntry } from "@/models/CreditEntry";
import { EmailDelivery } from "@/models/EmailDelivery";
import { Order } from "@/models/Order";
import { PaperOutcome } from "@/models/PaperOutcome";
import { PaystackCheckout } from "@/models/PaystackCheckout";
import { PaystackWebhookEvent } from "@/models/PaystackWebhookEvent";
import { ScanRun } from "@/models/ScanRun";
import { Signal } from "@/models/Signal";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";
type Item = { id: string; kind: string; title: string; detail: string; at: Date; severity: "normal" | "attention" };

export default async function AdminActivityPage() {
  const session = await getServerSession(authOptions);
  await connectDB();
  const actor = session?.user.id ? await User.findById(session.user.id).select("role status").lean() : null;
  if (!actor || actor.role !== "admin" || actor.status !== "active") notFound();
  const [users, scans, signals, outcomes, orders, credits, checkouts, webhooks, emails, audits, running, unknownOrders, paymentReviews, emailIssues] = await Promise.all([
    User.find().sort({ createdAt: -1 }).limit(12).select("email role isDemo createdAt").lean(),
    ScanRun.find().sort({ createdAt: -1 }).limit(20).select("symbol status outcome summary userId createdAt").lean(),
    Signal.find().sort({ createdAt: -1 }).limit(12).select("symbol status userId createdAt").lean(),
    PaperOutcome.find().sort({ updatedAt: -1 }).limit(12).select("status reason userId updatedAt").lean(),
    Order.find().sort({ updatedAt: -1 }).limit(12).select("symbol status userId updatedAt").lean(),
    CreditEntry.find().sort({ createdAt: -1 }).limit(15).select("amount kind note userId createdAt").lean(),
    PaystackCheckout.find().sort({ updatedAt: -1 }).limit(12).select("planId status userId updatedAt").lean(),
    PaystackWebhookEvent.find().sort({ createdAt: -1 }).limit(12).select("type outcome reference createdAt").lean(),
    EmailDelivery.find().sort({ updatedAt: -1 }).limit(12).select("category status recipient updatedAt").lean(),
    AdminAuditEvent.find().sort({ createdAt: -1 }).limit(20).select("action before after reason status actorId targetUserId createdAt").lean(),
    ScanRun.countDocuments({ status: "running" }),
    Order.countDocuments({ status: "unknown" }),
    PaystackWebhookEvent.countDocuments({ outcome: "review" }),
    EmailDelivery.countDocuments({ status: { $in: ["failed", "bounced", "complained"] } }),
  ]);
  const ids = [...new Set([...scans.map(item => String(item.userId)), ...signals.map(item => String(item.userId)), ...outcomes.map(item => String(item.userId)), ...orders.map(item => String(item.userId)), ...credits.map(item => String(item.userId)), ...checkouts.map(item => String(item.userId)), ...audits.flatMap(item => [String(item.actorId), String(item.targetUserId)])])];
  const owners = await User.find({ _id: { $in: ids } }).select("email").lean();
  const emailById = new Map(owners.map(owner => [String(owner._id), owner.email]));
  const owner = (id: unknown) => emailById.get(String(id)) ?? "Unknown account";
  const items: Item[] = [
    ...users.map(item => ({ id: `user:${item._id}`, kind: "Account", title: item.email, detail: `${item.role} account created${item.isDemo ? " · local demo" : ""}`, at: item.createdAt, severity: "normal" as const })),
    ...scans.map(item => ({ id: `scan:${item._id}`, kind: "Scan", title: `${item.symbol} · ${item.status}`, detail: `${owner(item.userId)} · ${item.summary || item.outcome || "Processing"}`, at: item.createdAt, severity: item.status === "failed" ? "attention" as const : "normal" as const })),
    ...signals.map(item => ({ id: `signal:${item._id}`, kind: "Signal", title: `${item.symbol} · ${item.status}`, detail: owner(item.userId), at: item.createdAt, severity: "normal" as const })),
    ...outcomes.map(item => ({ id: `paper:${item._id}`, kind: "Paper outcome", title: `${item.status} · ${item.reason}`, detail: owner(item.userId), at: item.updatedAt, severity: "normal" as const })),
    ...orders.map(item => ({ id: `order:${item._id}`, kind: "Exchange order", title: `${item.symbol} · ${item.status}`, detail: owner(item.userId), at: item.updatedAt, severity: item.status === "unknown" ? "attention" as const : "normal" as const })),
    ...credits.map(item => ({ id: `credit:${item._id}`, kind: "Credit ledger", title: `${item.amount > 0 ? "+" : ""}${item.amount} · ${item.kind}`, detail: `${owner(item.userId)} · ${item.note}`, at: item.createdAt, severity: "normal" as const })),
    ...checkouts.map(item => ({ id: `checkout:${item._id}`, kind: "Paystack test", title: `${item.planId} · ${item.status}`, detail: owner(item.userId), at: item.updatedAt, severity: item.status === "review" ? "attention" as const : "normal" as const })),
    ...webhooks.map(item => ({ id: `webhook:${item._id}`, kind: "Payment event", title: `${item.type} · ${item.outcome}`, detail: item.reference || "No reference", at: item.createdAt, severity: item.outcome === "review" ? "attention" as const : "normal" as const })),
    ...emails.map(item => ({ id: `email:${item._id}`, kind: "Email", title: `${item.category} · ${item.status}`, detail: item.recipient, at: item.updatedAt, severity: ["failed", "bounced", "complained"].includes(item.status) ? "attention" as const : "normal" as const })),
    ...audits.map(item => ({ id: `audit:${item._id}`, kind: "Admin change", title: `${item.action.replaceAll("_", " ")} · ${item.status}`, detail: `${owner(item.actorId)} changed ${owner(item.targetUserId)}: ${item.before} → ${item.after}. ${item.reason}`, at: item.createdAt, severity: item.status !== "applied" ? "attention" as const : "normal" as const })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 80);
  return <>
    <PageIntro eyebrow="Operations / activity" title="Platform activity" description="Recent events from accounts, research, paper outcomes, exchange orders, billing tests, email, and admin actions. This is database activity, not a real-time stream."/>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Scans running" value={running}/><Metric label="Unknown orders" value={unknownOrders}/><Metric label="Payment reviews" value={paymentReviews}/><Metric label="Email issues" value={emailIssues}/></div>
    <section className="surface rounded-[20px] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><SectionHeader title="Latest recorded events" detail="Up to 80 across all sources"/><AdminActivityRefresh/></div>{items.length ? <div className="divide-y divide-line">{items.map(item => <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${item.severity === "attention" ? "bg-[#ff939b22] text-[#ff939b]" : "bg-[#c5ff4117] text-accent"}`}>{item.kind}</span><span className="text-sm font-bold">{item.title}</span></div><p className="mt-1 break-all text-xs leading-5 text-muted">{item.detail}</p></div><time className="shrink-0 text-xs text-muted">{item.at.toLocaleString()}</time></div>)}</div> : <EmptyState title="No activity yet" text="Events will appear as accounts and services are used."/>}</section>
  </>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="surface rounded-[18px] p-5"><div className="text-xs text-muted">{label}</div><div className={`mt-3 text-3xl font-bold number ${value > 0 ? "text-[#f2ca82]" : "text-accent"}`}>{value}</div></div>; }

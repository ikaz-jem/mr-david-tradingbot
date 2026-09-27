import Link from "next/link";
import { Activity, Coins, CreditCard, Radar, Users, Workflow } from "lucide-react";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Signal } from "@/models/Signal";
import { Order } from "@/models/Order";
import { ScanRun } from "@/models/ScanRun";
import { EmailDelivery } from "@/models/EmailDelivery";
import { PaystackWebhookEvent } from "@/models/PaystackWebhookEvent";
import { BillingPurchase } from "@/models/BillingPurchase";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { ProductAccount } from "@/models/ProductAccount";
import { getPlatformConfig } from "@/lib/platform-config";
import { EmptyState, PageIntro, SectionHeader, StatCard } from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await connectDB();
  const [users, demoUsers, scans, signals, orders, running, unknownOrders, emailIssues, paymentReviews, livePaymentReviews, pendingAudits, balances, recentUsers, recentScans, controls, connections, connectionIssues] = await Promise.all([
    User.countDocuments({ isDemo: { $ne: true } }),
    User.countDocuments({ isDemo: true }),
    ScanRun.countDocuments({ status: "completed" }),
    Signal.countDocuments(),
    Order.countDocuments(),
    ScanRun.countDocuments({ status: "running" }),
    Order.countDocuments({ status: "unknown" }),
    EmailDelivery.countDocuments({ status: { $in: ["failed", "bounced", "complained"] } }),
    PaystackWebhookEvent.countDocuments({ outcome: "review" }),
    BillingPurchase.countDocuments({ status: "review" }),
    AdminAuditEvent.countDocuments({ status: "pending" }),
    User.aggregate<{ total: number }>([{ $match: { isDemo: { $ne: true } } }, { $lookup: { from: ProductAccount.collection.name, localField: "_id", foreignField: "userId", pipeline: [{ $match: { productId: "signals" } }], as: "products" } }, { $project: { balance: { $ifNull: [{ $first: "$products.creditBalance" }, "$creditBalance"] } } }, { $group: { _id: null, total: { $sum: "$balance" } } }]),
    User.find().sort({ createdAt: -1 }).limit(5).select("name email role isDemo createdAt").lean(),
    ScanRun.find().sort({ createdAt: -1 }).limit(5).select("symbol status outcome createdAt").lean(),
    getPlatformConfig(),
    ExchangeConnection.countDocuments(),
    ExchangeConnection.countDocuments({ status: "attention" }),
  ]);
  return <>
    <PageIntro eyebrow="Operations / overview" title="Control room" description="A live database view of accounts, research, credits, exchange activity, and open operational issues."/>
    <section className="surface mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-[#597547] p-5 sm:p-6"><div><h2 className="text-base font-bold">Operational controls</h2><p className="mt-1 text-xs text-muted">Registration: <b className={controls.registrationOpen ? "text-accent" : "text-[#f6b795]"}>{controls.registrationOpen ? "open" : "paused"}</b> · Research: <b className={controls.scansOpen ? "text-accent" : "text-[#f6b795]"}>{controls.scansOpen ? "open" : "paused"}</b> · Exchange connections: <b className={controls.exchangeConnectionsOpen ? "text-accent" : "text-[#f6b795]"}>{controls.exchangeConnectionsOpen ? "open" : "paused"}</b> · Paper reconciliation: <b className={controls.paperReconciliationOpen ? "text-accent" : "text-[#f6b795]"}>{controls.paperReconciliationOpen ? "open" : "paused"}</b> · Contact: <b className={controls.contactIntakeOpen ? "text-accent" : "text-[#f6b795]"}>{controls.contactIntakeOpen ? "open" : "paused"}</b></p></div><Link href="/admin/controls" className="button-primary rounded-lg px-4 py-2 text-xs font-bold">Manage controls →</Link></section>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Real users" value={String(users)} detail={`${demoUsers} local demo accounts excluded`} icon={Users}/><StatCard label="Completed scans" value={String(scans)} detail="All accounts" icon={Workflow}/><StatCard label="Signals published" value={String(signals)} detail="Research ideas" icon={Radar}/><StatCard label="Exchange orders" value={String(orders)} detail="No synthetic fills" icon={CreditCard}/><StatCard label="Outstanding credits" value={String(balances[0]?.total ?? 0)} detail="Non-demo account balances" icon={Coins} accent/></div>
    <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Needs attention" detail="Current unresolved conditions"/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Attention label="Running scans" value={running} href="/admin/signals"/><Attention label="Unknown orders" value={unknownOrders} href="/admin/orders"/><Attention label="Payment reviews" value={paymentReviews + livePaymentReviews} href="/admin/billing"/><Attention label="Email issues" value={emailIssues} href="/admin/emails"/></div>{pendingAudits > 0 && <p className="mt-4 text-xs text-[#ff939b]">{pendingAudits} admin changes need audit reconciliation.</p>}</section>
    <section className="surface mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[20px] p-5 sm:p-6"><div><h2 className="text-sm font-bold">Exchange connections</h2><p className="mt-2 text-xs leading-6 text-muted">{connections} read-only Binance Spot connections · <span className={connectionIssues ? "text-[#f2ca82]" : "text-accent"}>{connectionIssues} need attention</span>. No exchange orders are enabled.</p></div><Link href="/admin/activity" className="text-xs font-bold text-accent hover:underline">View connection events →</Link></section>
    <div className="grid gap-5 xl:grid-cols-2"><section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Recent accounts" detail="Newest registrations" href="/admin/users"/>{recentUsers.length ? <div className="divide-y divide-line">{recentUsers.map(user => <div className="flex items-center justify-between gap-4 py-4" key={String(user._id)}><div className="min-w-0"><div className="truncate text-sm font-bold">{user.name}{user.isDemo ? " · demo" : ""}</div><div className="truncate text-xs text-muted">{user.email}</div></div><span className="rounded-full border border-line px-3 py-1 text-xs font-semibold capitalize text-muted">{user.role}</span></div>)}</div> : <EmptyState title="No users yet" text="Registrations will appear here once an account is created."/>}</section>
      <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Research activity" detail="Latest scan jobs" href="/admin/signals"/>{recentScans.length ? <div className="divide-y divide-line">{recentScans.map(scan => <div key={String(scan._id)} className="flex items-center justify-between gap-4 py-4"><div><div className="text-sm font-bold">{scan.symbol}</div><div className="mt-1 text-xs capitalize text-muted">{scan.status} · {scan.outcome || "processing"}</div></div><time className="text-xs text-muted">{new Date(scan.createdAt).toLocaleString()}</time></div>)}</div> : <EmptyState title="No scans yet" text="The research activity feed will populate when analysis runs."/>}</section></div>
    <div className="surface mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[20px] p-5 sm:p-6"><div><div className="flex items-center gap-2 text-sm font-bold"><Activity className="size-4 text-accent"/> Platform event timeline</div><p className="mt-2 text-xs text-muted">Accounts, scans, signals, paper outcomes, exchange orders, credits, payment tests, emails, and admin actions.</p></div><Link href="/admin/activity" className="button-secondary rounded-lg px-4 py-2 text-xs font-bold">Open activity →</Link></div>
    <p className="mt-5 text-xs text-muted">Live trading and automated incident response remain disabled. Live checkout is gated on provider approval and configuration; counts reflect stored records, not complete production observability.</p>
  </>;
}

function Attention({ label, value, href }: { label: string; value: number; href: string }) { return <Link href={href} className="rounded-xl border border-line bg-[#141e17] p-4 hover:border-[#5a7c3c]"><div className="text-xs text-muted">{label}</div><div className={`mt-2 text-2xl font-bold number ${value ? "text-[#f2ca82]" : "text-accent"}`}>{value}</div></Link>; }

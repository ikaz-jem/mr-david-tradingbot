import Link from "next/link";
import { notFound } from "next/navigation";
import { workspaceActor } from "@/lib/workspace-access";
import { connectDB } from "@/lib/db";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { CreditEntry } from "@/models/CreditEntry";
import { EmailDelivery } from "@/models/EmailDelivery";
import { Order } from "@/models/Order";
import { PaperOutcome } from "@/models/PaperOutcome";
import { PaystackCheckout } from "@/models/PaystackCheckout";
import { PaystackWebhookEvent } from "@/models/PaystackWebhookEvent";
import { ScanRun } from "@/models/ScanRun";
import { Signal } from "@/models/Signal";
import { User } from "@/models/User";
import { ProductDefinition } from "@/models/ProductDefinition";
import { BillingPurchase } from "@/models/BillingPurchase";
import { Notification } from "@/models/Notification";
import { DemoDataExplorer } from "@/components/demo-data-explorer";
import { AuthorizationAuditLog } from "@/models/AuthorizationAuditLog";

export const dynamic = "force-dynamic";
const categories = ["users", "products", "scans", "signals", "paper", "orders", "connections", "credits", "billing", "paystack", "payment-events", "notifications", "emails", "admin-audit", "security-audit"] as const;
type Category = typeof categories[number];
type Table = { title: string; columns: string[]; rows: string[][]; total: number };
const id = (value: unknown) => String(value);
const date = (value: Date | null | undefined) => value ? new Date(value).toLocaleString() : "—";

export default async function AdminDataPage({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  await connectDB();
  const actor = await workspaceActor();
  if (!actor?.can("data:read")) notFound();
  const params = await searchParams;
  const category: Category = categories.includes(params.category as Category) ? params.category as Category : "users";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  if (actor.isDemo) return <DemoDataExplorer category={category} page={page}/>;
  const demoIds = (await User.find({ isDemo: true }).select("_id").lean()).map(user => String(user._id));
  const table = await loadTable(category, (page - 1) * 50, demoIds, actor.organizationId);
  return <>
    <PageIntro eyebrow="Operations / records" title="Data explorer" description="Paginated read-only records across the platform. Password hashes, email tokens, API credentials, and other secrets are never shown here."/>
    <nav aria-label="Record categories" className="app-scrollbar mb-5 flex flex-wrap gap-2">{categories.map(item => <Link key={item} href={`/admin/data?category=${item}`} className={`rounded-lg border px-3 py-2 text-xs font-bold capitalize ${item === category ? "border-[#8eba4f] bg-[#c5ff4117] text-accent" : "border-line text-muted hover:text-white"}`}>{item.replaceAll("-", " ")}</Link>)}</nav>
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title={table.title} detail={`${table.total} records · page ${page}`}/>{table.rows.length ? <div className="app-scrollbar overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-line uppercase tracking-widest text-muted"><tr>{table.columns.map(column => <th key={column} className="whitespace-nowrap py-3 pr-5">{column}</th>)}</tr></thead><tbody className="divide-y divide-line">{table.rows.map((row, index) => <tr key={`${category}:${page}:${index}`}>{row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[320px] break-words py-3 pr-5 align-top text-[#d6e0d3]">{cell}</td>)}</tr>)}</tbody></table></div> : <EmptyState title="No records on this page" text="Select another category or go back a page."/>}<div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs"><span className="text-muted">Showing {table.rows.length} of {table.total} · 50 per page</span><div className="flex gap-2">{page > 1 && <Link href={`/admin/data?category=${category}&page=${page - 1}`} className="button-secondary rounded-lg px-3 py-2 font-bold">Previous</Link>}{page * 50 < table.total && <Link href={`/admin/data?category=${category}&page=${page + 1}`} className="button-secondary rounded-lg px-3 py-2 font-bold">Next</Link>}</div></div></section>
    <p className="mt-5 text-xs leading-6 text-muted">This view shows selected operational fields, not raw database documents or payment-card data. All record changes must go through specific audited workflows.</p>
  </>;
}

async function loadTable(category: Category, skip: number, demoIds: string[], organizationId: string): Promise<Table> {
  const liveOwner = { userId: { $nin: demoIds } };
  switch (category) {
    case "users": {
      const [total, records] = await Promise.all([User.countDocuments({ isDemo: { $ne: true } }), User.find({ isDemo: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(50).select("email name role status countryCode creditBalance activatedAt emailVerifiedAt isDemo createdAt").lean()]);
      return { title: "Users", total, columns: ["Email", "Name", "Role", "Status", "Country", "Activated", "Platform credits", "Verified", "Demo", "Created"], rows: records.map(row => [row.email, row.name, row.role, row.status, row.countryCode || "—", date(row.activatedAt), String(row.creditBalance), date(row.emailVerifiedAt), row.isDemo ? "Yes" : "No", date(row.createdAt)]) };
    }
    case "products": {
      const [total, records] = await Promise.all([ProductDefinition.countDocuments({ scope: "live" }), ProductDefinition.find({ scope: "live" }).sort({ createdAt: 1 }).skip(skip).limit(50).lean()]);
      return { title: "Live product catalog", total, columns: ["Product", "Name", "Enabled", "Credits / action", "Revision", "Updated"], rows: records.map(row => [row.slug, row.name, row.enabled ? "Yes" : "No", String(row.cost), String(row.revision), date(row.updatedAt)]) };
    }
    case "scans": {
      const [total, records] = await Promise.all([ScanRun.countDocuments(liveOwner), ScanRun.find(liveOwner).sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Scan runs", total, columns: ["ID", "User ID", "Pair", "Status", "Outcome", "Charged", "Summary", "Created"], rows: records.map(row => [id(row._id), id(row.userId), row.symbol, row.status, row.outcome || "—", row.charged ? "Yes" : "No", row.summary || "—", date(row.createdAt)]) };
    }
    case "signals": {
      const [total, records] = await Promise.all([Signal.countDocuments(liveOwner), Signal.find(liveOwner).sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Signals", total, columns: ["ID", "User ID", "Pair", "Status", "Entry", "Stop", "Target", "Thesis", "Created"], rows: records.map(row => [id(row._id), id(row.userId), row.symbol, row.status, String(row.entry), String(row.stop), String(row.target), row.thesis, date(row.createdAt)]) };
    }
    case "paper": {
      const [total, records] = await Promise.all([PaperOutcome.countDocuments(liveOwner), PaperOutcome.find(liveOwner).sort({ updatedAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Paper outcomes", total, columns: ["Signal ID", "User ID", "Status", "Reason", "Net return %", "Method", "Checked"], rows: records.map(row => [id(row.signalId), id(row.userId), row.status, row.reason, row.netReturnPct === null ? "—" : String(row.netReturnPct), row.methodVersion, date(row.checkedAt)]) };
    }
    case "orders": {
      const [total, records] = await Promise.all([Order.countDocuments(liveOwner), Order.find(liveOwner).sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Exchange orders", total, columns: ["User ID", "Pair", "Side", "Quantity", "Status", "Client ID", "Exchange ID", "Created"], rows: records.map(row => [id(row.userId), row.symbol, row.side, row.quantity, row.status, row.clientOrderId, row.exchangeOrderId || "—", date(row.createdAt)]) };
    }
    case "connections": {
      const [total, records] = await Promise.all([ExchangeConnection.countDocuments(liveOwner), ExchangeConnection.find(liveOwner).sort({ createdAt: -1 }).skip(skip).limit(50).select("userId provider market environment keyLast4 status access ipRestricted lastCheckedAt createdAt").lean()]);
      return { title: "Exchange connections", total, columns: ["User ID", "Provider", "Market", "Environment", "Key ending", "Status", "Access", "IP restricted", "Last checked", "Created"], rows: records.map(row => [id(row.userId), row.provider, row.market, row.environment, `····${row.keyLast4}`, row.status, row.access, row.ipRestricted ? "Yes" : "No", date(row.lastCheckedAt), date(row.createdAt)]) };
    }
    case "credits": {
      const [total, records] = await Promise.all([CreditEntry.countDocuments(liveOwner), CreditEntry.find(liveOwner).sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Credit ledger", total, columns: ["User ID", "Product", "Amount", "Kind", "Source key", "Note", "Created"], rows: records.map(row => [id(row.userId), row.productId ?? "platform", String(row.amount), row.kind, row.sourceKey, row.note, date(row.createdAt)]) };
    }
    case "billing": {
      const [total, records] = await Promise.all([BillingPurchase.countDocuments({ isDemo: { $ne: true } }), BillingPurchase.find({ isDemo: { $ne: true } }).sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Live billing purchases", total, columns: ["User ID", "Product", "Kind", "Item", "Credits", "Amount minor", "Currency", "Status", "Reference", "Verified"], rows: records.map(row => [id(row.userId), row.productId, row.kind, row.itemId, String(row.credits), String(row.expectedAmount), row.currency, row.status, row.reference, date(row.verifiedAt)]) };
    }
    case "paystack": {
      const [total, records] = await Promise.all([PaystackCheckout.countDocuments(liveOwner), PaystackCheckout.find(liveOwner).sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Paystack test checkouts", total, columns: ["User ID", "Plan", "Amount", "Currency", "Status", "Reference", "Verified", "Created"], rows: records.map(row => [id(row.userId), row.planId, String(row.expectedAmount), row.currency, row.status, row.reference, date(row.verifiedAt), date(row.createdAt)]) };
    }
    case "payment-events": {
      const [total, records] = await Promise.all([PaystackWebhookEvent.countDocuments(), PaystackWebhookEvent.find().sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Payment webhook events", total, columns: ["Type", "Reference", "Outcome", "Created"], rows: records.map(row => [row.type, row.reference || "—", row.outcome, date(row.createdAt)]) };
    }
    case "notifications": {
      const [total, records] = await Promise.all([Notification.countDocuments(liveOwner), Notification.find(liveOwner).sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Notifications", total, columns: ["User ID", "Kind", "Title", "Read", "Created"], rows: records.map(row => [id(row.userId), row.kind, row.title, row.readAt ? "Yes" : "No", date(row.createdAt)]) };
    }
    case "emails": {
      const [total, records] = await Promise.all([EmailDelivery.countDocuments(), EmailDelivery.find().sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Email deliveries", total, columns: ["Recipient", "Category", "Status", "Provider ID", "Last error", "Updated"], rows: records.map(row => [row.recipient, row.category, row.status, row.providerId || "—", row.lastError || "—", date(row.updatedAt)]) };
    }
    case "admin-audit": {
      const liveAudit = { actorId: { $nin: demoIds } };
      const [total, records] = await Promise.all([AdminAuditEvent.countDocuments(liveAudit), AdminAuditEvent.find(liveAudit).sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Admin audit", total, columns: ["Actor ID", "Target type", "Target ID", "Action", "Before", "After", "Status", "Reason", "Created"], rows: records.map(row => [id(row.actorId), row.targetType || "user", row.targetId || (row.targetUserId ? id(row.targetUserId) : "—"), row.action, row.before, row.after, row.status, row.reason, date(row.createdAt)]) };
    }
    case "security-audit": {
      const scope = { organizationId };
      const [total, records] = await Promise.all([AuthorizationAuditLog.countDocuments(scope), AuthorizationAuditLog.find(scope).sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Immutable security audit", total, columns: ["Actor ID", "Action", "Resource", "Target", "Outcome", "Reason", "IP", "Request ID", "Created"], rows: records.map(row => [row.actorId ? id(row.actorId) : "Unauthenticated", row.action, row.resource, `${row.targetType}${row.targetId ? ` · ${row.targetId}` : ""}`, row.outcome, row.reason || "—", row.ip || "—", row.requestId || "—", date(row.createdAt)]) };
    }
  }
}

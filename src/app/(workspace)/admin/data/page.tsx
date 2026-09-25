import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
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
const categories = ["users", "scans", "signals", "paper", "orders", "credits", "paystack", "payment-events", "emails", "admin-audit"] as const;
type Category = typeof categories[number];
type Table = { title: string; columns: string[]; rows: string[][]; total: number };
const id = (value: unknown) => String(value);
const date = (value: Date | null | undefined) => value ? new Date(value).toLocaleString() : "—";

export default async function AdminDataPage({ searchParams }: { searchParams: Promise<{ category?: string; page?: string }> }) {
  const session = await getServerSession(authOptions);
  await connectDB();
  const actor = session?.user.id ? await User.findById(session.user.id).select("role status").lean() : null;
  if (!actor || actor.role !== "admin" || actor.status !== "active") notFound();
  const params = await searchParams;
  const category: Category = categories.includes(params.category as Category) ? params.category as Category : "users";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const table = await loadTable(category, (page - 1) * 50);
  return <>
    <PageIntro eyebrow="Operations / records" title="Data explorer" description="Paginated read-only records across the platform. Password hashes, email tokens, API credentials, and other secrets are never shown here."/>
    <nav aria-label="Record categories" className="app-scrollbar mb-5 flex flex-wrap gap-2">{categories.map(item => <Link key={item} href={`/admin/data?category=${item}`} className={`rounded-lg border px-3 py-2 text-xs font-bold capitalize ${item === category ? "border-[#8eba4f] bg-[#c5ff4117] text-accent" : "border-line text-muted hover:text-white"}`}>{item.replaceAll("-", " ")}</Link>)}</nav>
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title={table.title} detail={`${table.total} records · page ${page}`}/>{table.rows.length ? <div className="app-scrollbar overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-line uppercase tracking-widest text-muted"><tr>{table.columns.map(column => <th key={column} className="whitespace-nowrap py-3 pr-5">{column}</th>)}</tr></thead><tbody className="divide-y divide-line">{table.rows.map((row, index) => <tr key={`${category}:${page}:${index}`}>{row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[320px] break-words py-3 pr-5 align-top text-[#d6e0d3]">{cell}</td>)}</tr>)}</tbody></table></div> : <EmptyState title="No records on this page" text="Select another category or go back a page."/>}<div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs"><span className="text-muted">Showing {table.rows.length} of {table.total} · 50 per page</span><div className="flex gap-2">{page > 1 && <Link href={`/admin/data?category=${category}&page=${page - 1}`} className="button-secondary rounded-lg px-3 py-2 font-bold">Previous</Link>}{page * 50 < table.total && <Link href={`/admin/data?category=${category}&page=${page + 1}`} className="button-secondary rounded-lg px-3 py-2 font-bold">Next</Link>}</div></div></section>
    <p className="mt-5 text-xs leading-6 text-muted">This view shows selected operational fields, not raw database documents or payment-card data. All record changes must go through specific audited workflows.</p>
  </>;
}

async function loadTable(category: Category, skip: number): Promise<Table> {
  switch (category) {
    case "users": {
      const [total, records] = await Promise.all([User.countDocuments(), User.find().sort({ createdAt: -1 }).skip(skip).limit(50).select("email name role status countryCode creditBalance emailVerifiedAt isDemo createdAt").lean()]);
      return { title: "Users", total, columns: ["Email", "Name", "Role", "Status", "Country", "Credits", "Verified", "Demo", "Created"], rows: records.map(row => [row.email, row.name, row.role, row.status, row.countryCode || "—", String(row.creditBalance), date(row.emailVerifiedAt), row.isDemo ? "Yes" : "No", date(row.createdAt)]) };
    }
    case "scans": {
      const [total, records] = await Promise.all([ScanRun.countDocuments(), ScanRun.find().sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Scan runs", total, columns: ["ID", "User ID", "Pair", "Status", "Outcome", "Charged", "Summary", "Created"], rows: records.map(row => [id(row._id), id(row.userId), row.symbol, row.status, row.outcome || "—", row.charged ? "Yes" : "No", row.summary || "—", date(row.createdAt)]) };
    }
    case "signals": {
      const [total, records] = await Promise.all([Signal.countDocuments(), Signal.find().sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Signals", total, columns: ["ID", "User ID", "Pair", "Status", "Entry", "Stop", "Target", "Thesis", "Created"], rows: records.map(row => [id(row._id), id(row.userId), row.symbol, row.status, String(row.entry), String(row.stop), String(row.target), row.thesis, date(row.createdAt)]) };
    }
    case "paper": {
      const [total, records] = await Promise.all([PaperOutcome.countDocuments(), PaperOutcome.find().sort({ updatedAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Paper outcomes", total, columns: ["Signal ID", "User ID", "Status", "Reason", "Net return %", "Method", "Checked"], rows: records.map(row => [id(row.signalId), id(row.userId), row.status, row.reason, row.netReturnPct === null ? "—" : String(row.netReturnPct), row.methodVersion, date(row.checkedAt)]) };
    }
    case "orders": {
      const [total, records] = await Promise.all([Order.countDocuments(), Order.find().sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Exchange orders", total, columns: ["User ID", "Pair", "Side", "Quantity", "Status", "Client ID", "Exchange ID", "Created"], rows: records.map(row => [id(row.userId), row.symbol, row.side, row.quantity, row.status, row.clientOrderId, row.exchangeOrderId || "—", date(row.createdAt)]) };
    }
    case "credits": {
      const [total, records] = await Promise.all([CreditEntry.countDocuments(), CreditEntry.find().sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Credit ledger", total, columns: ["User ID", "Amount", "Kind", "Source key", "Note", "Created"], rows: records.map(row => [id(row.userId), String(row.amount), row.kind, row.sourceKey, row.note, date(row.createdAt)]) };
    }
    case "paystack": {
      const [total, records] = await Promise.all([PaystackCheckout.countDocuments(), PaystackCheckout.find().sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Paystack test checkouts", total, columns: ["User ID", "Plan", "Amount", "Currency", "Status", "Reference", "Verified", "Created"], rows: records.map(row => [id(row.userId), row.planId, String(row.expectedAmount), row.currency, row.status, row.reference, date(row.verifiedAt), date(row.createdAt)]) };
    }
    case "payment-events": {
      const [total, records] = await Promise.all([PaystackWebhookEvent.countDocuments(), PaystackWebhookEvent.find().sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Payment webhook events", total, columns: ["Type", "Reference", "Outcome", "Created"], rows: records.map(row => [row.type, row.reference || "—", row.outcome, date(row.createdAt)]) };
    }
    case "emails": {
      const [total, records] = await Promise.all([EmailDelivery.countDocuments(), EmailDelivery.find().sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Email deliveries", total, columns: ["Recipient", "Category", "Status", "Provider ID", "Last error", "Updated"], rows: records.map(row => [row.recipient, row.category, row.status, row.providerId || "—", row.lastError || "—", date(row.updatedAt)]) };
    }
    case "admin-audit": {
      const [total, records] = await Promise.all([AdminAuditEvent.countDocuments(), AdminAuditEvent.find().sort({ createdAt: -1 }).skip(skip).limit(50).lean()]);
      return { title: "Admin audit", total, columns: ["Actor ID", "Target ID", "Action", "Before", "After", "Status", "Reason", "Created"], rows: records.map(row => [id(row.actorId), id(row.targetUserId), row.action, row.before, row.after, row.status, row.reason, date(row.createdAt)]) };
    }
  }
}

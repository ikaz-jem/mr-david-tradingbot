import Link from "next/link";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { User } from "@/models/User";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { ProductDefinition } from "@/models/ProductDefinition";
import { ScanRun } from "@/models/ScanRun";
import { Signal } from "@/models/Signal";
import { PaperOutcome } from "@/models/PaperOutcome";
import { Order } from "@/models/Order";
import { Notification } from "@/models/Notification";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { DemoEmail } from "@/models/DemoEmail";
import type { Types } from "mongoose";

const categories = ["users", "products", "scans", "signals", "paper", "orders", "connections", "credits", "billing", "paystack", "payment-events", "notifications", "emails", "admin-audit"] as const;
type Category = typeof categories[number];
type Table = { title: string; columns: string[]; rows: string[][] };
type DemoUserRow = { _id: Types.ObjectId; email: string; name: string; role: string; status: string; countryCode?: string | null; createdAt: Date };
type DemoWorkspaceRow = { userId: Types.ObjectId; connections: { provider?: string | null; label?: string | null; connectedAt?: Date | null }[]; activity: { productId?: string | null; amount?: number | null; note?: string | null; createdAt?: Date | null }[]; receipts: { kind?: string | null; itemId?: string | null; productId?: string | null; amount?: number | null; credits?: number | null; createdAt?: Date | null }[] };
const value = (input: unknown) => input === null || input === undefined ? "—" : String(input);
const date = (input: unknown) => input ? new Date(input as string | number | Date).toLocaleString() : "—";

export async function DemoDataExplorer({ category, page }: { category: Category; page: number }) {
  const users = await User.find({ isDemo: true }).select("name email role status countryCode createdAt").lean();
  const ids = users.map(user => user._id);
  const names = new Map(users.map(user => [String(user._id), user.email]));
  const workspaces = await DemoWorkspace.find({ userId: { $in: ids } }).lean();
  const table = await load(category, ids, names, users as unknown as DemoUserRow[], workspaces as unknown as DemoWorkspaceRow[]);
  const skip = (page - 1) * 50;
  const rows = table.rows.slice(skip, skip + 50);
  return <><PageIntro eyebrow="Demo operations / records" title="Data explorer" description="Production-shaped operational records scoped to demo accounts. Real customer records and secrets are excluded."/>
    <nav aria-label="Record categories" className="app-scrollbar mb-5 flex flex-wrap gap-2">{categories.map(item => <Link key={item} href={"/admin/data?category=" + item} className={"rounded-lg border px-3 py-2 text-xs font-bold capitalize " + (item === category ? "border-[#8eba4f] bg-[#c5ff4117] text-accent" : "border-line text-muted hover:text-white")}>{item.replaceAll("-", " ")}</Link>)}</nav>
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title={table.title} detail={table.rows.length + " demo records · page " + page}/>{rows.length ? <div className="app-scrollbar overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-line uppercase tracking-widest text-muted"><tr>{table.columns.map(column => <th key={column} className="whitespace-nowrap py-3 pr-5">{column}</th>)}</tr></thead><tbody className="divide-y divide-line">{rows.map((row, index) => <tr key={category + ":" + index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="max-w-[320px] break-words py-3 pr-5 align-top text-[#d6e0d3]">{cell}</td>)}</tr>)}</tbody></table></div> : <EmptyState title="No demo records yet" text="Use the related demo workflow to create records in this category."/>}<div className="mt-5 flex justify-between border-t border-line pt-4 text-xs"><span className="text-muted">Showing {rows.length} of {table.rows.length}</span><div className="flex gap-2">{page > 1 && <Link href={"/admin/data?category=" + category + "&page=" + (page - 1)} className="button-secondary rounded-lg px-3 py-2 font-bold">Previous</Link>}{page * 50 < table.rows.length && <Link href={"/admin/data?category=" + category + "&page=" + (page + 1)} className="button-secondary rounded-lg px-3 py-2 font-bold">Next</Link>}</div></div></section>
  </>;
}

async function load(category: Category, ids: Types.ObjectId[], names: Map<string, string>, users: DemoUserRow[], workspaces: DemoWorkspaceRow[]): Promise<Table> {
  if (category === "users") return { title: "Users", columns: ["Email", "Name", "Role", "Status", "Country", "Created"], rows: users.map(user => [user.email, user.name, user.role, user.status, user.countryCode || "—", date(user.createdAt)]) };
  if (category === "products") {
    const records = await ProductDefinition.find({ scope: "demo" }).sort({ createdAt: 1 }).lean();
    return { title: "Products", columns: ["ID", "Name", "Enabled", "Credits / action", "Revision"], rows: records.map(row => [row.slug, row.name, row.enabled ? "Yes" : "No", value(row.cost), value(row.revision)]) };
  }
  if (category === "scans") {
    const records = await ScanRun.find({ userId: { $in: ids } }).sort({ createdAt: -1 }).limit(500).lean();
    return { title: "Scan runs", columns: ["Customer", "Pair", "Interval", "Status", "Outcome", "Charged", "Created"], rows: records.map(row => [names.get(String(row.userId)) || "Demo user", row.symbol, row.interval, row.status, row.outcome || "—", row.charged ? "Yes" : "No", date(row.createdAt)]) };
  }
  if (category === "signals") {
    const records = await Signal.find({ userId: { $in: ids } }).sort({ createdAt: -1 }).limit(500).lean();
    return { title: "Signals", columns: ["Customer", "Pair", "Interval", "Status", "Entry", "Stop", "Target", "Created"], rows: records.map(row => [names.get(String(row.userId)) || "Demo user", row.symbol, row.interval, row.status, value(row.entry), value(row.stop), value(row.target), date(row.createdAt)]) };
  }
  if (category === "paper") {
    const records = await PaperOutcome.find({ userId: { $in: ids } }).sort({ updatedAt: -1 }).limit(500).lean();
    return { title: "Paper outcomes", columns: ["Customer", "Status", "Reason", "Return %", "Method", "Checked"], rows: records.map(row => [names.get(String(row.userId)) || "Demo user", row.status, row.reason, value(row.netReturnPct), row.methodVersion, date(row.checkedAt)]) };
  }
  if (category === "orders") {
    const records = await Order.find({ userId: { $in: ids } }).sort({ createdAt: -1 }).limit(500).lean();
    return { title: "Orders", columns: ["Customer", "Pair", "Side", "Quantity", "Status", "Created"], rows: records.map(row => [names.get(String(row.userId)) || "Demo user", row.symbol, row.side, row.quantity, row.status, date(row.createdAt)]) };
  }
  if (category === "connections") return { title: "Exchange connections", columns: ["Customer", "Provider", "Label", "Connected"], rows: workspaces.flatMap(workspace => workspace.connections.map(row => [names.get(String(workspace.userId)) || "Demo user", row.provider || "—", row.label || "Spot account", date(row.connectedAt)])) };
  if (category === "credits") return { title: "Credit ledger", columns: ["Customer", "Product", "Amount", "Note", "Created"], rows: workspaces.flatMap(workspace => workspace.activity.map(row => [names.get(String(workspace.userId)) || "Demo user", row.productId || "—", value(row.amount), row.note || "—", date(row.createdAt)])) };
  if (category === "billing") return { title: "Billing purchases", columns: ["Customer", "Kind", "Item", "Amount", "Credits", "Created"], rows: workspaces.flatMap(workspace => workspace.receipts.filter(row => ["activation", "topup"].includes(row.kind || "")).map(row => [names.get(String(workspace.userId)) || "Demo user", row.kind || "—", row.itemId || row.productId || "—", "$" + value(row.amount), value(row.credits), date(row.createdAt)])) };
  if (category === "notifications") {
    const records = await Notification.find({ userId: { $in: ids } }).sort({ createdAt: -1 }).limit(500).lean();
    return { title: "Notifications", columns: ["Customer", "Kind", "Title", "Read", "Created"], rows: records.map(row => [names.get(String(row.userId)) || "Demo user", row.kind, row.title, row.readAt ? "Yes" : "No", date(row.createdAt)]) };
  }
  if (category === "emails") {
    const records = await DemoEmail.find().sort({ createdAt: -1 }).limit(500).lean();
    return { title: "Email outbox", columns: ["Recipient", "Category", "Subject", "Status", "Created"], rows: records.map(row => [row.recipient, row.category, row.subject, "Simulated", date(row.createdAt)]) };
  }
  if (category === "admin-audit") {
    const records = await AdminAuditEvent.find({ actorId: { $in: ids } }).sort({ createdAt: -1 }).limit(500).lean();
    return { title: "Admin audit", columns: ["Actor", "Action", "Target", "Before", "After", "Status", "Reason", "Created"], rows: records.map(row => [names.get(String(row.actorId)) || "Demo admin", row.action, row.targetId || row.targetType, row.before, row.after, row.status, row.reason, date(row.createdAt)]) };
  }
  return { title: category === "paystack" ? "Payment checkouts" : "Payment events", columns: ["Status"], rows: [] };
}

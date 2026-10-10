import Link from "next/link";
import { CreditCard } from "lucide-react";
import { connectDB } from "@/lib/db";
import { Order } from "@/models/Order";
import { User } from "@/models/User";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { notFound } from "next/navigation";
import { workspaceActor } from "@/lib/workspace-access";
import { AdminOrderReconcile } from "@/components/admin-order-reconcile";

export const dynamic = "force-dynamic";
const statuses = ["all", "intent", "submitted", "unknown", "partial", "filled", "rejected", "cancelled"] as const;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await connectDB();
  const actor = await workspaceActor();
  if (!actor?.can("orders:read")) notFound();
  const demoUserIds = await User.distinct("_id", { isDemo: true });
  const params = await searchParams;
  const status = statuses.includes(params.status as typeof statuses[number]) ? params.status as typeof statuses[number] : "all";
  const page = Math.min(1000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const ownerScope = actor.isDemo ? { userId: { $in: demoUserIds } } : { userId: { $nin: demoUserIds } };
  const filter = { ...(status === "all" ? {} : { status }), ...ownerScope };
  const [total, unknown, filled, matching, orders] = await Promise.all([
    Order.countDocuments(ownerScope), Order.countDocuments({ ...ownerScope, status: "unknown" }), Order.countDocuments({ ...ownerScope, status: "filled" }),
    Order.countDocuments(filter), Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 50).limit(50).lean(),
  ]);
  const owners = await User.find({ _id: { $in: orders.map(order => order.userId) } }).select("email").lean();
  const emailById = new Map(owners.map(owner => [String(owner._id), owner.email]));
  const href = (next: number) => `/admin/orders?status=${status}&page=${next}`;
  const canReconcile = !actor.isDemo && actor.can("orders:update");
  return <><PageIntro eyebrow="Operations / exchange" title="Orders" description="Inspect recorded order intent, submission, unknown status, fills, and failures. No order can be placed from this admin screen."/><div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Total orders" value={total}/><Metric label="Needs reconciliation" value={unknown}/><Metric label="Filled" value={filled}/></div><section className="surface rounded-[20px] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><SectionHeader title="Order activity" detail={`${matching} matching records · page ${page}`}/><form action="/admin/orders" className="flex gap-2"><label className="sr-only" htmlFor="order-status">Order status</label><select id="order-status" name="status" defaultValue={status} className="rounded-lg border border-line bg-[#111a13] px-3 py-2 text-sm text-white">{statuses.map(item => <option key={item} value={item}>{item === "all" ? "All statuses" : item}</option>)}</select><button className="button-secondary rounded-lg px-4 py-2 text-xs font-bold">Filter</button></form></div>{orders.length ? <div className="app-scrollbar overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="border-b border-line uppercase tracking-widest text-muted"><tr><th className="py-3 pr-4">Customer</th><th className="pr-4">Market</th><th className="pr-4">Side</th><th className="pr-4">Requested</th><th className="pr-4">Filled</th><th className="pr-4">Status</th><th className="pr-4">Exchange ID</th><th className="pr-4">Created</th>{canReconcile && <th>Action</th>}</tr></thead><tbody className="divide-y divide-line">{orders.map(order => <tr key={String(order._id)}><td className="py-3 pr-4">{emailById.get(String(order.userId)) ?? "Unknown account"}</td><td className="pr-4">{order.symbol}<div className="mt-1 text-[10px] text-muted">{order.exchange.replaceAll("_", " ")}</div></td><td className="pr-4">{order.side}</td><td className="pr-4 number">{order.source === "approval" ? `${order.quoteAmount.toFixed(2)} USDT` : order.quantity}</td><td className="pr-4 number">{order.filledQuoteAmount !== "0" ? `${order.filledQuoteAmount} USDT` : order.filledQuantity}</td><td className={`pr-4 font-bold uppercase ${order.status === "unknown" || order.status === "protection_failed" ? "text-[#ff939b]" : "text-accent"}`}>{order.status}</td><td className="pr-4 font-mono">{order.exchangeOrderId ?? "—"}</td><td className="pr-4">{new Date(order.createdAt).toLocaleString()}</td>{canReconcile && <td>{order.source === "approval" && order.market !== "futures" && ["intent", "unknown", "submitted", "partial"].includes(order.status) ? <AdminOrderReconcile orderId={String(order._id)}/> : <span className="text-muted">—</span>}</td>}</tr>)}</tbody></table></div> : <EmptyState icon={CreditCard} title={status === "all" ? "No exchange orders yet" : `No ${status} orders`} text={status === "all" ? "No user-confirmed exchange orders have been recorded yet. Opportunities never create orders automatically." : "Try another status filter."}/>}<div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs"><span className="text-muted">Showing {orders.length} of {matching}</span><div className="flex gap-2">{page > 1 && <Link href={href(page - 1)} className="button-secondary rounded-lg px-3 py-2 font-bold">Previous</Link>}{page * 50 < matching && <Link href={href(page + 1)} className="button-secondary rounded-lg px-3 py-2 font-bold">Next</Link>}</div></div></section><p className="mt-5 text-xs leading-5 text-muted">Reconciliation only queries the existing Spot order at the connected exchange; it never resubmits an order. Futures and protection failures require exchange-side review until provider-specific status reconciliation is available.</p></>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="surface rounded-[18px] p-5"><div className="text-xs font-semibold text-muted">{label}</div><div className="mt-5 text-3xl font-semibold number">{value}</div></div>; }

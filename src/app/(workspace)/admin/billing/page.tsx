import { notFound } from "next/navigation";
import { workspaceActor } from "@/lib/workspace-access";
import { connectDB } from "@/lib/db";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { PaystackCheckout } from "@/models/PaystackCheckout";
import { PaystackWebhookEvent } from "@/models/PaystackWebhookEvent";
import { User } from "@/models/User";
import { BillingPurchase } from "@/models/BillingPurchase";
import { AdminBillingAdjustment } from "@/components/admin-billing-adjustment";
import Link from "next/link";
import { GatewayPurchaseHistory } from "@/components/gateway-purchase-history";
import { DemoBillingOperations } from "@/components/demo-billing-operations";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  await connectDB();
  const actor = await workspaceActor();
  if (!actor?.can("billing:read")) notFound();
  if (actor.isDemo) return <><PageIntro eyebrow="Commerce operations" title="Billing operations" description="Review demo activations, shared balances, and credit refills."/><GatewayPurchaseHistory isDemo/><DemoBillingOperations/></>;
  const [checkouts, webhooks, pending, paidTest, reviews, livePurchases, activatedAccounts, eligibleUsers] = await Promise.all([
    PaystackCheckout.find().sort({ createdAt: -1 }).limit(100).lean(),
    PaystackWebhookEvent.find().sort({ createdAt: -1 }).limit(50).lean(),
    PaystackCheckout.countDocuments({ status: { $in: ["initializing", "pending"] } }),
    PaystackCheckout.countDocuments({ status: "paid_test" }),
    PaystackCheckout.countDocuments({ status: "review" }),
    BillingPurchase.find({ isDemo: { $ne: true } }).sort({ createdAt: -1 }).limit(100).lean(),
    User.find({ isDemo: false, activatedAt: { $ne: null } }).sort({ activatedAt: -1 }).limit(100).select("email activatedAt activationReference creditBalance").lean(),
    User.find({ status: "active", isDemo: false, role: { $ne: "admin" } }).sort({ createdAt: -1 }).limit(200).select("email").lean(),
  ]);
  const userIds = [...new Set([...checkouts, ...livePurchases].map(checkout => String(checkout.userId)))];
  const users = await User.find({ _id: { $in: userIds } }).select("email").lean();
  const emailById = new Map(users.map(user => [String(user._id), user.email]));
  return <>
    <PageIntro eyebrow="Operations / billing" title="Billing operations" description="Review permanent activations, verified credit refills, payment events, and audited balance corrections."/>
    <div className="mb-5 rounded-xl border border-line bg-[#17221a] p-4 text-sm text-muted">Accounts activate once; there are no monthly renewals. {actor.can("settings:read") && <Link className="text-accent" href="/admin/controls/payments">Configure Paystack and crypto payments →</Link>}</div>
    <GatewayPurchaseHistory isDemo={false}/>
    <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Activated accounts" detail={`Latest ${activatedAccounts.length}`}/>{activatedAccounts.length ? <div className="app-scrollbar overflow-x-auto"><table className="w-full min-w-[690px] text-left text-xs"><thead className="border-b border-line uppercase tracking-widest text-muted"><tr><th className="py-3">Account</th><th>Access</th><th>Activated</th><th>Reference</th><th>Shared credits</th></tr></thead><tbody className="divide-y divide-line">{activatedAccounts.map(account => <tr key={String(account._id)}><td className="py-3">{account.email}</td><td className="text-accent">Permanent</td><td>{account.activatedAt ? new Date(account.activatedAt).toLocaleString() : "—"}</td><td className="font-mono">{account.activationReference ?? "Admin/migration"}</td><td className="number">{account.creditBalance}</td></tr>)}</tbody></table></div> : <EmptyState title="No activated accounts" text="Verified activations and audited manual activations will appear here."/>}</section>
    {!actor.isDemo && <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Audited account correction" detail="Real admins only · for support and reconciliation"/><AdminBillingAdjustment users={eligibleUsers.map(user => ({ id: String(user._id), email: user.email }))}/></section>}
    <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Live purchases" detail={`Latest ${livePurchases.length} · verified payments only grant credits`}/>{livePurchases.length ? <div className="app-scrollbar overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-line uppercase tracking-widest text-muted"><tr><th className="py-3">Customer</th><th>Item</th><th>Amount</th><th>Credits</th><th>Status</th><th>Reference</th></tr></thead><tbody className="divide-y divide-line">{livePurchases.map(item => <tr key={String(item._id)}><td className="py-3">{emailById.get(String(item.userId)) ?? "Unknown"}</td><td>{item.itemId}</td><td>{(item.expectedAmount / 100).toLocaleString()} {item.currency}</td><td>{item.credits}</td><td className={item.status === "review" ? "text-[#ff939b]" : ""}>{item.status}</td><td className="font-mono">{item.reference}</td></tr>)}</tbody></table></div> : <EmptyState title="No live purchases" text="Purchases appear after live checkout is intentionally configured."/>}</section>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Pending test checkouts" value={pending}/><Metric label="Verified test payments" value={paidTest}/><Metric label="Needs review" value={reviews}/></div>
    <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Legacy test checkouts" detail={`Latest ${checkouts.length} · retained for audit only`}/>{checkouts.length ? <div className="app-scrollbar overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-line uppercase tracking-widest text-muted"><tr><th className="py-3">Customer</th><th>Legacy item</th><th>Amount</th><th>Status</th><th>Reference</th><th>Created</th></tr></thead><tbody className="divide-y divide-line">{checkouts.map(checkout => <tr key={String(checkout._id)}><td className="py-3">{emailById.get(String(checkout.userId)) ?? "Unknown account"}</td><td className="capitalize">{checkout.planId}</td><td>{(checkout.expectedAmount / 100).toLocaleString()} {checkout.currency}</td><td className="uppercase">{checkout.status.replaceAll("_", " ")}</td><td className="font-mono">{checkout.reference}</td><td>{new Date(checkout.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <EmptyState title="No legacy test checkouts" text="New activation and refill testing uses the current checkout flow."/>}</section>
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Payment webhook events" detail={`Latest ${webhooks.length}`}/>{webhooks.length ? <div className="divide-y divide-line">{webhooks.map(event => <div key={String(event._id)} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"><div><b>{event.type}</b><span className="ml-3 text-muted">{event.reference || "No reference"}</span></div><div><span className={event.outcome === "review" ? "text-[#ff939b]" : "text-accent"}>{event.outcome}</span><span className="ml-4 text-muted">{new Date(event.createdAt).toLocaleString()}</span></div></div>)}</div> : <EmptyState title="No webhook events" text="Signed Paystack test events will appear here when a public callback endpoint is configured."/>}</section>
  </>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="surface rounded-[18px] p-5"><div className="text-xs text-muted">{label}</div><div className="mt-3 text-3xl font-bold number">{value}</div></div>; }

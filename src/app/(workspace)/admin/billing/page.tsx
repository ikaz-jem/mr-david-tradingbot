import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { PaystackCheckout } from "@/models/PaystackCheckout";
import { PaystackWebhookEvent } from "@/models/PaystackWebhookEvent";
import { User } from "@/models/User";
import { BillingPurchase } from "@/models/BillingPurchase";
import { ProductAccount } from "@/models/ProductAccount";
import { AdminBillingAdjustment } from "@/components/admin-billing-adjustment";
import { liveBillingConfig } from "@/lib/billing-catalog";
import { DemoBillingOperations } from "@/components/demo-billing-operations";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const session = await getServerSession(authOptions);
  await connectDB();
  const actor = session?.user.id ? await User.findById(session.user.id).select("role status isDemo").lean() : null;
  if (!actor || actor.role !== "admin" || actor.status !== "active") notFound();
  if (actor.isDemo) return <><PageIntro eyebrow="Commerce operations" title="Billing operations" description="Review demo memberships, separate product wallets, renewals, and credit purchases."/><DemoBillingOperations/></>;
  const [checkouts, webhooks, pending, paidTest, reviews, livePurchases, productAccounts, eligibleUsers] = await Promise.all([
    PaystackCheckout.find().sort({ createdAt: -1 }).limit(100).lean(),
    PaystackWebhookEvent.find().sort({ createdAt: -1 }).limit(50).lean(),
    PaystackCheckout.countDocuments({ status: { $in: ["initializing", "pending"] } }),
    PaystackCheckout.countDocuments({ status: "paid_test" }),
    PaystackCheckout.countDocuments({ status: "review" }),
    BillingPurchase.find().sort({ createdAt: -1 }).limit(100).lean(),
    ProductAccount.find({ productId: "signals" }).sort({ updatedAt: -1 }).limit(100).lean(),
    actor.isDemo ? Promise.resolve([]) : User.find({ status: "active", isDemo: false, role: { $ne: "admin" } }).sort({ createdAt: -1 }).limit(200).select("email").lean(),
  ]);
  const userIds = [...new Set([...checkouts, ...livePurchases, ...productAccounts].map(checkout => String(checkout.userId)))];
  const users = await User.find({ _id: { $in: userIds } }).select("email").lean();
  const emailById = new Map(users.map(user => [String(user._id), user.email]));
  return <>
    <PageIntro eyebrow="Operations / billing" title="Billing operations" description="Review product access, verified live purchases, sandbox tests, and audited account corrections."/>
    <div className="mb-5 rounded-xl border border-line bg-[#17221a] p-4 text-sm text-muted">Live checkout: <b className={liveBillingConfig() ? "text-accent" : "text-[#f2ca82]"}>{liveBillingConfig() ? "configured" : "disabled"}</b>. Monthly access is manually renewed; automatic recurring charges are not enabled.</div>
    <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Product access" detail={`Latest ${productAccounts.length} Trade research accounts`}/>{productAccounts.length ? <div className="app-scrollbar overflow-x-auto"><table className="w-full min-w-[690px] text-left text-xs"><thead className="border-b border-line uppercase tracking-widest text-muted"><tr><th className="py-3">Account</th><th>Plan</th><th>Access</th><th>Period end</th><th>Credits</th></tr></thead><tbody className="divide-y divide-line">{productAccounts.map(account => <tr key={String(account._id)}><td className="py-3">{emailById.get(String(account.userId)) ?? "Unknown"}</td><td className="capitalize">{account.planId ?? "Welcome"}</td><td className="capitalize">{account.subscriptionStatus === "active" && account.currentPeriodEnd && account.currentPeriodEnd < new Date() ? "Expired" : account.subscriptionStatus}</td><td>{account.currentPeriodEnd ? new Date(account.currentPeriodEnd).toLocaleDateString() : "—"}</td><td className="number">{account.creditBalance}</td></tr>)}</tbody></table></div> : <EmptyState title="No product accounts" text="Accounts appear when a user first opens billing or runs research."/>}</section>
    {!actor.isDemo && <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Audited account correction" detail="Real admins only · for support and reconciliation"/><AdminBillingAdjustment users={eligibleUsers.map(user => ({ id: String(user._id), email: user.email }))}/></section>}
    <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Live purchases" detail={`Latest ${livePurchases.length} · verified payments only grant credits`}/>{livePurchases.length ? <div className="app-scrollbar overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-line uppercase tracking-widest text-muted"><tr><th className="py-3">Customer</th><th>Item</th><th>Amount</th><th>Credits</th><th>Status</th><th>Reference</th></tr></thead><tbody className="divide-y divide-line">{livePurchases.map(item => <tr key={String(item._id)}><td className="py-3">{emailById.get(String(item.userId)) ?? "Unknown"}</td><td>{item.itemId}</td><td>{(item.expectedAmount / 100).toLocaleString()} {item.currency}</td><td>{item.credits}</td><td className={item.status === "review" ? "text-[#ff939b]" : ""}>{item.status}</td><td className="font-mono">{item.reference}</td></tr>)}</tbody></table></div> : <EmptyState title="No live purchases" text="Purchases appear after live checkout is intentionally configured."/>}</section>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Pending test checkouts" value={pending}/><Metric label="Verified test payments" value={paidTest}/><Metric label="Needs review" value={reviews}/></div>
    <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Test checkouts" detail={`Latest ${checkouts.length}`}/>{checkouts.length ? <div className="app-scrollbar overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-line uppercase tracking-widest text-muted"><tr><th className="py-3">Customer</th><th>Plan</th><th>Amount</th><th>Status</th><th>Reference</th><th>Created</th></tr></thead><tbody className="divide-y divide-line">{checkouts.map(checkout => <tr key={String(checkout._id)}><td className="py-3">{emailById.get(String(checkout.userId)) ?? "Unknown account"}</td><td className="capitalize">{checkout.planId}</td><td>{(checkout.expectedAmount / 100).toLocaleString()} {checkout.currency}</td><td className="uppercase">{checkout.status.replaceAll("_", " ")}</td><td className="font-mono">{checkout.reference}</td><td>{new Date(checkout.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <EmptyState title="No test checkouts" text="Paystack sandbox checkouts will appear after the local test key and monthly plan codes are configured."/>}</section>
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Payment webhook events" detail={`Latest ${webhooks.length}`}/>{webhooks.length ? <div className="divide-y divide-line">{webhooks.map(event => <div key={String(event._id)} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"><div><b>{event.type}</b><span className="ml-3 text-muted">{event.reference || "No reference"}</span></div><div><span className={event.outcome === "review" ? "text-[#ff939b]" : "text-accent"}>{event.outcome}</span><span className="ml-4 text-muted">{new Date(event.createdAt).toLocaleString()}</span></div></div>)}</div> : <EmptyState title="No webhook events" text="Signed Paystack test events will appear here when a public callback endpoint is configured."/>}</section>
  </>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="surface rounded-[18px] p-5"><div className="text-xs text-muted">{label}</div><div className="mt-3 text-3xl font-bold number">{value}</div></div>; }

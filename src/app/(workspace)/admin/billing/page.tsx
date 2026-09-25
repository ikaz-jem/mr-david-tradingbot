import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { PaystackCheckout } from "@/models/PaystackCheckout";
import { PaystackWebhookEvent } from "@/models/PaystackWebhookEvent";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const session = await getServerSession(authOptions);
  await connectDB();
  const actor = session?.user.id ? await User.findById(session.user.id).select("role status").lean() : null;
  if (!actor || actor.role !== "admin" || actor.status !== "active") notFound();
  const [checkouts, webhooks, pending, paidTest, reviews] = await Promise.all([
    PaystackCheckout.find().sort({ createdAt: -1 }).limit(100).lean(),
    PaystackWebhookEvent.find().sort({ createdAt: -1 }).limit(50).lean(),
    PaystackCheckout.countDocuments({ status: { $in: ["initializing", "pending"] } }),
    PaystackCheckout.countDocuments({ status: "paid_test" }),
    PaystackCheckout.countDocuments({ status: "review" }),
  ]);
  const userIds = [...new Set(checkouts.map(checkout => String(checkout.userId)))];
  const users = await User.find({ _id: { $in: userIds } }).select("email").lean();
  const emailById = new Map(users.map(user => [String(user._id), user.email]));
  return <>
    <PageIntro eyebrow="Operations / billing" title="Billing tests" description="Paystack sandbox checkout records and signed webhook results. No live billing, subscription entitlements, or paid credit grants exist yet."/>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Pending test checkouts" value={pending}/><Metric label="Verified test payments" value={paidTest}/><Metric label="Needs review" value={reviews}/></div>
    <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Test checkouts" detail={`Latest ${checkouts.length}`}/>{checkouts.length ? <div className="app-scrollbar overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-line uppercase tracking-widest text-muted"><tr><th className="py-3">Customer</th><th>Plan</th><th>Amount</th><th>Status</th><th>Reference</th><th>Created</th></tr></thead><tbody className="divide-y divide-line">{checkouts.map(checkout => <tr key={String(checkout._id)}><td className="py-3">{emailById.get(String(checkout.userId)) ?? "Unknown account"}</td><td className="capitalize">{checkout.planId}</td><td>{(checkout.expectedAmount / 100).toLocaleString()} {checkout.currency}</td><td className="uppercase">{checkout.status.replaceAll("_", " ")}</td><td className="font-mono">{checkout.reference}</td><td>{new Date(checkout.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <EmptyState title="No test checkouts" text="Paystack sandbox checkouts will appear after the local test key and monthly plan codes are configured."/>}</section>
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Payment webhook events" detail={`Latest ${webhooks.length}`}/>{webhooks.length ? <div className="divide-y divide-line">{webhooks.map(event => <div key={String(event._id)} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"><div><b>{event.type}</b><span className="ml-3 text-muted">{event.reference || "No reference"}</span></div><div><span className={event.outcome === "review" ? "text-[#ff939b]" : "text-accent"}>{event.outcome}</span><span className="ml-4 text-muted">{new Date(event.createdAt).toLocaleString()}</span></div></div>)}</div> : <EmptyState title="No webhook events" text="Signed Paystack test events will appear here when a public callback endpoint is configured."/>}</section>
  </>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="surface rounded-[18px] p-5"><div className="text-xs text-muted">{label}</div><div className="mt-3 text-3xl font-bold number">{value}</div></div>; }

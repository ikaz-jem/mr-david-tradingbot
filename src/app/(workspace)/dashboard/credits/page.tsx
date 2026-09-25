import { getServerSession } from "next-auth";
import { Coins, ReceiptText } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getCreditBalance } from "@/lib/credits";
import { paystackTestKey, paystackTestPlanCode } from "@/lib/paystack";
import { CreditEntry } from "@/models/CreditEntry";
import { PaystackCheckout } from "@/models/PaystackCheckout";
import { plans } from "@/lib/plans";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { PaystackTestButton } from "@/components/paystack-test-button";

export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const session = await getServerSession(authOptions);
  await connectDB();
  const userId = session!.user.id;
  const [balance, ledger, checkouts] = await Promise.all([
    getCreditBalance(userId),
    CreditEntry.find({ userId }).sort({ createdAt: -1 }).limit(30).lean(),
    PaystackCheckout.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);
  const sandbox = Boolean(paystackTestKey());
  return <>
    <PageIntro eyebrow="Usage & billing" title="Credits" description="Credits are used only for completed analyses. This ledger records grants, purchases, usage, and refunds."/>
    <div className="surface mb-5 flex flex-col justify-between gap-4 rounded-[20px] border-[#5a7c3c] bg-[#1a2a19] p-6 sm:flex-row sm:items-center"><div><p className="text-sm text-muted">Available balance</p><div className="mt-2 flex items-baseline gap-2"><span className="text-5xl font-semibold tracking-tight number">{balance}</span><span className="text-sm text-muted">credits</span></div></div><Coins className="size-9 text-accent"/></div>
    {sandbox && <div className="mb-5 rounded-xl border border-[#ae8242] bg-[#382811] p-4 text-xs leading-6 text-[#f2d6a1]"><b>Paystack test mode only.</b> These are simulated payments in the test plans&apos; configured currency, which may differ from the proposed USD prices below. A paid test transaction does not add credits or activate a subscription; billing fulfillment remains disabled.</div>}
    <div className="mb-5 grid gap-3 md:grid-cols-3">{plans.map(plan => <div key={plan.id} className="surface rounded-[18px] p-5"><span className="text-xs font-bold uppercase tracking-widest text-accent">{plan.name}</span><div className="mt-3 text-2xl font-bold number">{plan.credits} <span className="text-sm font-normal text-muted">credits / month</span></div><p className="mt-2 text-sm text-muted">Proposed pilot plan · ${plan.price}/month</p><p className="mt-4 text-xs leading-5 text-[#7f9181]">Live checkout opens only after provider approval and configuration.</p>{sandbox && paystackTestPlanCode(plan.id) && <PaystackTestButton planId={plan.id}/>}</div>)}</div>
    {checkouts.length > 0 && <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Paystack sandbox activity" detail="Test transactions; no real subscription or credit grants"/><div className="divide-y divide-line">{checkouts.map(checkout => <div key={String(checkout._id)} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><span className="font-bold capitalize">{checkout.planId}</span><span className="ml-2 text-xs text-muted">{checkout.reference}</span></div><span className="text-xs font-bold uppercase text-[#f2d6a1]">{checkout.status.replaceAll("_", " ")}</span></div>)}</div></section>}
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Credit activity" detail="An append-only record of balance changes"/>{ledger.length ? <div className="divide-y divide-line">{ledger.map(entry => <div key={String(entry._id)} className="flex items-center justify-between gap-3 py-4 text-sm"><div><div className="font-bold capitalize">{entry.kind}</div><div className="mt-1 text-xs text-muted">{new Date(entry.createdAt).toLocaleString()} · {entry.note}</div></div><span className={`font-bold number ${entry.amount >= 0 ? "text-accent" : "text-[#ff939b]"}`}>{entry.amount >= 0 ? "+" : ""}{entry.amount}</span></div>)}</div> : <EmptyState icon={ReceiptText} title="No credit activity" text="Grants and purchases will appear here when credits are added to your account."/>}</section>
  </>;
}

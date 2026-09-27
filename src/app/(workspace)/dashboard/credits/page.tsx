import { getServerSession } from "next-auth";
import { Coins, ReceiptText } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { billingPrice, liveBillingConfig, topups } from "@/lib/billing-catalog";
import { connectDB } from "@/lib/db";
import { getCreditBalance, productAccessActive } from "@/lib/credits";
import { CreditEntry } from "@/models/CreditEntry";
import { ProductAccount } from "@/models/ProductAccount";
import { BillingPurchase } from "@/models/BillingPurchase";
import { plans } from "@/lib/plans";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { BillingPurchaseButton } from "@/components/billing-purchase-button";

export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const session = await getServerSession(authOptions);
  await connectDB();
  const userId = session!.user.id;
  const balance = await getCreditBalance(userId);
  const [account, ledger, purchases] = await Promise.all([
    ProductAccount.findOne({ userId, productId: "signals" }).lean(),
    CreditEntry.find({ userId, productId: { $in: ["signals", null] } }).sort({ createdAt: -1 }).limit(40).lean(),
    BillingPurchase.find({ userId, productId: "signals" }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  const config = liveBillingConfig();
  const active = Boolean(account && account.subscriptionStatus === "active" && productAccessActive(account));
  const expired = Boolean(account && account.subscriptionStatus !== "none" && !active);
  const price = (itemId: Parameters<typeof billingPrice>[0]) => {
    const amount = billingPrice(itemId);
    return config && amount ? new Intl.NumberFormat(undefined, { style: "currency", currency: config.currency }).format(amount / 100) : null;
  };
  return <>
    <PageIntro eyebrow="Usage & billing" title="Credits & billing" description="Monthly access and analysis credits are separate: credits pay for scans, while an expired subscription blocks further use until renewed."/>
    <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1.5fr]"><div className="surface rounded-[20px] border-[#5a7c3c] bg-[#1a2a19] p-6"><Coins className="size-8 text-accent"/><p className="mt-5 text-sm text-muted">Trade research balance</p><div className="mt-2 flex items-baseline gap-2"><span className="text-5xl font-semibold tracking-tight number">{balance}</span><span className="text-sm text-muted">credits</span></div><p className="mt-3 text-xs text-muted">One completed scan uses one credit. Failed scans are refunded.</p></div><div className="surface rounded-[20px] p-6"><p className="text-xs font-bold uppercase tracking-widest text-accent">Monthly access</p><h2 className="mt-3 text-2xl font-bold">{active ? `${account?.planId ?? "Research"} plan` : expired ? "Subscription ended" : "Welcome access"}</h2><p className="mt-3 text-sm leading-6 text-muted">{active ? `Active until ${new Date(account!.currentPeriodEnd!).toLocaleDateString()}. Unused credits remain in your wallet, but future scans require another paid month after this date.` : expired ? "Your remaining credits are kept until you renew. Scans are paused while access is expired." : "Your welcome credits can be used before your first subscription. Choose a monthly plan when you need more analyses."}</p><p className="mt-3 text-xs text-muted">Monthly passes are paid individually; automatic renewal is not enabled.</p></div></div>
    {!config && <div className="mb-5 rounded-xl border border-[#ae8242] bg-[#382811] p-4 text-sm leading-6 text-[#f2d6a1]">Live checkout is not configured yet. Prices and payment buttons appear only after Enrivea confirms the Paystack currency, amounts, and merchant account. No charge can be made from this screen right now.</div>}
    <section className="mb-5"><SectionHeader title={expired ? "Renew monthly access" : "Monthly plans"} detail="Credits are added only after Paystack confirms payment"/><div className="grid gap-3 md:grid-cols-3">{plans.map(plan => <div key={plan.id} className={`surface rounded-[18px] p-5 ${plan.featured ? "border-[#5a7c3c]" : ""}`}><span className="text-xs font-bold uppercase tracking-widest text-accent">{plan.name}</span><div className="mt-3 text-2xl font-bold number">{plan.credits} <span className="text-sm font-normal text-muted">credits / paid month</span></div><p className="mt-2 text-sm text-muted">{price(plan.id) ?? "Price pending"}</p><p className="mt-3 text-xs leading-5 text-muted">{plan.description}</p>{config && price(plan.id) && <BillingPurchaseButton kind="monthly" itemId={plan.id} label={expired ? "Renew with this plan" : "Choose this plan"} disabled={active || session!.user.isDemo}/>}</div>)}</div></section>
    <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Need more credits?" detail="Top-ups require an active monthly subscription"/><div className="grid gap-3 sm:grid-cols-2">{topups.map(pack => <div key={pack.id} className="rounded-xl border border-line bg-[#141e17] p-5"><h3 className="text-base font-bold">{pack.label}</h3><p className="mt-2 text-sm text-muted">{price(pack.id) ?? "Price pending"}</p>{config && price(pack.id) && <BillingPurchaseButton kind="topup" itemId={pack.id} label="Buy extra credits" disabled={!active || session!.user.isDemo}/>}</div>)}</div>{!active && <p className="mt-4 text-xs text-muted">Subscribe or renew monthly access before purchasing a top-up.</p>}</section>
    <section className="surface mb-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Payment history" detail="A payment is fulfilled only after signed webhook and transaction verification"/>{purchases.length ? <div className="divide-y divide-line">{purchases.map(item => <div key={String(item._id)} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><b className="capitalize">{item.kind === "monthly" ? `${item.itemId} monthly access` : `${item.credits} credit top-up`}</b><div className="mt-1 text-xs text-muted">{new Date(item.createdAt).toLocaleString()} · {item.reference}</div></div><span className={`text-xs font-bold uppercase ${item.status === "paid" ? "text-accent" : item.status === "review" ? "text-[#ff939b]" : "text-muted"}`}>{item.status}</span></div>)}</div> : <EmptyState title="No purchases yet" text="Verified monthly payments and top-ups will appear here."/>}</section>
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Credit activity" detail="An append-only record for Trade research"/>{ledger.length ? <div className="divide-y divide-line">{ledger.map(entry => <div key={String(entry._id)} className="flex items-center justify-between gap-3 py-4 text-sm"><div><div className="font-bold capitalize">{entry.kind}</div><div className="mt-1 text-xs text-muted">{new Date(entry.createdAt).toLocaleString()} · {entry.note}</div></div><span className={`font-bold number ${entry.amount >= 0 ? "text-accent" : "text-[#ff939b]"}`}>{entry.amount >= 0 ? "+" : ""}{entry.amount}</span></div>)}</div> : <EmptyState icon={ReceiptText} title="No credit activity" text="Grants, purchases, usage, and refunds will appear here."/>}</section>
  </>;
}

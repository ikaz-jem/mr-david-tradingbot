import { Activity, Database, KeyRound, Server, WalletCards } from "lucide-react";
import { connectDB } from "@/lib/db";
import { CreditEntry } from "@/models/CreditEntry";
import { ScanRun } from "@/models/ScanRun";
import { User } from "@/models/User";
import { EmailDelivery } from "@/models/EmailDelivery";
import { PaystackCheckout } from "@/models/PaystackCheckout";
import { PaystackWebhookEvent } from "@/models/PaystackWebhookEvent";
import { PageIntro, SectionHeader } from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  await connectDB();
  const users = await User.find().sort({ createdAt: -1 }).limit(100).select("creditBalance").lean();
  const [ledger, staleJobs, sentEmails, emailFailures, paystackCheckouts, paystackReviews] = await Promise.all([
    CreditEntry.aggregate<{ _id: string; balance: number }>([
      { $match: { userId: { $in: users.map(user => user._id) } } },
      { $group: { _id: "$userId", balance: { $sum: "$amount" } } },
    ]),
    ScanRun.countDocuments({ status: "running", $expr: { $lt: ["$createdAt", { $dateSubtract: { startDate: "$$NOW", unit: "minute", amount: 1 } }] } }),
    EmailDelivery.countDocuments(),
    EmailDelivery.countDocuments({ status: { $in: ["failed", "bounced", "complained"] } }),
    PaystackCheckout.countDocuments(),
    PaystackWebhookEvent.countDocuments({ outcome: "review" }),
  ]);
  const ledgerByUser = new Map(ledger.map(row => [String(row._id), row.balance]));
  const mismatches = users.filter(user => (user.creditBalance ?? 5) !== (ledgerByUser.get(String(user._id)) ?? 0)).length;
  const services = [
    { name: "MongoDB", detail: "Product database connected", ready: true, icon: Database },
    { name: "Market feed", detail: "Public Binance URL configured; no live probe here", ready: Boolean(process.env.BINANCE_DATA_BASE_URL), icon: Activity },
    { name: "AI provider", detail: "Key and model required before scans can run", ready: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL), icon: Server },
    { name: "Resend email", detail: "Verified sender and API key required for account email", ready: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL), icon: Server },
    { name: "Payment checkout", detail: "Paystack test adapter installed; no live charges or credit grants. Merchant approval still required", ready: false, icon: WalletCards },
    { name: "Exchange order service", detail: "Key encryption, order controls, and reconciliation pending", ready: false, icon: KeyRound },
  ];
  return <><PageIntro eyebrow="Operations / infrastructure" title="System health" description="Configuration and product-data checks for the services needed to operate safely."/>
    <div className="grid gap-4 lg:grid-cols-2">{services.map(service => <div key={service.name} className="surface flex items-center gap-4 rounded-[18px] p-5"><span className="flex size-11 items-center justify-center rounded-xl bg-[#c5ff4117] text-accent"><service.icon className="size-5"/></span><div className="flex-1"><h2 className="text-sm font-bold">{service.name}</h2><p className="mt-1 text-xs text-muted">{service.detail}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${service.ready ? "bg-[#c5ff4117] text-accent" : "bg-[#ffcf7015] text-[#f2ca82]"}`}>{service.ready ? "Configured" : "Pending"}</span></div>)}</div>
    <section className="surface mt-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Data integrity checks" detail="Read-only operational audit"/><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-line bg-[#141e17] p-5"><div className="text-xs text-muted">Credit wallet / ledger mismatches</div><div className={`mt-2 text-3xl font-bold number ${mismatches ? "text-[#ff939b]" : "text-accent"}`}>{mismatches}</div><p className="mt-2 text-xs text-muted">Among {users.length} most recent accounts; investigate any non-zero result before billing.</p></div><div className="rounded-xl border border-line bg-[#141e17] p-5"><div className="text-xs text-muted">Stale running scan jobs</div><div className={`mt-2 text-3xl font-bold number ${staleJobs ? "text-[#ff939b]" : "text-accent"}`}>{staleJobs}</div><p className="mt-2 text-xs text-muted">Jobs still running after one minute; manual reconciliation may be needed.</p></div><div className="rounded-xl border border-line bg-[#141e17] p-5"><div className="text-xs text-muted">Email delivery issues</div><div className={`mt-2 text-3xl font-bold number ${emailFailures ? "text-[#ff939b]" : "text-accent"}`}>{emailFailures}</div><p className="mt-2 text-xs text-muted">Failed, bounced, or complained of {sentEmails} recorded Resend sends.</p></div></div></section>
    <p className="mt-6 text-xs leading-6 text-muted">Paystack sandbox: {paystackCheckouts} checkout records, {paystackReviews} webhook events needing review. Test payments never grant credits. These checks are a sampled audit, not full incident monitoring or transactional billing. Do not enable paid credits or exchange orders until durable reconciliation is in place.</p>
  </>;
}

import { Activity, Database, KeyRound, Server, WalletCards } from "lucide-react";
import { connectDB } from "@/lib/db";
import { CreditEntry } from "@/models/CreditEntry";
import { ScanRun } from "@/models/ScanRun";
import { User } from "@/models/User";
import { EmailDelivery } from "@/models/EmailDelivery";
import { PaystackCheckout } from "@/models/PaystackCheckout";
import { PaystackWebhookEvent } from "@/models/PaystackWebhookEvent";
import { BillingPurchase } from "@/models/BillingPurchase";
import { getPlatformConfig } from "@/lib/platform-config";
import { getServiceConfigStatus } from "@/lib/service-config";
import { PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { exchangeEncryptionReady } from "@/lib/exchange-credentials";
import { getGateway, gatewayReady } from "@/lib/payment-gateways";
import { notFound } from "next/navigation";
import { workspaceActor } from "@/lib/workspace-access";
import { DemoSystemHealth } from "@/components/demo-system-health";

export const dynamic = "force-dynamic";

export default async function SystemPage() {
  await connectDB();
  const actor = await workspaceActor();
  if (!actor?.can("settings:read")) notFound();
  if (actor.isDemo) return <DemoSystemHealth/>;
  const users = await User.find({ isDemo: { $ne: true } }).sort({ createdAt: -1 }).limit(100).select("creditBalance").lean();
  const demoIds = (await User.find({ isDemo: true }).select("_id").lean()).map(user => user._id);
  const [ledger, staleJobs, sentEmails, emailFailures, paystackCheckouts, paystackReviews, liveReviews, controls, servicesStatus] = await Promise.all([
    CreditEntry.aggregate<{ _id: string; balance: number }>([
      { $match: { userId: { $in: users.map(user => user._id) } } },
      { $group: { _id: "$userId", balance: { $sum: "$amount" } } },
    ]),
    ScanRun.countDocuments({ userId: { $nin: demoIds }, status: "running", $expr: { $lt: ["$createdAt", { $dateSubtract: { startDate: "$$NOW", unit: "minute", amount: 1 } }] } }),
    EmailDelivery.countDocuments(),
    EmailDelivery.countDocuments({ status: { $in: ["failed", "bounced", "complained"] } }),
    PaystackCheckout.countDocuments(),
    PaystackWebhookEvent.countDocuments({ outcome: "review" }),
    BillingPurchase.countDocuments({ isDemo: { $ne: true }, status: "review" }),
    getPlatformConfig(),
    getServiceConfigStatus(),
  ]);
  const ledgerByUser = new Map(ledger.map(row => [String(row._id), row.balance]));
  const gateways = await Promise.all([getGateway("paystack", false), getGateway("nowpayments", false)]);
  const mismatches = users.filter(user => (user.creditBalance ?? 0) !== (ledgerByUser.get(String(user._id)) ?? 0)).length;
  const services = [
    { name: "MongoDB", detail: "Product database connected", ready: true, icon: Database },
    { name: "Market feed", detail: "Public Binance URL configured; no live probe here", ready: Boolean(process.env.BINANCE_DATA_BASE_URL), icon: Activity },
    { name: "AI provider", detail: "Key and model required before scans can run", ready: Boolean(servicesStatus.openaiApiKey && servicesStatus.openaiModel), icon: Server },
    { name: "Resend email", detail: "Verified sender and API key required for account email", ready: Boolean(servicesStatus.resendApiKey && servicesStatus.resendFromEmail && process.env.APP_URL), icon: Server },
    ...gateways.map(gateway => ({ name: gateway.provider === "paystack" ? "Paystack checkout" : "USDT BEP20 checkout", detail: "Manage credentials and availability in Platform controls / Payments. Configuration is not a live connectivity check.", ready: gateway.enabled && gatewayReady(gateway), icon: WalletCards })),
    { name: "Read-only exchange connections", detail: "Binance Spot key verification and encrypted storage; no orders", ready: exchangeEncryptionReady(), icon: KeyRound },
    { name: "Exchange order service", detail: "Order permissions, approval controls, and reconciliation pending", ready: false, icon: KeyRound },
  ];
  return <><PageIntro eyebrow="Operations / infrastructure" title="System health" description="Configuration and product-data checks for the services needed to operate safely."/>
    <div className="grid gap-4 lg:grid-cols-2">{services.map(service => <div key={service.name} className="surface flex items-center gap-4 rounded-[18px] p-5"><span className="flex size-11 items-center justify-center rounded-xl bg-[#c5ff4117] text-accent"><service.icon className="size-5"/></span><div className="flex-1"><h2 className="text-sm font-bold">{service.name}</h2><p className="mt-1 text-xs text-muted">{service.detail}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${service.ready ? "bg-[#c5ff4117] text-accent" : "bg-[#ffcf7015] text-[#f2ca82]"}`}>{service.ready ? "Configured" : "Pending"}</span></div>)}</div>
    <section className="surface mt-5 rounded-[20px] p-5 sm:p-6"><SectionHeader title="Data integrity checks" detail="Read-only operational audit"/><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-line bg-[#141e17] p-5"><div className="text-xs text-muted">Credit wallet / ledger mismatches</div><div className={`mt-2 text-3xl font-bold number ${mismatches ? "text-[#ff939b]" : "text-accent"}`}>{mismatches}</div><p className="mt-2 text-xs text-muted">Among {users.length} most recent accounts; investigate any non-zero result before billing.</p></div><div className="rounded-xl border border-line bg-[#141e17] p-5"><div className="text-xs text-muted">Stale running scan jobs</div><div className={`mt-2 text-3xl font-bold number ${staleJobs ? "text-[#ff939b]" : "text-accent"}`}>{staleJobs}</div><p className="mt-2 text-xs text-muted">Jobs still running after one minute; manual reconciliation may be needed.</p></div><div className="rounded-xl border border-line bg-[#141e17] p-5"><div className="text-xs text-muted">Email delivery issues</div><div className={`mt-2 text-3xl font-bold number ${emailFailures ? "text-[#ff939b]" : "text-accent"}`}>{emailFailures}</div><p className="mt-2 text-xs text-muted">Failed, bounced, or complained of {sentEmails} recorded Resend sends.</p></div></div></section>
    <p className="mt-6 text-xs leading-6 text-muted">Operational policy: {controls.allowedScanSymbols.join(", ")} enabled for research. Registrations {controls.registrationOpen ? "open" : "paused"}; scans {controls.scansOpen ? "open" : "paused"}; exchange connections {controls.exchangeConnectionsOpen ? "open" : "paused"}; paper reconciliation {controls.paperReconciliationOpen ? "open" : "paused"}; contact intake {controls.contactIntakeOpen ? "open" : "paused"}. Change these in Platform controls with an audit reason.</p>
    <p className="mt-3 text-xs leading-6 text-muted">Paystack sandbox: {paystackCheckouts} checkout records, {paystackReviews} webhook events needing review. Live billing: {liveReviews} purchases needing review. Test payments never grant credits. Live fulfillment uses a MongoDB transaction and still requires external payment reconciliation, refund handling, provider approval, and production monitoring before launch.</p>
  </>;
}

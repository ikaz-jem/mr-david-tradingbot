import Link from "next/link";
import { BadgeDollarSign, Bell, Bot, ChevronRight, MessageSquareText, PlugZap, Radar, ScanSearch, Settings2, SlidersHorizontal } from "lucide-react";
import { connectDB } from "@/lib/db";
import { workspaceActor } from "@/lib/workspace-access";
import { getPlatformConfig } from "@/lib/platform-config";
import { getServiceConfigStatus } from "@/lib/service-config";
import { PageIntro } from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";

export default async function AdminControlsPage() {
  await connectDB();
  const actor = await workspaceActor();
  const [config, services] = await Promise.all([getPlatformConfig(Boolean(actor?.isDemo)), getServiceConfigStatus(Boolean(actor?.isDemo))]);
  const activeGates = [config.registrationOpen, config.scansOpen, config.approvalDiscoveryOpen, config.autopilotOpen, config.exchangeConnectionsOpen, config.billingOpen, config.supportOpen, config.paperReconciliationOpen, config.contactIntakeOpen].filter(Boolean).length;
  const integrationCount = [services.openaiApiKey, Boolean(services.openaiModel), services.resendApiKey, Boolean(services.resendFromEmail), services.resendWebhookSecret].filter(Boolean).length;
  const sections = [
    { href: "/admin/controls/payments", title: "Payment gateways", detail: "Enable Paystack and USDT BEP20, configure encrypted keys, and manage test or live checkout.", meta: "Activation, credits & payment verification", icon: BadgeDollarSign },
    { href: "/admin/controls/operations", title: "Service availability", detail: "Maintenance mode, nine independent feature gates, and customer-facing pause messages.", meta: `${activeGates}/9 services active${config.maintenanceMode ? " · maintenance on" : ""}`, icon: SlidersHorizontal },
    { href: "/admin/controls/markets", title: "Research markets", detail: "Choose which supported Binance Spot markets are available to the research products.", meta: `${config.allowedScanSymbols.length} trading pairs available`, icon: ScanSearch },
    { href: "/admin/controls/approval-scanner", title: "Approval scan pool", detail: "Approve the pairs, timeframes, strategies, cadence, and cost ceiling used by shared background discovery.", meta: `${config.approvalScanMaxCombinations} maximum combinations · ${config.approvalScanCadenceMinutes}m cadence`, icon: Radar },
    { href: "/admin/controls/activation", title: "Activation & credits", detail: "Account activation price, included credits, and customer refill packs.", meta: `$${(config.activationPriceMinor / 100).toFixed(2)} activation · ${config.activationCredits} credits`, icon: BadgeDollarSign },
    { href: "/admin/controls/ai", title: "AI provider", detail: "Manage the encrypted OpenAI credential and the model used by research products.", meta: services.openaiApiKey && services.openaiModel ? "AI provider ready" : "AI setup incomplete", icon: Bot },
    { href: "/admin/controls/email", title: "Email provider", detail: "Manage Resend credentials, verified sender identity, support inbox, and webhook verification.", meta: `${integrationCount - Number(services.openaiApiKey) - Number(Boolean(services.openaiModel))}/3 email settings configured`, icon: PlugZap },
    { href: "/admin/controls/announcements", title: "Workspace announcements", detail: "Publish or clear the platform-wide message shown to signed-in customers.", meta: config.announcement ? "Announcement currently published" : "No active announcement", icon: Bell },
    { href: "/admin/controls/notifications", title: "Direct notifications", detail: "Send a targeted in-app message to a specific customer with a recorded reason.", meta: "Audited customer communication", icon: MessageSquareText },
  ];
  return <>
    <PageIntro eyebrow="Operations / platform controls" title="Platform control center" description="Choose one control domain at a time. Every sensitive change is permission-checked, reasoned, and recorded in the audit trail."/>
    <section className="mb-5 overflow-hidden rounded-[24px] border border-[#405a3b] bg-[radial-gradient(circle_at_85%_0%,rgba(197,255,65,.10),transparent_32%),linear-gradient(145deg,#142218,#0b130d)] p-6 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-5"><div className="max-w-2xl"><div className="flex size-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent"><Settings2 className="size-5"/></div><h2 className="mt-5 text-2xl font-black">Configuration without the clutter</h2><p className="mt-2 text-sm leading-6 text-muted">Operational switches, commerce, external providers, and customer messaging now have separate workspaces. Changes remain effective platform-wide on the next request.</p></div><div className="grid grid-cols-2 gap-2"><Metric label="Active gates" value={`${activeGates}/9`}/><Metric label="Research pairs" value={String(config.allowedScanSymbols.length)}/><Metric label="Refill packs" value={String(config.creditPacks.filter(pack => pack.enabled).length)}/><Metric label="Integrations" value={`${integrationCount}/5`}/></div></div></section>
    <div className="grid gap-4 md:grid-cols-2">{sections.map(section => { const Icon = section.icon; return <Link key={section.href} href={section.href} className="group surface relative overflow-hidden rounded-[20px] p-6 transition hover:-translate-y-0.5 hover:border-accent/45"><div className="absolute right-0 top-0 size-28 rounded-full bg-accent/[.035] blur-2xl transition group-hover:bg-accent/[.08]"/><div className="relative flex items-start justify-between gap-4"><span className="flex size-11 items-center justify-center rounded-xl border border-[#42583e] bg-[#18251a] text-accent"><Icon className="size-5"/></span><ChevronRight className="size-5 text-muted transition group-hover:translate-x-1 group-hover:text-accent"/></div><h2 className="relative mt-5 text-lg font-black">{section.title}</h2><p className="relative mt-2 min-h-12 text-sm leading-6 text-muted">{section.detail}</p><p className="relative mt-5 border-t border-line pt-4 text-[10px] font-black uppercase tracking-[.13em] text-accent">{section.meta}</p></Link>; })}</div>
    <p className="mt-5 text-xs leading-6 text-muted">Deployment secrets, MongoDB connectivity, payment approval, and exchange order permissions remain protected deployment-level settings unless explicitly exposed through a dedicated audited control.</p>
  </>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-28 rounded-xl border border-[#40583d] bg-black/15 p-3"><p className="text-[8px] font-black uppercase tracking-wider text-muted">{label}</p><p className="mt-1 text-lg font-black text-accent">{value}</p></div>; }

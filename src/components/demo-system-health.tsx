import { Activity, Database, KeyRound, Server, WalletCards } from "lucide-react";
import { PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { User } from "@/models/User";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { ScanRun } from "@/models/ScanRun";
import { DemoEmail } from "@/models/DemoEmail";
import { getPlatformConfig } from "@/lib/platform-config";
import { getServiceConfigStatus } from "@/lib/service-config";

export async function DemoSystemHealth() {
  const staleBefore = new Date();
  staleBefore.setMinutes(staleBefore.getMinutes() - 1);
  const users = await User.find({ isDemo: true }).select("_id").lean();
  const ids = users.map(user => user._id);
  const [workspaces, staleJobs, emails, controls, services] = await Promise.all([
    DemoWorkspace.find({ userId: { $in: ids } }).lean(),
    ScanRun.countDocuments({ userId: { $in: ids }, status: "running", createdAt: { $lt: staleBefore } }),
    DemoEmail.countDocuments(),
    getPlatformConfig(true),
    getServiceConfigStatus(true),
  ]);
  const checks = [
    { name: "MongoDB", detail: "Demo records are connected and writable", ready: true, icon: Database },
    { name: "Research scanner", detail: controls.scansOpen ? "Demo scanning is active" : "Paused in Platform controls", ready: controls.scansOpen, icon: Activity },
    { name: "AI configuration", detail: services.openaiApiKey && services.openaiModel ? "Demo provider settings saved" : "Add demo provider settings in Platform controls", ready: Boolean(services.openaiApiKey && services.openaiModel), icon: Server },
    { name: "Email outbox", detail: emails + " simulated messages recorded", ready: true, icon: Server },
    { name: "Billing", detail: workspaces.length + " demo activation workspaces available", ready: workspaces.length > 0, icon: WalletCards },
    { name: "Exchange connections", detail: "Simulated Binance, Coinbase, Kraken, and OKX connections", ready: controls.exchangeConnectionsOpen, icon: KeyRound },
  ];
  const invalidWallets = workspaces.filter(workspace => {
    const wallets = workspace.wallets as unknown as Map<string, number> | Record<string, number>;
    const balances = wallets instanceof Map ? Array.from(wallets.values()) : Object.values(wallets);
    return balances.some(balance => balance < 0);
  }).length;
  return <><PageIntro eyebrow="Demo operations / infrastructure" title="System health" description="Production-shaped health checks using demo-scoped configuration and records. No live provider probes are performed."/>
    <div className="grid gap-4 lg:grid-cols-2">{checks.map(check => <div key={check.name} className="surface flex items-center gap-4 rounded-[18px] p-5"><span className="flex size-11 items-center justify-center rounded-xl bg-[#c5ff4117] text-accent"><check.icon className="size-5"/></span><div className="flex-1"><h2 className="text-sm font-bold">{check.name}</h2><p className="mt-1 text-xs text-muted">{check.detail}</p></div><span className={"rounded-full px-2.5 py-1 text-[10px] font-bold uppercase " + (check.ready ? "bg-[#c5ff4117] text-accent" : "bg-[#ffcf7015] text-[#f2ca82]")}>{check.ready ? "Ready" : "Attention"}</span></div>)}</div>
    <section className="surface mt-5 rounded-[20px] p-6"><SectionHeader title="Data integrity" detail="Demo-only checks"/><div className="grid gap-3 sm:grid-cols-3">{[["Negative wallets", invalidWallets], ["Stale scans", staleJobs], ["Demo workspaces", workspaces.length]].map(([label, count]) => <div key={label} className="rounded-xl border border-line bg-[#141e17] p-5"><p className="text-xs text-muted">{label}</p><p className="mt-2 text-3xl font-bold text-accent">{count}</p></div>)}</div></section>
    <p className="mt-5 text-xs leading-6 text-muted">Registrations {controls.registrationOpen ? "open" : "paused"} · scans {controls.scansOpen ? "open" : "paused"} · exchange connections {controls.exchangeConnectionsOpen ? "open" : "paused"} · paper outcomes {controls.paperReconciliationOpen ? "open" : "paused"}.</p>
  </>;
}

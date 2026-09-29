import Link from "next/link";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { SupportTicket } from "@/models/SupportTicket";
import { User } from "@/models/User";
import { Signal } from "@/models/Signal";
import { PageIntro, StatCard, SectionHeader } from "@/components/dashboard-ui";
import { Users, Coins, LifeBuoy, Radar } from "lucide-react";
import { DemoBillingOperations } from "@/components/demo-billing-operations";
export async function DemoControlRoom() {
  const users = await User.find({ isDemo: true }).select("name email status").lean();
  const ids = users.map(user => user._id);
  const [workspaces, openTickets, signals, recent] = await Promise.all([
    DemoWorkspace.find({ userId: { $in: ids } }).lean(),
    SupportTicket.countDocuments({ isDemo: true, status: { $in: ["open", "waiting", "in_progress"] } }),
    Signal.countDocuments({ userId: { $in: ids } }),
    SupportTicket.find({ isDemo: true }).sort({ updatedAt: -1 }).limit(5).lean(),
  ]);
  const walletCredits = workspaces.reduce((sum, item) => sum + Object.values(item.wallets).reduce((a, b) => a + Number(b), 0), 0);
  return <><PageIntro eyebrow="Demo operations" title="Control room" description="An interactive sample workspace for memberships, product consumption, research, and customer care. All figures below are demo activity."/><div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Demo accounts" value={String(users.length)} detail="No live customers included" icon={Users}/><StatCard label="Product credits" value={String(walletCredits)} detail="Across demo wallets" icon={Coins}/><StatCard label="Research ideas" value={String(signals)} detail="Synthetic fixtures & demo scans" icon={Radar}/><StatCard label="Open tickets" value={String(openTickets)} detail="Open, active, or waiting" icon={LifeBuoy}/></div><div className="mb-5 grid gap-3 sm:grid-cols-4">{[["Products & costs", "/admin/products"], ["Support inbox", "/admin/support"], ["Users & access", "/admin/users"], ["Configuration", "/admin/controls"]].map(([label, href]) => <Link key={href} href={href} className="surface rounded-xl p-4 text-sm font-bold text-accent hover:border-accent/50">{label} →</Link>)}</div><DemoBillingOperations/><section className="surface mt-5 rounded-2xl p-5"><SectionHeader title="Support activity" detail="Latest demo conversations" href="/admin/support"/>{recent.map(ticket => <Link href="/admin/support" key={String(ticket._id)} className="flex justify-between gap-4 border-t border-line py-4 text-sm"><span>{ticket.subject}</span><span className="text-xs capitalize text-accent">{ticket.status.replace("_", " ")}</span></Link>)}</section></>;
}


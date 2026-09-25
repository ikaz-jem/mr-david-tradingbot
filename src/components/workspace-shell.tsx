"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Activity, BarChart3, Bell, ChevronDown, CircleHelp, Coins, CreditCard, LayoutDashboard, LogOut, Settings2, Shield, Users, Workflow, ScanSearch } from "lucide-react";
import { Brand } from "@/components/brand";

const userNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/signals", label: "Trade ideas", icon: ScanSearch },
  { href: "/dashboard/performance", label: "Performance", icon: BarChart3 },
  { href: "/dashboard/credits", label: "Credits & billing", icon: Coins },
  { href: "/dashboard/settings", label: "Settings", icon: Settings2 },
];
const adminNav = [
  { href: "/admin", label: "Control room", icon: Activity },
  { href: "/admin/controls", label: "Platform controls", icon: Settings2 },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/data", label: "Data explorer", icon: BarChart3 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/signals", label: "Signal health", icon: Workflow },
  { href: "/admin/orders", label: "Orders", icon: CreditCard },
  { href: "/admin/billing", label: "Billing tests", icon: CreditCard },
  { href: "/admin/emails", label: "Email delivery", icon: Bell },
  { href: "/admin/system", label: "System", icon: Shield },
];

export function WorkspaceShell({ children, name, role, isDemo = false }: { children: React.ReactNode; name: string; role: "user" | "staff" | "admin"; isDemo?: boolean }) {
  const pathname = usePathname();
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const visibleAdminNav = role === "admin" ? adminNav : adminNav.filter(item => !["/admin/controls", "/admin/activity", "/admin/data", "/admin/users", "/admin/billing", "/admin/emails"].includes(item.href));
  return <div className="min-h-screen bg-[#0a100d] lg:flex"><aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-[#0e1510] lg:flex"><div className="flex h-20 items-center border-b border-line px-6"><Brand/></div><div className="app-scrollbar flex-1 overflow-y-auto px-3 py-6"><p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#607363]">Workspace</p><Nav items={userNav} pathname={pathname}/>{role !== "user" && <><p className="px-3 pb-3 pt-8 text-[10px] font-bold uppercase tracking-[.2em] text-[#607363]">Operations</p><Nav items={visibleAdminNav} pathname={pathname}/></>}</div><div className="border-t border-line p-3"><Link href="/risk-disclosure" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:text-white"><CircleHelp className="size-4"/> Help & risk</Link><button onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted hover:text-white"><LogOut className="size-4"/> Sign out</button></div></aside><div className="min-w-0 flex-1"><header className="flex h-20 items-center justify-between gap-4 border-b border-line bg-[#0e1510] px-5 sm:px-8"><div className="lg:hidden"><Brand compact/></div><div className="hidden items-center gap-3 lg:flex"><span className="text-sm font-semibold text-[#a6b3a8]">{pathname.startsWith("/admin") ? "Operations" : "Workspace"}</span><span className="text-[#49604c]">/</span><span className="text-sm font-bold text-white">{pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ?? "Overview"}</span></div><div className="flex items-center gap-3"><span className="hidden items-center gap-2 rounded-full border border-[#39513b] bg-[#c5ff4111] px-3 py-1.5 text-[11px] font-bold text-accent sm:flex"><span className="size-1.5 rounded-full bg-accent"/> Spot research</span><button className="relative rounded-lg border border-line p-2.5 text-muted" aria-label="Notifications" title="Notifications are coming soon"><Bell className="size-4"/></button><div className="flex items-center gap-2 rounded-xl border border-line bg-[#17211a] p-1.5 pr-3"><span className="flex size-8 items-center justify-center rounded-lg bg-[#c5ff4126] text-xs font-black text-accent">{initials}</span><span className="hidden max-w-32 truncate text-xs font-bold sm:inline">{name}</span><ChevronDown className="hidden size-3 text-muted sm:block"/></div></div></header><nav className="app-scrollbar flex gap-1 overflow-x-auto border-b border-line bg-[#0e1510] px-4 py-2 lg:hidden" aria-label="Mobile workspace navigation">{[...userNav, ...(role !== "user" ? visibleAdminNav : [])].map(item => <Link key={item.href} href={item.href} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${pathname === item.href ? "bg-[#c5ff411b] text-accent" : "text-muted"}`}>{item.label}</Link>)}</nav>{isDemo && <div className="border-b border-[#6e873f] bg-[#26331b] px-5 py-2 text-xs font-bold text-[#d5efaa] sm:px-8">Local demo account · No live orders, billing, or verified investment returns</div>}<div className="mx-auto max-w-[1540px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">{children}</div><div className="border-t border-line px-5 py-5 text-xs text-[#7f9181] sm:px-8">Enrivea Signal · Research outcomes and live account performance are shown separately.</div></div></div>;
}

function Nav({ items, pathname }: { items: typeof userNav; pathname: string }) { return <nav className="space-y-1">{items.map(item => { const Icon = item.icon; const active = pathname === item.href; return <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-bold transition-colors ${active ? "border border-[#4e6b3a] bg-[#c5ff4117] text-accent" : "border border-transparent text-[#9aaa9c] hover:bg-[#1b281d] hover:text-white"}`}><Icon className="size-4"/>{item.label}</Link>; })}</nav>; }

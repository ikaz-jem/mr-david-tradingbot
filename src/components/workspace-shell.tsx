"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Activity, ArrowRight, BadgeDollarSign, BarChart3, Bell, Bot, ChevronDown, CircleHelp, Coins, CreditCard, FlaskConical, KeyRound, LayoutDashboard, LogOut, MessageSquareText, PlugZap, Radar, Settings2, Shield, SlidersHorizontal, Users, Wallet, Workflow, ScanSearch } from "lucide-react";
import { Brand } from "@/components/brand";

const userNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
];
const companionNav = [
  { href: "/dashboard/signals", label: "Research scanner", icon: ScanSearch },
  { href: "/dashboard/approval", label: "Approval desk", icon: Workflow },
  { href: "/dashboard/autopilot", label: "Autopilot", icon: Bot },
];
const accountNav = [
  { href: "/dashboard/affiliates", label: "Affiliates", icon: Users },
  { href: "/dashboard/exchanges", label: "Exchanges", icon: Wallet },
  { href: "/dashboard/performance", label: "Performance", icon: BarChart3 },
  { href: "/dashboard/credits", label: "Credits & billing", icon: Coins },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/settings", label: "Settings", icon: Settings2 },
  { href: "/dashboard/support", label: "Support", icon: CircleHelp },
];
type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; permission?: string; children?: NavItem[] };
const adminNav: NavItem[] = [
  { href: "/admin/affiliates", label: "Affiliates", icon: Users, permission: "affiliates:read" },
  { href: "/admin", label: "Control room", icon: Activity, permission: "reports:read" },
  { href: "/admin/access", label: "Access & permissions", icon: KeyRound, permission: "access:read" },
  { href: "/admin/controls", label: "Platform controls", icon: Settings2, permission: "settings:read", children: [
    { href: "/admin/controls/operations", label: "Service availability", icon: SlidersHorizontal, permission: "settings:read" },
    { href: "/admin/controls/markets", label: "Research markets", icon: ScanSearch, permission: "settings:read" },
    { href: "/admin/controls/approval-scanner", label: "Approval scan pool", icon: Radar, permission: "settings:read" },
    { href: "/admin/controls/activation", label: "Activation & credits", icon: BadgeDollarSign, permission: "settings:read" },
    { href: "/admin/controls/payments", label: "Payment gateways", icon: CreditCard, permission: "settings:read" },
    { href: "/admin/controls/ai", label: "AI provider", icon: Bot, permission: "settings:read" },
    { href: "/admin/controls/email", label: "Email provider", icon: PlugZap, permission: "settings:read" },
    { href: "/admin/controls/announcements", label: "Announcements", icon: Bell, permission: "settings:read" },
    { href: "/admin/controls/notifications", label: "Direct notifications", icon: MessageSquareText, permission: "notifications:create" },
  ] },
  { href: "/admin/activity", label: "Activity", icon: Activity, permission: "audit:read" },
  { href: "/admin/data", label: "Data explorer", icon: BarChart3, permission: "data:read" },
  { href: "/admin/users", label: "Users", icon: Users, permission: "users:read" },
  { href: "/admin/signals", label: "Signal health", icon: Workflow, permission: "signals:read" },
  { href: "/admin/orders", label: "Orders", icon: CreditCard, permission: "orders:read" },
  { href: "/admin/billing", label: "Billing", icon: CreditCard, permission: "billing:read" },
  { href: "/admin/products", label: "Products", icon: Coins, permission: "products:read" },
  { href: "/admin/strategies", label: "Strategies", icon: FlaskConical, permission: "strategies:read" },
  { href: "/admin/support", label: "Support inbox", icon: CircleHelp, permission: "support:read" },
  { href: "/admin/emails", label: "Email delivery", icon: Bell, permission: "emails:read" },
  { href: "/admin/system", label: "System", icon: Shield, permission: "settings:read" },
];

export function WorkspaceShell({ children, name, role, permissions = [], isDemo = false, unreadNotifications = 0 }: { children: React.ReactNode; name: string; role: "user" | "staff" | "admin"; permissions?: string[]; isDemo?: boolean; unreadNotifications?: number }) {
  const pathname = usePathname();
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const hasPermission = (permission: string) => permissions.includes("*:*") || permissions.includes(permission) || permissions.includes(permission.split(":")[0] + ":manage");
  const visibleAdminNav = permissions.length ? adminNav.filter(item => item.permission ? hasPermission(item.permission) : true).map(item => ({ ...item, children: item.children?.filter(child => child.permission ? hasPermission(child.permission) : true) })) : role === "admin" ? adminNav : adminNav.filter(item => ["/admin", "/admin/signals", "/admin/orders", "/admin/support"].includes(item.href));
  return <div className="min-h-screen bg-[#0a100d] lg:flex">
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-[#0e1510] lg:flex"><div className="flex h-20 items-center border-b border-line px-6"><Brand/></div><div className="app-scrollbar flex-1 overflow-y-auto px-3 py-6"><p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#607363]">Workspace</p><Nav items={userNav} pathname={pathname}/><Link href="/dashboard/companion" className={`mt-7 flex items-center justify-between px-3 pb-3 text-[10px] font-bold uppercase tracking-[.2em] ${pathname === "/dashboard/companion" ? "text-accent" : "text-[#607363]"}`}><span>Trading Companion</span><ArrowRight className="size-3"/></Link><Nav items={companionNav} pathname={pathname}/><p className="px-3 pb-3 pt-7 text-[10px] font-bold uppercase tracking-[.2em] text-[#607363]">Account &amp; data</p><Nav items={accountNav} pathname={pathname}/>{role !== "user" && <><p className="px-3 pb-3 pt-8 text-[10px] font-bold uppercase tracking-[.2em] text-[#607363]">Operations</p><Nav items={visibleAdminNav} pathname={pathname}/></>}</div><div className="border-t border-line p-3"><Link href="/risk-disclosure" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:text-white"><CircleHelp className="size-4"/> Help & risk</Link><button onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted hover:text-white"><LogOut className="size-4"/> Sign out</button></div></aside>
    <div className="min-w-0 flex-1"><header className="flex h-20 items-center justify-between gap-4 border-b border-line bg-[#0e1510] px-5 sm:px-8"><div className="lg:hidden"><Brand compact/></div><div className="hidden items-center gap-3 lg:flex"><span className="text-sm font-semibold text-[#a6b3a8]">{pathname.startsWith("/admin") ? "Operations" : "Workspace"}</span><span className="text-[#49604c]">/</span><span className="text-sm font-bold text-white">{pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ?? "Overview"}</span></div><div className="flex items-center gap-3"><span className="hidden items-center gap-2 rounded-full border border-[#39513b] bg-[#c5ff4111] px-3 py-1.5 text-[11px] font-bold text-accent sm:flex"><span className="size-1.5 rounded-full bg-accent"/> Spot research</span><Link href="/dashboard/notifications" className="relative rounded-lg border border-line p-2.5 text-muted hover:text-white" aria-label={`Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ""}`}><Bell className="size-4"/>{unreadNotifications > 0 && <span className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-black text-[#101810]">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}</Link><Link href="/dashboard/settings" className="flex items-center gap-2 rounded-xl border border-line bg-[#17211a] p-1.5 pr-3" aria-label="Account settings"><span className="flex size-8 items-center justify-center rounded-lg bg-[#c5ff4126] text-xs font-black text-accent">{initials}</span><span className="hidden max-w-32 truncate text-xs font-bold sm:inline">{name}</span><ChevronDown className="hidden size-3 text-muted sm:block"/></Link></div></header>
      <nav className="app-scrollbar flex gap-1 overflow-x-auto border-b border-line bg-[#0e1510] px-4 py-2 lg:hidden" aria-label="Mobile workspace navigation">{[...userNav, ...companionNav, ...accountNav, ...(role !== "user" ? visibleAdminNav.flatMap(item => item.children ? [item, ...item.children] : [item]) : [])].map(item => <Link key={item.href} href={item.href} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${pathname === item.href ? "bg-[#c5ff411b] text-accent" : "text-muted"}`}>{item.label}</Link>)}</nav>
      {isDemo && <div className="border-b border-[#6e873f] bg-[#26331b] px-5 py-2 text-xs font-bold text-[#d5efaa] sm:px-8">Shared demo workspace · Sample data only · No real payments or trades · Do not enter private information</div>}
      <div className="mx-auto max-w-[1540px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">{children}</div><div className="border-t border-line px-5 py-5 text-xs text-[#7f9181] sm:px-8">Enrivea Signal · Research outcomes and live account performance are shown separately.</div>
    </div>
  </div>;
}

function Nav({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => Object.fromEntries(items.filter(item => item.children && (pathname === item.href || pathname.startsWith(item.href + "/"))).map(item => [item.href, true])));
  return <nav className="space-y-1">{items.map(item => {
    const Icon = item.icon; const active = pathname === item.href; const branchActive = Boolean(item.children?.some(child => pathname === child.href)); const open = expanded[item.href] ?? branchActive;
    if (!item.children) return <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-bold transition-colors ${active ? "border border-[#4e6b3a] bg-[#c5ff4117] text-accent" : "border border-transparent text-[#9aaa9c] hover:bg-[#1b281d] hover:text-white"}`}><Icon className="size-4"/>{item.label}</Link>;
    return <div key={item.href}><div className={`flex items-center rounded-[10px] border transition-colors ${active || branchActive ? "border-[#4e6b3a] bg-[#c5ff4110] text-accent" : "border-transparent text-[#9aaa9c] hover:bg-[#1b281d] hover:text-white"}`}><Link href={item.href} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm font-bold"><Icon className="size-4 shrink-0"/><span className="truncate">{item.label}</span></Link><button type="button" aria-label={`${open ? "Collapse" : "Expand"} ${item.label}`} aria-expanded={open} onClick={() => setExpanded(current => ({ ...current, [item.href]: !open }))} className="mr-1 rounded-lg p-2 hover:bg-white/5"><ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}/></button></div>{open && <div className="ml-4 mt-1 space-y-1 border-l border-[#344638] pl-2">{item.children.map(child => { const ChildIcon = child.icon; const childActive = pathname === child.href; return <Link key={child.href} href={child.href} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold transition ${childActive ? "bg-[#c5ff4117] text-accent" : "text-[#849587] hover:bg-[#1b281d] hover:text-white"}`}><ChildIcon className="size-3.5"/>{child.label}</Link>; })}</div>}</div>;
  })}</nav>;
}

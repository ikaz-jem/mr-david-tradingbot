"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Activity, ArrowRight, BadgeDollarSign, BarChart3, Bell, BookOpen, Bot, CheckCheck, ChevronDown, CircleHelp, Coins, CreditCard, ExternalLink, FlaskConical, Headphones, KeyRound, LayoutDashboard, LogOut, MessageSquareText, PlugZap, Radar, Settings2, Shield, SlidersHorizontal, Users, Wallet, Workflow, ScanSearch } from "lucide-react";
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
    { href: "/admin/controls/autopilot", label: "Autopilot operations", icon: Bot, permission: "settings:read" },
    { href: "/admin/controls/activation", label: "Activation & credits", icon: BadgeDollarSign, permission: "settings:read" },
    { href: "/admin/controls/payments", label: "Payment gateways", icon: CreditCard, permission: "settings:read" },
    { href: "/admin/controls/ai", label: "AI provider", icon: Bot, permission: "settings:read" },
    { href: "/admin/controls/email", label: "Email provider", icon: PlugZap, permission: "settings:read" },
    { href: "/admin/controls/storage", label: "Image storage", icon: PlugZap, permission: "settings:read" },
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
  { href: "/admin/help", label: "Help Center", icon: BookOpen, permission: "help:read" },
  { href: "/admin/emails", label: "Email delivery", icon: Bell, permission: "emails:read" },
  { href: "/admin/system", label: "System", icon: Shield, permission: "settings:read" },
];

type NotificationPreview = { id: string; kind: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string };

export function WorkspaceShell({ children, name, role, permissions = [], isDemo = false, unreadNotifications = 0, notifications = [] }: { children: React.ReactNode; name: string; role: "user" | "staff" | "admin"; permissions?: string[]; isDemo?: boolean; unreadNotifications?: number; notifications?: NotificationPreview[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const menuArea = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<"notifications" | "account" | null>(null);
  const [notificationItems, setNotificationItems] = useState(notifications);
  const [unreadCount, setUnreadCount] = useState(unreadNotifications);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const hasPermission = (permission: string) => permissions.includes("*:*") || permissions.includes(permission) || permissions.includes(permission.split(":")[0] + ":manage");
  const visibleAdminNav = permissions.length ? adminNav.filter(item => item.permission ? hasPermission(item.permission) : true).map(item => ({ ...item, children: item.children?.filter(child => child.permission ? hasPermission(child.permission) : true) })) : role === "admin" ? adminNav : adminNav.filter(item => ["/admin", "/admin/signals", "/admin/orders", "/admin/support"].includes(item.href));

  useEffect(() => {
    function close(event: MouseEvent) { if (menuArea.current && !menuArea.current.contains(event.target as Node)) setOpenMenu(null); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setOpenMenu(null); }
    document.addEventListener("mousedown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, []);

  async function markNotifications(payload: { id?: string; all?: boolean }) {
    setNotificationBusy(true); setNotificationError("");
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: Boolean(payload.id) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Notifications could not be updated.");
      const now = new Date().toISOString();
      if (payload.all) { setNotificationItems(items => items.map(item => ({ ...item, readAt: item.readAt ?? now }))); setUnreadCount(0); }
      else if (payload.id) { setNotificationItems(items => items.map(item => item.id === payload.id ? { ...item, readAt: item.readAt ?? now } : item)); setUnreadCount(count => Math.max(0, count - (notificationItems.find(item => item.id === payload.id)?.readAt ? 0 : 1))); }
      router.refresh();
    } catch (error) { setNotificationError(error instanceof Error ? error.message : "Notifications could not be updated."); }
    finally { setNotificationBusy(false); }
  }

  return <div className="min-h-screen bg-[#0a100d] lg:flex">
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-[#0e1510] lg:flex"><div className="flex h-20 items-center border-b border-line px-6"><Brand/></div><div className="app-scrollbar flex-1 overflow-y-auto px-3 py-6"><p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#607363]">Workspace</p><Nav items={userNav} pathname={pathname}/><Link href="/dashboard/companion" className={`mt-7 flex items-center justify-between px-3 pb-3 text-[10px] font-bold uppercase tracking-[.2em] ${pathname === "/dashboard/companion" ? "text-accent" : "text-[#607363]"}`}><span>Trading Companion</span><ArrowRight className="size-3"/></Link><Nav items={companionNav} pathname={pathname}/><p className="px-3 pb-3 pt-7 text-[10px] font-bold uppercase tracking-[.2em] text-[#607363]">Account &amp; data</p><Nav items={accountNav} pathname={pathname}/>{role !== "user" && <><p className="px-3 pb-3 pt-8 text-[10px] font-bold uppercase tracking-[.2em] text-[#607363]">Operations</p><Nav items={visibleAdminNav} pathname={pathname}/></>}</div></aside>
    <div className="min-w-0 flex-1"><header className="relative z-40 flex h-20 items-center justify-between gap-4 border-b border-line bg-[#0e1510] px-5 sm:px-8"><div className="lg:hidden"><Brand compact/></div><div className="hidden items-center gap-3 lg:flex"><span className="text-sm font-semibold text-[#a6b3a8]">{pathname.startsWith("/admin") ? "Operations" : "Workspace"}</span><span className="text-[#49604c]">/</span><span className="text-sm font-bold capitalize text-white">{pathname.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") ?? "Overview"}</span></div><div ref={menuArea} className="relative flex items-center gap-3"><span className="hidden items-center gap-2 rounded-full border border-[#39513b] bg-[#c5ff4111] px-3 py-1.5 text-[11px] font-bold text-accent sm:flex"><span className="size-1.5 rounded-full bg-accent"/> Spot research</span>
      <div className="relative"><button type="button" onClick={() => setOpenMenu(current => current === "notifications" ? null : "notifications")} className={`relative rounded-xl border p-2.5 transition ${openMenu === "notifications" ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-muted hover:bg-white/5 hover:text-white"}`} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={openMenu === "notifications"} aria-controls="notification-menu"><Bell className="size-4"/>{unreadCount > 0 && <span className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-black text-[#101810]">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>{openMenu === "notifications" && <div id="notification-menu" className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#334b37] bg-[#101a13] shadow-[0_24px_70px_rgba(0,0,0,.55)]"><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><p className="font-black text-white">Notifications</p><p className="mt-0.5 text-[11px] text-muted">{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You are all caught up"}</p></div>{unreadCount > 0 && <button type="button" disabled={notificationBusy} onClick={() => void markNotifications({ all: true })} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-accent disabled:opacity-50"><CheckCheck className="size-3.5"/>Mark all read</button>}</div>{notificationItems.length ? <div className="max-h-[360px] divide-y divide-line overflow-y-auto">{notificationItems.map(item => { const safeHref = item.href?.startsWith("/dashboard/") || item.href?.startsWith("/admin/") ? item.href : "/dashboard/notifications"; return <Link key={item.id} href={safeHref} onClick={() => { if (!item.readAt) void markNotifications({ id: item.id }); }} className={`block px-5 py-4 transition hover:bg-white/[.035] ${item.readAt ? "opacity-65" : "bg-accent/[.025]"}`}><div className="flex items-start gap-3"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.readAt ? "bg-[#445247]" : "bg-accent shadow-[0_0_12px_#c5ff41]"}`}/><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold text-white">{item.title}</p><span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-[#738477]">{item.kind}</span></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{item.body}</p><time className="mt-2 block text-[10px] text-[#718075]" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></div></div></Link>; })}</div> : <div className="px-5 py-10 text-center"><Bell className="mx-auto size-6 text-[#607363]"/><p className="mt-3 text-sm font-bold">No notifications yet</p><p className="mt-1 text-xs text-muted">Research, billing, and security updates will appear here.</p></div>}{notificationError && <p role="alert" className="border-t border-line px-5 py-3 text-xs text-[#ffae96]">{notificationError}</p>}<Link href="/dashboard/notifications" className="flex items-center justify-between border-t border-line px-5 py-3.5 text-xs font-bold text-accent hover:bg-white/[.035]">Open notification center <ArrowRight className="size-3.5"/></Link></div>}</div>
      <div className="relative"><button type="button" onClick={() => setOpenMenu(current => current === "account" ? null : "account")} className={`flex items-center gap-2 rounded-xl border bg-[#17211a] p-1.5 pr-3 transition ${openMenu === "account" ? "border-accent/40" : "border-line hover:border-[#405944]"}`} aria-label="Open account menu" aria-expanded={openMenu === "account"} aria-controls="account-menu"><span className="flex size-8 items-center justify-center rounded-lg bg-[#c5ff4126] text-xs font-black text-accent">{initials}</span><span className="hidden max-w-32 truncate text-xs font-bold sm:inline">{name}</span><ChevronDown className={`hidden size-3 text-muted transition-transform sm:block ${openMenu === "account" ? "rotate-180" : ""}`}/></button>{openMenu === "account" && <div id="account-menu" className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(310px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#334b37] bg-[#101a13] p-2 shadow-[0_24px_70px_rgba(0,0,0,.55)]"><div className="rounded-xl bg-[#17231a] px-4 py-3"><p className="truncate text-sm font-black text-white">{name}</p><div className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#829184]"><span>{role}</span><span className="size-1 rounded-full bg-[#526456]"/><span className={isDemo ? "text-[#efc16f]" : "text-accent"}>{isDemo ? "Demo workspace" : "Live workspace"}</span></div></div><div className="mt-2 space-y-1"><AccountLink href="/dashboard/settings" icon={Settings2} label="Account settings"/><AccountLink href="/dashboard/credits" icon={Coins} label="Credits & billing"/><AccountLink href="/help" icon={BookOpen} label="Help Center"/><AccountLink href="/dashboard/support" icon={Headphones} label="Support center"/>{role !== "user" && <AccountLink href="/admin" icon={Activity} label="Operations dashboard"/>}<AccountLink href="/risk-disclosure" icon={CircleHelp} label="Risk disclosure"/><AccountLink href="/" icon={ExternalLink} label="View public website"/></div><div className="mt-2 border-t border-line pt-2"><button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#f0a58f] transition hover:bg-[#44251e]"><LogOut className="size-4"/>Sign out</button></div></div>}</div>
    </div></header>
      <nav className="app-scrollbar flex gap-1 overflow-x-auto border-b border-line bg-[#0e1510] px-4 py-2 lg:hidden" aria-label="Mobile workspace navigation">{[...userNav, ...companionNav, ...accountNav, ...(role !== "user" ? visibleAdminNav.flatMap(item => item.children ? [item, ...item.children] : [item]) : [])].map(item => <Link key={item.href} href={item.href} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${pathname === item.href ? "bg-[#c5ff411b] text-accent" : "text-muted"}`}>{item.label}</Link>)}</nav>
      {isDemo && <div className="border-b border-[#6e873f] bg-[#26331b] px-5 py-2 text-xs font-bold text-[#d5efaa] sm:px-8">Shared demo workspace · Sample data only · No real payments or trades · Do not enter private information</div>}
      <div className="mx-auto max-w-[1540px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">{children}</div><div className="border-t border-line px-5 py-5 text-xs text-[#7f9181] sm:px-8">Enrivea Signal · Research outcomes and live account performance are shown separately.</div>
    </div>
  </div>;
}

function AccountLink({ href, icon: Icon, label }: { href: string; icon: typeof Settings2; label: string }) {
  return <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[#a8b6aa] transition hover:bg-white/[.045] hover:text-white"><Icon className="size-4 text-[#7e9181]"/><span className="flex-1">{label}</span><ChevronDown className="size-3 -rotate-90 text-[#536456]"/></Link>;
}

function Nav({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => Object.fromEntries(items.filter(item => item.children && (pathname === item.href || pathname.startsWith(item.href + "/"))).map(item => [item.href, true])));
  return <nav className="space-y-1">{items.map(item => {
    const Icon = item.icon; const active = pathname === item.href; const branchActive = Boolean(item.children?.some(child => pathname === child.href)); const open = expanded[item.href] ?? branchActive;
    if (!item.children) return <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-bold transition-colors ${active ? "border border-[#4e6b3a] bg-[#c5ff4117] text-accent" : "border border-transparent text-[#9aaa9c] hover:bg-[#1b281d] hover:text-white"}`}><Icon className="size-4"/>{item.label}</Link>;
    return <div key={item.href}><div className={`flex items-center rounded-[10px] border transition-colors ${active || branchActive ? "border-[#4e6b3a] bg-[#c5ff4110] text-accent" : "border-transparent text-[#9aaa9c] hover:bg-[#1b281d] hover:text-white"}`}><Link href={item.href} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm font-bold"><Icon className="size-4 shrink-0"/><span className="truncate">{item.label}</span></Link><button type="button" aria-label={`${open ? "Collapse" : "Expand"} ${item.label}`} aria-expanded={open} onClick={() => setExpanded(current => ({ ...current, [item.href]: !open }))} className="mr-1 rounded-lg p-2 hover:bg-white/5"><ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}/></button></div>{open && <div className="ml-4 mt-1 space-y-1 border-l border-[#344638] pl-2">{item.children.map(child => { const ChildIcon = child.icon; const childActive = pathname === child.href; return <Link key={child.href} href={child.href} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold transition ${childActive ? "bg-[#c5ff4117] text-accent" : "text-[#849587] hover:bg-[#1b281d] hover:text-white"}`}><ChildIcon className="size-3.5"/>{child.label}</Link>; })}</div>}</div>;
  })}</nav>;
}

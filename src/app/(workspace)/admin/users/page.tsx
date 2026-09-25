import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { AdminUserAccess } from "@/components/admin-user-access";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const session = await getServerSession(authOptions);
  await connectDB();
  const actor = session?.user.id ? await User.findById(session.user.id).select("role status isDemo").lean() : null;
  if (!actor || actor.status !== "active" || actor.role !== "admin") notFound();
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 80) : "";
  const page = Math.min(1000, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const filter = q ? { $or: [{ name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }, { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }] } : {};
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 50).limit(50).select("name email role status creditBalance countryCode emailVerifiedAt isDemo createdAt").lean(),
  ]);
  const pageHref = (next: number) => `/admin/users?page=${next}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  return <>
    <PageIntro eyebrow="Operations / users" title="Users" description="Search accounts, review access and balances, and make audited user or staff access changes."/>
    <section className="surface rounded-[20px] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><SectionHeader title="Accounts" detail={`${total} total · page ${page}`}/><form action="/admin/users" className="flex gap-2"><input name="q" defaultValue={q} maxLength={80} placeholder="Search name or email" className="h-10 min-w-0 rounded-lg border border-line bg-[#111a13] px-3 text-sm text-white"/><button className="button-secondary rounded-lg px-4 text-xs font-bold">Search</button></form></div>
      {users.length ? <div className="divide-y divide-line">{users.map(user => <div key={String(user._id)} className="grid gap-4 py-5 xl:grid-cols-[1fr_1fr]"><div><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">{user.name}</span>{user.isDemo && <span className="rounded-full border border-[#6e873f] px-2 py-0.5 text-[10px] font-bold text-accent">Demo</span>}</div><div className="mt-1 break-all text-xs text-muted">{user.email}</div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted"><span>Role <b className="capitalize text-white">{user.role}</b></span><span>Status <b className="capitalize text-white">{user.status}</b></span><span>Credits <b className="text-white">{user.creditBalance}</b></span><span>Email <b className="text-white">{user.emailVerifiedAt ? "verified" : "unverified"}</b></span><span>Country <b className="text-white">{user.countryCode || "unset"}</b></span><span>Joined {new Date(user.createdAt).toLocaleDateString()}</span></div></div><div>{user.role !== "admin" && String(user._id) !== session?.user.id && (!actor.isDemo || user.isDemo) ? <AdminUserAccess userId={String(user._id)} role={user.role} status={user.status}/> : <p className="text-xs leading-6 text-muted">{user.role === "admin" ? "Admin account changes require a separate privileged workflow." : actor.isDemo && !user.isDemo ? "Demo admins cannot modify non-demo accounts." : "You cannot change your own access."}</p>}</div></div>)}</div> : <EmptyState title="No matching accounts" text="Try another name or email address."/>}
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-xs"><span className="text-muted">Showing {users.length} of {total} matching accounts</span><div className="flex gap-2">{page > 1 && <Link href={pageHref(page - 1)} className="button-secondary rounded-lg px-3 py-2 font-bold">Previous</Link>}{page * 50 < total && <Link href={pageHref(page + 1)} className="button-secondary rounded-lg px-3 py-2 font-bold">Next</Link>}</div></div>
    </section>
  </>;
}

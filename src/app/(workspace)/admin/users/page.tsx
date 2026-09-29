import Link from "next/link";
import { notFound } from "next/navigation";
import { workspaceActor } from "@/lib/workspace-access";
import { User } from "@/models/User";
import { ProductAccount } from "@/models/ProductAccount";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { AdminUserDirectory } from "@/components/admin-user-directory";
import { PageIntro } from "@/components/dashboard-ui";
import { ensureDemoCustomers } from "@/lib/demo-customers";
import { isShowcaseAccount } from "@/lib/demo-policy";
export const dynamic = "force-dynamic";
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; status?: string; role?: string }> }) {
  const actor = await workspaceActor();
  if (!actor || actor.role !== "admin") notFound();
  if (actor.isDemo) await ensureDemoCustomers();
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 80) : "";
  const page = Math.min(1000, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const status = query.status === "active" || query.status === "suspended" || query.status === "banned" ? query.status : "";
  const role = query.role === "user" || query.role === "staff" || query.role === "admin" ? query.role : "";
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const scope = actor.isDemo ? { isDemo: true } : {};
  const filter = { ...scope, ...(status ? { status: status as "active" | "suspended" | "banned" } : {}), ...(role ? { role: role as "user" | "staff" | "admin" } : {}), ...(q ? { $or: [{ name: { $regex: escaped, $options: "i" } }, { email: { $regex: escaped, $options: "i" } }] } : {}) };
  const [total, users, active, suspended, banned] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 25).limit(25).select("name email role status creditBalance countryCode emailVerifiedAt isDemo createdAt").lean(),
    User.countDocuments({ ...scope, status: "active" }), User.countDocuments({ ...scope, status: "suspended" }), User.countDocuments({ ...scope, status: "banned" }),
  ]);
  const ids = users.map(user => user._id);
  const [accounts, demos, audits] = await Promise.all([
    ProductAccount.find({ userId: { $in: ids }, productId: "signals" }).lean(),
    DemoWorkspace.find({ userId: { $in: ids } }),
    AdminAuditEvent.find({ targetUserId: { $in: ids } }).sort({ createdAt: -1 }).limit(150).lean(),
  ]);
  const records = users.map(user => {
    const demo = demos.find(item => String(item.userId) === String(user._id));
    const account = accounts.find(item => String(item.userId) === String(user._id));
    const end = demo?.periodEnd ?? account?.currentPeriodEnd;
    return {
      id: String(user._id), name: user.name, email: user.email, role: user.role, status: user.status, country: user.countryCode ?? "",
      credits: demo?.wallets.get("signals") ?? account?.creditBalance ?? user.creditBalance,
      plan: demo?.planId ?? account?.planId ?? "Welcome", access: end ? end > new Date() ? "active" : "expired" : "welcome",
      periodEnd: end?.toISOString() ?? null, createdAt: user.createdAt.toISOString(), verified: Boolean(user.emailVerifiedAt), isDemo: Boolean(user.isDemo),
      protected: user.role === "admin" || String(user._id) === actor.id || Boolean(user.isDemo && isShowcaseAccount(user.email)),
      audit: audits.filter(event => String(event.targetUserId) === String(user._id)).slice(0, 5).map(event => ({ action: event.action, after: event.after, reason: event.reason, date: event.createdAt.toISOString(), status: event.status })),
    };
  });
  const pageHref = (value: number) => "/admin/users?" + new URLSearchParams({ q, status, role, page: String(value) });
  return <><PageIntro eyebrow="Customer operations" title="Users & access" description="Manage account access, inspect membership, and review customer workspaces. Sensitive changes require a reason and are recorded in the audit history."/>
    <div className="mb-5 grid gap-3 sm:grid-cols-3">{[["Active accounts", active, "text-accent"], ["Suspended", suspended, "text-amber-200"], ["Banned", banned, "text-red-300"]].map(([label, value, color]) => <div key={label} className="surface rounded-2xl p-5"><p className="text-xs text-muted">{label}</p><p className={"mt-3 text-3xl font-bold " + color}>{value}</p></div>)}</div>
    {actor.isDemo && <p className="mb-5 rounded-xl border border-accent/30 bg-accent/5 p-4 text-xs text-muted">Public showcase · Only demo accounts are visible. Use Amara, James, Leila, or Daniel to try ban, restore, role, and session controls. The two demo login accounts are protected.</p>}
    <section className="surface overflow-hidden rounded-2xl"><form action="/admin/users" className="flex flex-wrap gap-3 border-b border-line p-4"><input aria-label="Search accounts" name="q" defaultValue={q} maxLength={80} placeholder="Search name or email…" className="min-w-full flex-1 rounded-xl sm:min-w-0 border border-line bg-[#101b13] px-4 py-3 text-sm"/><select aria-label="Filter account status" name="status" defaultValue={status} className="rounded-xl border border-line bg-[#101b13] px-3 text-xs"><option value="">All statuses</option>{["active", "suspended", "banned"].map(value => <option key={value}>{value}</option>)}</select><select aria-label="Filter account role" name="role" defaultValue={role} className="rounded-xl border border-line bg-[#101b13] px-3 text-xs"><option value="">All roles</option>{["user", "staff", "admin"].map(value => <option key={value}>{value}</option>)}</select><button className="rounded-xl bg-accent px-5 py-3 text-xs font-bold text-black">Filter</button></form><AdminUserDirectory users={records} demo={Boolean(actor.isDemo)}/><div className="flex items-center justify-between border-t border-line p-4 text-xs text-muted"><span>{total} matching accounts · Page {page}</span><div className="flex gap-4">{page > 1 && <Link href={pageHref(page - 1)} className="text-accent">Previous</Link>}{page * 25 < total && <Link href={pageHref(page + 1)} className="text-accent">Next</Link>}</div></div></section>
  </>;
}

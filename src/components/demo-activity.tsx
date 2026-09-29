import { User } from "@/models/User";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { SupportTicket } from "@/models/SupportTicket";
import { DemoEmail } from "@/models/DemoEmail";
import { PageIntro } from "@/components/dashboard-ui";
import { AdminActivityRefresh } from "@/components/admin-activity-refresh";
export async function DemoActivity() {
  const users = await User.find({ isDemo: true }).select("_id email").lean();
  const ids = users.map(user => user._id);
  const names = new Map(users.map(user => [String(user._id), user.email]));
  const [audits, wallets, tickets, emails] = await Promise.all([
    AdminAuditEvent.find({ actorId: { $in: ids } }).sort({ createdAt: -1 }).limit(40).lean(),
    DemoWorkspace.find({ userId: { $in: ids } }).lean(),
    SupportTicket.find({ isDemo: true }).sort({ updatedAt: -1 }).limit(20).select("subject status updatedAt").lean(),
    DemoEmail.find().sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const events = [
    ...audits.map(item => ({ id: `audit-${item._id}`, title: `${item.action.replaceAll("_", " ")} · ${item.status}`, detail: item.reason, at: item.createdAt })),
    ...wallets.flatMap(item => item.activity.map((entry, index) => ({ id: `wallet-${item._id}-${index}`, title: `${names.get(String(item.userId))} · ${entry.productId} · ${entry.amount ?? 0} credits`, detail: entry.note || "Wallet updated", at: entry.createdAt || item.updatedAt }))),
    ...tickets.map(item => ({ id: `ticket-${item._id}`, title: `Support · ${item.status}`, detail: item.subject, at: item.updatedAt })),
    ...emails.map(item => ({ id: `email-${item._id}`, title: "Email simulation · not sent", detail: item.subject, at: item.createdAt })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 80);
  return <><PageIntro eyebrow="Demo / operations" title="Platform activity" description="Saved demo changes, credit activity, support updates, and simulated email. Real customer events are excluded."/><section className="surface rounded-2xl p-6"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Latest demo events</h2><AdminActivityRefresh/></div><div className="divide-y divide-line">{events.map(item => <article key={item.id} className="flex flex-wrap justify-between gap-3 py-4"><div><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-muted">{item.detail}</p></div><time className="text-xs text-muted">{item.at.toLocaleString()}</time></article>)}</div></section></>;
}

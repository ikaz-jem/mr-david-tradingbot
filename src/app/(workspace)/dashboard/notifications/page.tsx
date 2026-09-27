import Link from "next/link";
import { getServerSession } from "next-auth";
import { Bell } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models/Notification";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { NotificationActions } from "@/components/notification-actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  await connectDB();
  const [notifications, unread] = await Promise.all([
    Notification.find({ userId: session!.user.id }).sort({ createdAt: -1 }).limit(100).lean(),
    Notification.countDocuments({ userId: session!.user.id, readAt: null }),
  ]);
  return <><PageIntro eyebrow="Your updates" title="Notifications" description="Account, research, billing, and exchange events that need your attention."/><section className="surface rounded-[20px] p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><SectionHeader title="Inbox" detail={`${unread} unread · latest 100`}/>{unread > 0 && <NotificationActions/>}</div>{notifications.length ? <div className="divide-y divide-line">{notifications.map(item => <article key={String(item._id)} className={`flex flex-wrap items-start justify-between gap-4 py-5 ${item.readAt ? "opacity-70" : ""}`}><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">{item.title}</span>{!item.readAt && <span className="rounded-full bg-[#c5ff4126] px-2 py-0.5 text-[11px] font-bold text-accent">New</span>}<span className="text-xs uppercase tracking-wide text-muted">{item.kind}</span></div><p className="mt-2 text-sm leading-6 text-muted">{item.body}</p><div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted"><time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleString()}</time>{item.href?.startsWith("/dashboard/") && <Link href={item.href} className="font-bold text-accent hover:underline">View details →</Link>}</div></div>{!item.readAt && <NotificationActions id={String(item._id)}/>}</article>)}</div> : <EmptyState icon={Bell} title="All caught up" text="Account, billing, exchange, and research updates will appear here as they happen."/>}</section></>;
}

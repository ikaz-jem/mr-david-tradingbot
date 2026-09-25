import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { EmptyState, PageIntro, SectionHeader } from "@/components/dashboard-ui";
import { EmailDelivery } from "@/models/EmailDelivery";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export default async function AdminEmailsPage() {
  const session = await getServerSession(authOptions);
  await connectDB();
  const actor = session?.user.id ? await User.findById(session.user.id).select("role status").lean() : null;
  if (!actor || actor.role !== "admin" || actor.status !== "active") notFound();
  const [deliveries, sent, delivered, issues] = await Promise.all([
    EmailDelivery.find().sort({ createdAt: -1 }).limit(100).lean(),
    EmailDelivery.countDocuments(),
    EmailDelivery.countDocuments({ status: "delivered" }),
    EmailDelivery.countDocuments({ status: { $in: ["failed", "bounced", "complained"] } }),
  ]);
  return <>
    <PageIntro eyebrow="Operations / communication" title="Email delivery" description="Resend send attempts and delivery status. Delivery tracking requires the verified Resend webhook configuration."/>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Recorded sends" value={sent}/><Metric label="Delivered" value={delivered}/><Metric label="Issues" value={issues}/></div>
    <section className="surface rounded-[20px] p-5 sm:p-6"><SectionHeader title="Recent messages" detail={`Latest ${deliveries.length} · no email body stored`}/>{deliveries.length ? <div className="app-scrollbar overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="border-b border-line uppercase tracking-widest text-muted"><tr><th className="py-3">Recipient</th><th>Category</th><th>Status</th><th>Last error</th><th>Updated</th></tr></thead><tbody className="divide-y divide-line">{deliveries.map(delivery => <tr key={String(delivery._id)}><td className="py-3">{delivery.recipient}</td><td>{delivery.category.replaceAll("_", " ")}</td><td className={issues && ["failed", "bounced", "complained"].includes(delivery.status) ? "text-[#ff939b]" : "text-accent"}>{delivery.status}</td><td className="max-w-60 truncate text-muted">{delivery.lastError || "—"}</td><td>{new Date(delivery.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <EmptyState title="No email sends yet" text="Verification, reset, welcome, and contact emails will appear after Resend is configured and used."/>}</section>
  </>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="surface rounded-[18px] p-5"><div className="text-xs text-muted">{label}</div><div className="mt-3 text-3xl font-bold number">{value}</div></div>; }

import { PaymentBillingConsole } from "@/components/payment-billing-console";
import { workspaceActor } from "@/lib/workspace-access";
import { CreditEntry } from "@/models/CreditEntry";
import { ensureDemoWorkspace } from "@/lib/demo-workspace";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function CreditsPage() {
  const actor = await workspaceActor();
  if (!actor) redirect("/login");
  const activity = actor.isDemo
    ? [...(await ensureDemoWorkspace(actor.id))?.activity ?? []].reverse().slice(0, 30)
    : await CreditEntry.find({ userId: actor.id }).sort({ createdAt: -1 }).limit(30).lean();
  return <><PaymentBillingConsole/><section className="surface mt-5 rounded-2xl p-6"><h2 className="text-lg font-bold">Credit activity</h2><div className="mt-4 divide-y divide-line">{activity.map((row, index) => <div key={index} className="flex items-center justify-between gap-3 py-3 text-sm"><div>{row.note}<p className="mt-1 text-xs text-muted">{row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}</p></div><span className={Number(row.amount) >= 0 ? "text-accent" : "text-red-300"}>{Number(row.amount) > 0 ? "+" : ""}{row.amount}</span></div>)}</div>{!activity.length && <p className="mt-4 text-sm text-muted">Credit purchases and product usage appear here.</p>}</section></>;
}

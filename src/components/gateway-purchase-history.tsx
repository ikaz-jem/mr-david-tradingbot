import { BillingPurchase } from "@/models/BillingPurchase";
import { User } from "@/models/User";
import { EmptyState, SectionHeader } from "@/components/dashboard-ui";

export async function GatewayPurchaseHistory({ isDemo }: { isDemo: boolean }) {
  const rows = await BillingPurchase.find({ isDemo: isDemo ? true : { $ne: true } }).sort({ createdAt: -1 }).limit(100).lean();
  const users = await User.find({ _id: { $in: rows.map(row => row.userId) } }).select("email").lean();
  const emails = new Map(users.map(user => [String(user._id), user.email]));
  return <section className="surface mb-5 rounded-[20px] p-5 sm:p-6">
    <SectionHeader title={isDemo ? "Demo gateway purchases" : "Gateway purchases"} detail="Latest 100 · newest first"/>
    {rows.length ? <div className="app-scrollbar overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs">
      <thead className="border-b border-line text-muted"><tr>{["Customer", "Gateway / mode", "Purchase", "Amount", "Credits", "Status", "Reference / date"].map(label => <th key={label} className="py-3 pr-4">{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-line">{rows.map(row => <tr key={String(row._id)}><td className="py-4 pr-4">{emails.get(String(row.userId)) ?? "Unknown"}</td><td>{row.provider}<div className="text-muted">{row.mode}</div></td><td>{row.kind}</td><td>{(row.expectedAmount / 100).toLocaleString()} {row.currency}</td><td>{row.credits}</td><td className={row.status === "paid" ? "text-accent" : row.status === "review" ? "text-amber-300" : "text-muted"}>{row.status}<div>{row.providerStatus}</div>{row.failureCode && <div className="mt-1 text-amber-200">{row.failureCode}</div>}</td><td className="font-mono">{row.reference}{row.providerPaymentId && <div className="mt-1 text-muted">Provider ID: {row.providerPaymentId}</div>}{row.provider === "nowpayments" && <div className="mt-1 text-muted">{row.payCurrency?.toUpperCase()} · {row.payNetwork}</div>}<div className="mt-1 text-muted">{new Date(row.createdAt).toLocaleString()}</div></td></tr>)}</tbody>
    </table></div> : <EmptyState title="No gateway purchases yet" text="Checkouts and verified payment statuses will appear here."/>}
  </section>;
}

import { getServerSession } from "next-auth";
import { ArrowUpRight, Layers3, ShieldCheck } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { exchangeEncryptionReady } from "@/lib/exchange-credentials";
import { BinanceConnectionPanel } from "@/components/binance-connection-panel";
import { PageIntro } from "@/components/dashboard-ui";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

export default async function ExchangesPage() {
  const session = await getServerSession(authOptions);
  await connectDB();
  const [user, connection] = await Promise.all([
    User.findById(session!.user.id).select("isDemo").lean(),
    ExchangeConnection.findOne({ userId: session!.user.id, provider: "binance", market: "spot", environment: "live" }).lean(),
  ]);
  const initial = connection ? {
    status: connection.status as "connected" | "attention", keyLast4: connection.keyLast4, ipRestricted: connection.ipRestricted,
    lastCheckedAt: connection.lastCheckedAt?.toISOString() ?? null, lastError: connection.lastError ?? null,
    createdAt: connection.createdAt.toISOString(),
  } : null;
  return <><PageIntro eyebrow="Your exchange accounts" title="Exchange connections" description="Keep your crypto at your exchange. Connect a dedicated read-only key to see your Spot account without enabling orders."/>
    <BinanceConnectionPanel initial={initial} configured={exchangeEncryptionReady()} demo={Boolean(user?.isDemo)}/>
    <div className="mt-5 grid gap-4 md:grid-cols-2"><div className="surface rounded-[20px] p-6"><ShieldCheck className="size-5 text-accent"/><h2 className="mt-5 text-lg font-bold">Orders remain off</h2><p className="mt-2 text-sm leading-7 text-muted">A connection here cannot place a trade. User-approved Spot execution needs a separate release, permission review, and order confirmation flow.</p></div><div className="surface rounded-[20px] p-6"><Layers3 className="size-5 text-accent"/><h2 className="mt-5 text-lg font-bold">More exchanges, one workspace</h2><p className="mt-2 text-sm leading-7 text-muted">This connection record separates provider, market, and environment, so additional CEX integrations can be added without mixing credentials or balances.</p><span className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent">More providers planned <ArrowUpRight className="size-4"/></span></div></div>
  </>;
}

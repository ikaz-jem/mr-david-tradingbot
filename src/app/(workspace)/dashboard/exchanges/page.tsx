import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { exchangeEncryptionReady } from "@/lib/exchange-credentials";
import { ExchangeConnectionManager, type ExchangeConnectionView } from "@/components/exchange-connection-manager";
import { PageIntro } from "@/components/dashboard-ui";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { DemoExchanges } from "@/components/demo-exchanges";
import { getPlatformConfig } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

export default async function ExchangesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  await connectDB();
  if (session.user.isDemo) return <><PageIntro eyebrow="Connected workspace" title="Exchange connections" description="Explore a unified multi-exchange workspace without sharing credentials or moving funds."/><DemoExchanges/></>;
  const [connections, operations] = await Promise.all([ExchangeConnection.find({ userId: session.user.id, market: { $in: ["spot", "futures"] }, environment: "live" }).sort({ createdAt: 1 }).lean(), getPlatformConfig()]);
  const initial = connections.map((connection) => ({
    provider: connection.provider, market: connection.market, status: connection.status, access: connection.access, keyLast4: connection.keyLast4,
    accountLabel: connection.accountLabel ?? null, ipRestricted: connection.ipRestricted,
    lastCheckedAt: connection.lastCheckedAt?.toISOString() ?? null, lastError: connection.lastError ?? null,
    createdAt: connection.createdAt.toISOString(),
  })) as ExchangeConnectionView[];
  return <><PageIntro eyebrow="Connected portfolio" title="Exchange connection center" description="Connect each exchange once, keep assets in your own accounts, and optionally authorize user-confirmed Spot execution for Approval Desk."/>
    <ExchangeConnectionManager initial={initial} configured={exchangeEncryptionReady()} connectionOpen={!operations.maintenanceMode && operations.exchangeConnectionsOpen} operationsMessage={operations.maintenanceMode ? operations.maintenanceMessage : operations.exchangeConnectionsPausedMessage}/>
  </>;
}

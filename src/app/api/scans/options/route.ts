import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platform-config";
import { getProductCatalog } from "@/lib/product-catalog";
import { getAccountCreditState } from "@/lib/credits";
import { User } from "@/models/User";
import { getServiceConfigStatus } from "@/lib/service-config";
import { getEnabledStrategies } from "@/lib/strategy-catalog";


export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await connectDB();
  const user = await User.findById(session.user.id).select("settings").lean();
  const defaults = { symbol: user?.settings?.defaultSymbol ?? "BTCUSDT", interval: user?.settings?.defaultInterval ?? "4h", strategy: user?.settings?.defaultStrategy ?? "ai-router", riskProfile: user?.settings?.riskProfile ?? "balanced" };
  if (session.user.isDemo) {
    const [catalog, config, account, service, strategies] = await Promise.all([getProductCatalog(true), getPlatformConfig(true), getAccountCreditState(session.user.id), getServiceConfigStatus(true), getEnabledStrategies(true, "signals")]);
    const product = catalog.find(item => item.slug === "signals");
    const aiReady = Boolean(service.openaiApiKey && service.openaiModel);
    return NextResponse.json({ symbols: config.allowedScanSymbols, strategies: strategies.map(item => ({ slug: item.slug, name: item.name, description: item.description, experimental: item.experimental })), scansOpen: !config.maintenanceMode && config.scansOpen && (product?.enabled ?? false) && aiReady, operationsMessage: config.maintenanceMode ? config.maintenanceMessage : !config.scansOpen ? config.scansPausedMessage : "", aiReady, cost: product?.cost ?? 1, activated: account.activated, balance: account.balance, defaults }, { headers: { "Cache-Control": "no-store" } });
  }
  const [config, catalog, account, service, strategies] = await Promise.all([getPlatformConfig(), getProductCatalog(false), getAccountCreditState(session.user.id), getServiceConfigStatus(false), getEnabledStrategies(false, "signals")]);
  const product = catalog.find(item => item.slug === "signals");
  const aiReady = Boolean(service.openaiApiKey && service.openaiModel);
  return NextResponse.json({ symbols: config.allowedScanSymbols, strategies: strategies.map(item => ({ slug: item.slug, name: item.name, description: item.description, experimental: item.experimental })), scansOpen: !config.maintenanceMode && config.scansOpen && Boolean(product?.enabled) && aiReady, operationsMessage: config.maintenanceMode ? config.maintenanceMessage : !config.scansOpen ? config.scansPausedMessage : "", aiReady, cost: product?.cost ?? 1, activated: account.activated, balance: account.balance, defaults }, { headers: { "Cache-Control": "no-store" } });
}

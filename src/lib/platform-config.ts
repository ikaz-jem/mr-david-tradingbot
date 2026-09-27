import { PlatformConfig } from "@/models/PlatformConfig";

export async function getPlatformConfig() {
  const config = await PlatformConfig.findOne({ key: "global" }).lean();
  return {
    registrationOpen: config?.registrationOpen ?? true,
    scansOpen: config?.scansOpen ?? true,
    exchangeConnectionsOpen: config?.exchangeConnectionsOpen ?? true,
    paperReconciliationOpen: config?.paperReconciliationOpen ?? true,
    contactIntakeOpen: config?.contactIntakeOpen ?? true,
    allowedScanSymbols: config?.allowedScanSymbols?.filter(symbol => ["BTCUSDT", "ETHUSDT", "SOLUSDT"].includes(symbol)) ?? ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
    announcement: config?.announcement ?? "",
  };
}

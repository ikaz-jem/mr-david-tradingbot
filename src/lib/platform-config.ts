import { PlatformConfig } from "@/models/PlatformConfig";
import { scanSymbols } from "@/lib/scan-markets";

export async function getPlatformConfig(isDemo = false) {
  const config = await PlatformConfig.findOne({ key: isDemo ? "demo" : "global" }).lean();
  return {
    registrationOpen: config?.registrationOpen ?? true,
    scansOpen: config?.scansOpen ?? true,
    exchangeConnectionsOpen: config?.exchangeConnectionsOpen ?? true,
    paperReconciliationOpen: config?.paperReconciliationOpen ?? true,
    contactIntakeOpen: config?.contactIntakeOpen ?? true,
    allowedScanSymbols: config?.allowedScanSymbols?.filter(symbol => (scanSymbols as readonly string[]).includes(symbol)) ?? [...scanSymbols],
    announcement: config?.announcement ?? "",
  };
}

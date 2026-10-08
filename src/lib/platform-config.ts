import { PlatformConfig } from "@/models/PlatformConfig";
import { scanIntervals, scanSymbols } from "@/lib/scan-markets";
import { platformConfigKey } from "@/lib/platform-scope";

export const defaultApprovalStrategySlugs = ["ai-router", "trend-breakout", "momentum-continuation", "mean-reversion"];

export const defaultCreditPacks = [
  { id: "credits_25", label: "25 platform credits", credits: 25, priceMinor: 1500, enabled: true },
  { id: "credits_100", label: "100 platform credits", credits: 100, priceMinor: 5000, enabled: true },
];

export async function getPlatformConfig(isDemo = false) {
  const config = await PlatformConfig.findOne({ key: platformConfigKey(isDemo) }).lean();
  const operations = config;
  return {
    registrationOpen: operations?.registrationOpen ?? true,
    scansOpen: operations?.scansOpen ?? true,
    approvalDiscoveryOpen: operations?.approvalDiscoveryOpen ?? true,
    autopilotOpen: operations?.autopilotOpen ?? true,
    exchangeConnectionsOpen: operations?.exchangeConnectionsOpen ?? true,
    billingOpen: operations?.billingOpen ?? true,
    supportOpen: operations?.supportOpen ?? true,
    paperReconciliationOpen: operations?.paperReconciliationOpen ?? true,
    contactIntakeOpen: operations?.contactIntakeOpen ?? true,
    maintenanceMode: operations?.maintenanceMode ?? false,
    maintenanceMessage: operations?.maintenanceMessage || "Enrivea Signal is undergoing scheduled maintenance. Existing data remains safe; please try again shortly.",
    registrationPausedMessage: operations?.registrationPausedMessage || "New registrations are temporarily paused. Please check back shortly.",
    scansPausedMessage: operations?.scansPausedMessage || "Research scans are temporarily paused by operations. No credit was charged.",
    approvalPausedMessage: operations?.approvalPausedMessage || "Approval Desk discovery is temporarily paused. Existing unlocked research remains available.",
    autopilotPausedMessage: operations?.autopilotPausedMessage || "Autopilot is temporarily paused by operations. No new automated actions will be created.",
    exchangeConnectionsPausedMessage: operations?.exchangeConnectionsPausedMessage || "New exchange connections are temporarily paused. Existing credentials remain protected and can still be removed.",
    billingPausedMessage: operations?.billingPausedMessage || "Account activation and credit purchases are temporarily paused. No payment was initiated.",
    supportPausedMessage: operations?.supportPausedMessage || "New support tickets are temporarily paused. Existing conversations remain available.",
    paperReconciliationPausedMessage: operations?.paperReconciliationPausedMessage || "Paper outcome refresh is temporarily paused. Existing performance records are unchanged.",
    contactIntakePausedMessage: operations?.contactIntakePausedMessage || "Contact intake is temporarily paused. Please use the published support email address.",
    activationOpen: config?.activationOpen ?? true,
    activationPriceMinor: config?.activationPriceMinor ?? 2500,
    activationCredits: config?.activationCredits ?? 25,
    creditPacks: config?.creditPacks?.map(pack => ({ id: pack.id, label: pack.label, credits: pack.credits, priceMinor: pack.priceMinor, enabled: pack.enabled })) ?? defaultCreditPacks,
    allowedScanSymbols: config?.allowedScanSymbols?.filter(symbol => (scanSymbols as readonly string[]).includes(symbol)) ?? [...scanSymbols],
    approvalScanSymbols: config?.approvalScanSymbols?.filter(symbol => (scanSymbols as readonly string[]).includes(symbol)) ?? ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"],
    approvalScanIntervals: config?.approvalScanIntervals?.filter(interval => (scanIntervals as readonly string[]).includes(interval)) ?? ["15m", "1h", "4h"],
    approvalScanStrategySlugs: config?.approvalScanStrategySlugs?.filter(Boolean) ?? defaultApprovalStrategySlugs,
    approvalScanMaxCombinations: config?.approvalScanMaxCombinations ?? 120,
    approvalScanCadenceMinutes: config?.approvalScanCadenceMinutes ?? 5,
    announcement: config?.announcement ?? "",
  };
}

export function approvalDiscoveryStatus(input: { operationsOpen: boolean; productEnabled: boolean; preferenceEnabled: boolean; demo: boolean; cadenceMinutes: number; job?: { status: string; completedAt?: Date | string | null; leaseUntil?: Date | string | null; lastError?: string } | null }, now = Date.now()) {
  if (!input.operationsOpen) return { label: "Discovery paused", detail: "Platform operations has paused discovery." };
  if (!input.productEnabled) return { label: "Product unavailable", detail: "Approval Desk is disabled in the product catalog." };
  if (!input.preferenceEnabled) return { label: "Scanning paused", detail: "Enable scanning in your Scan settings." };
  if (input.demo) return { label: "Demo discovery", detail: "Illustrative opportunities; no live analysis is performed." };
  if (input.job?.status === "running") return new Date(input.job.leaseUntil ?? 0).getTime() > now
    ? { label: "Scan in progress", detail: "The shared scanner is checking eligible markets." }
    : { label: "Scan interrupted", detail: "The previous run stopped responding. Waiting for the next scheduled scan." };
  if (input.job?.status === "failed" || input.job?.lastError) return { label: "Discovery needs attention", detail: "Some market analysis could not complete. Operations needs to check the scanner. Existing research remains available." };
  if (!input.job?.completedAt) return { label: "Waiting for first scan", detail: "Your preferences are saved. The shared scanner has not completed its first run." };
  if (now - new Date(input.job.completedAt).getTime() > Math.max(15, input.cadenceMinutes * 3) * 60000) return { label: "Scan overdue", detail: "The shared scanner has not run recently. Operations needs to check the schedule." };
  return { label: "Discovery up to date", detail: "The latest shared scan is complete. New qualifying setups appear automatically." };
}

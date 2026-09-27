import { paystackSettlementConfig } from "@/lib/billing-catalog";

export async function paystackLiveRequest<T>(path: string, init?: { method: "POST"; body: unknown }): Promise<T> {
  const config = paystackSettlementConfig();
  if (!config) throw new Error("Live billing unavailable");
  const response = await fetch(`https://api.paystack.co/${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
    body: init ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Paystack returned ${response.status}`);
  const json = await response.json();
  if (!json?.status) throw new Error("Paystack rejected the request");
  return json.data as T;
}

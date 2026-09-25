import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlanId } from "@/lib/plans";

const planEnv: Record<PlanId, string> = {
  starter: "PAYSTACK_TEST_PLAN_STARTER",
  trader: "PAYSTACK_TEST_PLAN_TRADER",
  desk: "PAYSTACK_TEST_PLAN_DESK",
};

export function paystackTestKey() {
  const key = process.env.PAYSTACK_TEST_SECRET_KEY;
  if (process.env.NODE_ENV === "production" || process.env.PAYSTACK_SANDBOX_ENABLED !== "true" || !key?.startsWith("sk_test_")) return null;
  return key;
}

export function paystackTestPlanCode(planId: PlanId) {
  const code = process.env[planEnv[planId]];
  return code?.startsWith("PLN_") ? code : null;
}

export function verifyPaystackSignature(rawBody: string, header: string | null, secret: string) {
  if (!header || !/^[a-f0-9]{128}$/i.test(header)) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(header, "hex"));
}

export async function paystackTestRequest<T>(path: string, init?: { method: "POST"; body: unknown }): Promise<T> {
  const key = paystackTestKey();
  if (!key) throw new Error("Paystack sandbox is disabled");
  const response = await fetch(`https://api.paystack.co/${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Paystack API returned ${response.status}`);
  const json = await response.json();
  if (!json?.status) throw new Error("Paystack API rejected the request");
  return json.data as T;
}

export class PaymentCallbackError extends Error {}

export function paymentCallbackOrigin(provider: "paystack" | "nowpayments", mode: "demo" | "test" | "live", appUrl?: string): string | null {
  if (mode === "demo") return null;

  // Paystack can verify a test transaction by reference without redirecting to this app.
  // A local URL must never be sent to the provider as a callback.
  if (provider === "paystack" && mode === "test") {
    if (!appUrl) return null;
    try {
      const url = new URL(appUrl);
      return url.protocol === "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ? url.origin : null;
    } catch {
      return null;
    }
  }

  if (!appUrl) throw new PaymentCallbackError("Configure APP_URL before provider checkout.");
  let url: URL;
  try {
    url = new URL(appUrl);
  } catch {
    throw new PaymentCallbackError("Configure a valid public HTTPS APP_URL before provider checkout.");
  }
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new PaymentCallbackError("Provider checkout requires a public HTTPS APP_URL for payment callbacks.");
  }
  return url.origin;
}

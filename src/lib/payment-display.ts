// Only official provider SVG assets may be loaded. Never inline remote SVG markup.
export function paymentCoinIcon(code: string, logo?: string) {
  if (logo) {
    try {
      const url = new URL(logo, "https://nowpayments.io");
      if (url.origin === "https://nowpayments.io" && /^\/images\/coins\/[a-zA-Z0-9_-]+\.svg$/.test(url.pathname) && !url.search && !url.hash) return url.href;
    } catch { /* Fall back to a validated currency code. */ }
  }
  return /^[a-z0-9]{2,30}$/i.test(code) ? `https://nowpayments.io/images/coins/${code.toLowerCase()}.svg` : "";
}

export function shouldVerifyPayment(purchase: { mode: string; status: string; providerStatus?: string }) {
  return purchase.mode !== "demo" && (purchase.status === "pending" || purchase.status === "initializing" || (purchase.status === "review" && purchase.providerStatus === "partially_paid"));
}

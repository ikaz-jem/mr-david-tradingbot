// Expo Web's local dev server runs on a separate port from Next.js, including
// when its API points to the deployed server. Only its loopback preview ports
// are allowed by default; other browser origins require an explicit allowlist.
export function mobileWebCorsOrigin(origin: string | null, environment: string | undefined, allowedOrigins = ""): string | null {
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin) return null;
    if (parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname)
      && (/^808[1-9]$/.test(parsed.port) || parsed.port === "19006")) return origin;
    const trusted = allowedOrigins.split(",").map((value) => value.trim()).filter(Boolean);
    return trusted.includes(origin) ? origin : null;
  } catch {
    return null;
  }
}

export function mobileWebCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

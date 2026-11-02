// Expo Web's local dev server runs on a separate port from Next.js. Do not
// expose cross-origin mobile API access outside local development.
export function mobileWebCorsOrigin(origin: string | null, environment: string | undefined): string | null {
  if (environment !== "development" || !origin) return null;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(parsed.hostname)) return null;
    if (!/^808[1-9]$/.test(parsed.port) && parsed.port !== "19006") return null;
    return parsed.origin;
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

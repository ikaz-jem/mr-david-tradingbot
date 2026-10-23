// Empty deployment values must behave like omitted values. A server-side
// fetch cannot resolve a relative path against the application's domain.
export function absoluteHttpsOrigin(configured: string | undefined, fallback: string, setting: string): string {
  const value = configured?.trim() || fallback;
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error(`${setting} must be an absolute HTTPS origin.`); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${setting} must be an absolute HTTPS origin without a path, query, or credentials.`);
  }
  return url.origin;
}

export function binanceDataOrigin(configured = process.env.BINANCE_DATA_BASE_URL): string {
  return absoluteHttpsOrigin(configured, "https://data-api.binance.vision", "BINANCE_DATA_BASE_URL");
}

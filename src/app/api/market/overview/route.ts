import { getMarketOverview } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public fixed-symbol quotes; no account data, credentials or caller URL.
export async function GET() {
  return Response.json(await getMarketOverview(), { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } });
}

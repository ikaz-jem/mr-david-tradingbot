import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platform-config";
import { getProductCatalog } from "@/lib/product-catalog";


export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await connectDB();
  if (session.user.isDemo) {
    const product = (await getProductCatalog(true)).find(item => item.slug === "signals");
    const config = await getPlatformConfig(true);
    return NextResponse.json({ symbols: config.allowedScanSymbols, scansOpen: config.scansOpen && (product?.enabled ?? false), cost: product?.cost ?? 1 });
  }
  const config = await getPlatformConfig();
  return NextResponse.json({ symbols: config.allowedScanSymbols, scansOpen: config.scansOpen }, { headers: { "Cache-Control": "no-store" } });
}

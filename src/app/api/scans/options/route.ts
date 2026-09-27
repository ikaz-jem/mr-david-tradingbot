import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platform-config";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await connectDB();
  const config = await getPlatformConfig();
  return NextResponse.json({ symbols: config.allowedScanSymbols, scansOpen: config.scansOpen }, { headers: { "Cache-Control": "no-store" } });
}

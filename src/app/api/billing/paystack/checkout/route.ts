import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ error: "Legacy monthly checkout has been retired. Use the account activation and credit-refill checkout." }, { status: 410 });
}

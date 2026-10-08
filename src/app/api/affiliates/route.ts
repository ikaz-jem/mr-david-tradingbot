import { NextResponse } from "next/server";
import { workspaceActor } from "@/lib/workspace-access";
import { affiliateReport } from "@/lib/affiliates";

export async function GET(request: Request) {
  const actor = await workspaceActor();
  if (!actor) return NextResponse.json({ error: "Sign in to view your affiliates." }, { status: 401 });
  const page = Math.max(1, Math.min(10000, Number(new URL(request.url).searchParams.get("page")) || 1));
  return NextResponse.json(await affiliateReport(actor.id, actor.isDemo, false, Math.floor(page)), { headers: { "Cache-Control": "no-store" } });
}

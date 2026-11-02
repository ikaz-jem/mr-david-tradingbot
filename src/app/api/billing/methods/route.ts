import { NextResponse } from "next/server";
import { workspaceActor } from "@/lib/workspace-access";
import { billingMethodsState } from "@/lib/billing-methods-state";

export async function GET() {
  const actor = await workspaceActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json(await billingMethodsState(actor), { headers: { "Cache-Control": "no-store" } });
}

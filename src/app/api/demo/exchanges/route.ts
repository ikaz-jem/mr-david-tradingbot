import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { ensureDemoWorkspace } from "@/lib/demo-workspace";
import { DemoWorkspace } from "@/models/DemoWorkspace";
export async function GET() {
  const actor = await workspaceActor();
  if (!actor?.isDemo) return NextResponse.json({ error: "Demo accounts only." }, { status: 403 });
  return NextResponse.json({ connections: (await ensureDemoWorkspace(actor.id))?.connections ?? [] });
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor?.isDemo) return NextResponse.json({ error: "Demo accounts only." }, { status: 403 });
  const parsed = z.object({ provider: z.enum(["binance", "coinbase", "kraken", "okx"]), action: z.enum(["connect", "disconnect"]) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  const workspace = await ensureDemoWorkspace(actor.id);
  if (!workspace) return NextResponse.json({ error: "Workspace unavailable." }, { status: 503 });
  const connections = workspace.connections.filter(item => item.provider !== parsed.data.provider).map(item => ({ provider: item.provider, label: item.label, connectedAt: item.connectedAt }));
  if (parsed.data.action === "connect") connections.push({ provider: parsed.data.provider, label: "Simulated Spot account", connectedAt: new Date() });
  const result = await DemoWorkspace.updateOne({ _id: workspace._id, revision: workspace.revision }, { $set: { connections }, $inc: { revision: 1 } });
  if (!result.modifiedCount) return NextResponse.json({ error: "Connections changed. Refresh and retry." }, { status: 409 });
  return NextResponse.json({ ok: true, connections });
}


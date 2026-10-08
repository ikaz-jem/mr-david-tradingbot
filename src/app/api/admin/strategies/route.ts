import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/request-origin";
import { getStrategyCatalog, strategyEngines, strategyProducts, strategySensitivities } from "@/lib/strategy-catalog";
import { workspaceActor } from "@/lib/workspace-access";
import { StrategyDefinition } from "@/models/StrategyDefinition";

const input = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().min(20).max(400),
  engine: z.enum(strategyEngines),
  sensitivity: z.enum(strategySensitivities),
  products: z.array(z.enum(strategyProducts)).min(1),
  enabled: z.boolean(),
  experimental: z.boolean(),
  revision: z.number().int().min(0),
});

async function admin(permission: "strategies:read" | "strategies:update") {
  const actor = await workspaceActor();
  return actor?.organizationKind === "platform" && actor.can(permission) ? actor : null;
}

export async function GET() {
  const actor = await admin("strategies:read");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  return NextResponse.json({ catalog: await getStrategyCatalog(actor.isDemo), isDemo: actor.isDemo, engines: strategyEngines, products: strategyProducts });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await admin("strategies:update");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the strategy definition and product assignments." }, { status: 400 });
  const scope = actor.isDemo ? "demo" : "live";
  const { slug, revision, ...fields } = parsed.data;
  const existing = await StrategyDefinition.findOne({ scope, slug });
  if (existing) {
    if (existing.locked && existing.engine !== fields.engine) return NextResponse.json({ error: "Built-in strategy engines cannot be replaced. Create a new strategy instead." }, { status: 409 });
    if (existing.slug === "ai-router" && (!fields.enabled || !fields.products.includes("signals"))) return NextResponse.json({ error: "AI Strategy Router must remain available to the Research Scanner." }, { status: 409 });
    const result = await StrategyDefinition.updateOne({ _id: existing._id, revision }, { $set: fields, $inc: { revision: 1, version: 1 } });
    if (!result.modifiedCount) return NextResponse.json({ error: "Strategy catalog changed. Refresh before saving." }, { status: 409 });
  } else {
    if (fields.engine === "ai-router") return NextResponse.json({ error: "Only one AI Strategy Router is allowed." }, { status: 409 });
    if (await StrategyDefinition.countDocuments({ scope }) >= 50) return NextResponse.json({ error: "Strategy catalog limit reached." }, { status: 409 });
    try { await StrategyDefinition.create({ scope, slug, ...fields, version: 1, revision: 0, locked: false }); }
    catch { return NextResponse.json({ error: "Strategy already exists. Refresh the catalog." }, { status: 409 }); }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await admin("strategies:update");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const parsed = z.object({ slug: z.string(), revision: z.number().int().min(0) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid strategy deletion request." }, { status: 400 });
  const scope = actor.isDemo ? "demo" : "live";
  const strategy = await StrategyDefinition.findOne({ scope, slug: parsed.data.slug });
  if (!strategy) return NextResponse.json({ error: "Strategy no longer exists." }, { status: 404 });
  if (strategy.locked) return NextResponse.json({ error: "Built-in strategies can be disabled but not deleted." }, { status: 409 });
  const result = await StrategyDefinition.deleteOne({ _id: strategy._id, revision: parsed.data.revision });
  if (!result.deletedCount) return NextResponse.json({ error: "Strategy changed. Refresh before deleting." }, { status: 409 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/request-origin";
import { getStrategyCatalog, strategyEngines, strategyProducts, strategySensitivities } from "@/lib/strategy-catalog";
import { workspaceActor } from "@/lib/workspace-access";
import { StrategyDefinition } from "@/models/StrategyDefinition";
import { connectDB } from "@/lib/db";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { consumeAdminMutationLimit } from "@/lib/admin-mutation-limit";
import { writeSecurityAudit } from "@/lib/access-control";

export const runtime = "nodejs";

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
  reason: z.string().trim().min(8).max(300),
});

async function admin(permission: "strategies:read" | "strategies:update") {
  const actor = await workspaceActor();
  return actor?.organizationKind === "platform" && actor.can(permission) ? actor : null;
}

export async function GET() {
  const actor = await admin("strategies:read");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  return NextResponse.json({ catalog: await getStrategyCatalog(actor.isDemo), isDemo: actor.isDemo, engines: strategyEngines, products: strategyProducts, canUpdate: actor.can("strategies:update") }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await admin("strategies:update");
  if (!actor) {
    const deniedActor = await workspaceActor();
    await writeSecurityAudit({ actor: deniedActor, action: "strategies.update", resource: "strategies", targetType: "StrategyDefinition", outcome: "denied", reason: "Strategy update permission required", request }).catch(() => undefined);
    return NextResponse.json({ error: "Strategy update permission required." }, { status: 403 });
  }
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the strategy definition and product assignments." }, { status: 400 });
  await connectDB();
  if (!await consumeAdminMutationLimit(actor.id, "strategies:update")) return NextResponse.json({ error: "Too many strategy changes. Wait one minute and retry." }, { status: 429 });
  const scope = actor.isDemo ? "demo" : "live";
  const { slug, revision, reason, ...fields } = parsed.data;
  try {
    const db = await connectDB();
    let before: unknown = null;
    let after: unknown = null;
    await db.connection.transaction(async session => {
      const existing = await StrategyDefinition.findOne({ scope, slug }).session(session);
      if (existing) {
        before = existing.toObject();
        if (existing.locked && existing.engine !== fields.engine) throw new Error("LOCKED_ENGINE");
        if (existing.slug === "ai-router" && (!fields.enabled || !fields.products.includes("signals"))) throw new Error("ROUTER_REQUIRED");
        const result = await StrategyDefinition.updateOne({ _id: existing._id, revision }, { $set: fields, $inc: { revision: 1, version: 1 } }, { session });
        if (!result.modifiedCount) throw new Error("CATALOG_CHANGED");
      } else {
        if (fields.engine === "ai-router") throw new Error("ROUTER_DUPLICATE");
        if (await StrategyDefinition.countDocuments({ scope }).session(session) >= 50) throw new Error("CATALOG_LIMIT");
        await StrategyDefinition.create([{ scope, slug, ...fields, version: 1, revision: 0, locked: false }], { session });
      }
      after = await StrategyDefinition.findOne({ scope, slug }).session(session).lean();
      await AdminAuditEvent.create([{ actorId: actor.id, targetType: "platform", targetId: `strategy:${scope}:${slug}`, action: before ? "update_strategy" : "create_strategy", before: JSON.stringify(before), after: JSON.stringify(after), reason, status: "applied" }], { session });
    });
    await writeSecurityAudit({ actor, action: "strategies.update", resource: "strategies", targetType: "StrategyDefinition", targetId: `${scope}:${slug}`, previousValue: before, newValue: after, outcome: "success", reason, request }).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    await writeSecurityAudit({ actor, action: "strategies.update", resource: "strategies", targetType: "StrategyDefinition", targetId: `${scope}:${slug}`, outcome: "failed", reason, request, metadata: { error: error instanceof Error ? error.message : "unknown" } }).catch(() => undefined);
    const message = error instanceof Error ? error.message : "";
    if (message === "LOCKED_ENGINE") return NextResponse.json({ error: "Built-in strategy engines cannot be replaced. Create a new strategy instead." }, { status: 409 });
    if (message === "ROUTER_REQUIRED") return NextResponse.json({ error: "AI Strategy Router must remain available to the Research Scanner." }, { status: 409 });
    if (message === "ROUTER_DUPLICATE") return NextResponse.json({ error: "Only one AI Strategy Router is allowed." }, { status: 409 });
    if (message === "CATALOG_CHANGED") return NextResponse.json({ error: "Strategy catalog changed. Refresh before saving." }, { status: 409 });
    if (message === "CATALOG_LIMIT") return NextResponse.json({ error: "Strategy catalog limit reached." }, { status: 409 });
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "Strategy already exists. Refresh the catalog." }, { status: 409 });
    console.error("Strategy catalog update failed", error);
    return NextResponse.json({ error: "Strategy could not be saved. Check the audit trail before retrying." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await admin("strategies:update");
  if (!actor) {
    const deniedActor = await workspaceActor();
    await writeSecurityAudit({ actor: deniedActor, action: "strategies.delete", resource: "strategies", targetType: "StrategyDefinition", outcome: "denied", reason: "Strategy update permission required", request }).catch(() => undefined);
    return NextResponse.json({ error: "Strategy update permission required." }, { status: 403 });
  }
  const parsed = z.object({ slug: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/), revision: z.number().int().min(0), reason: z.string().trim().min(8).max(300) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid strategy deletion request." }, { status: 400 });
  const scope = actor.isDemo ? "demo" : "live";
  await connectDB();
  if (!await consumeAdminMutationLimit(actor.id, "strategies:delete", 10)) return NextResponse.json({ error: "Too many strategy changes. Wait one minute and retry." }, { status: 429 });
  try {
    const db = await connectDB();
    let before: unknown = null;
    await db.connection.transaction(async session => {
      const strategy = await StrategyDefinition.findOne({ scope, slug: parsed.data.slug }).session(session);
      if (!strategy) throw new Error("NOT_FOUND");
      if (strategy.locked) throw new Error("LOCKED");
      before = strategy.toObject();
      const result = await StrategyDefinition.deleteOne({ _id: strategy._id, revision: parsed.data.revision }, { session });
      if (!result.deletedCount) throw new Error("CATALOG_CHANGED");
      await AdminAuditEvent.create([{ actorId: actor.id, targetType: "platform", targetId: `strategy:${scope}:${parsed.data.slug}`, action: "delete_strategy", before: JSON.stringify(before), after: "deleted", reason: parsed.data.reason, status: "applied" }], { session });
    });
    await writeSecurityAudit({ actor, action: "strategies.delete", resource: "strategies", targetType: "StrategyDefinition", targetId: `${scope}:${parsed.data.slug}`, previousValue: before, newValue: null, outcome: "success", reason: parsed.data.reason, request }).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    await writeSecurityAudit({ actor, action: "strategies.delete", resource: "strategies", targetType: "StrategyDefinition", targetId: `${scope}:${parsed.data.slug}`, outcome: "failed", reason: parsed.data.reason, request, metadata: { error: message || "unknown" } }).catch(() => undefined);
    if (message === "NOT_FOUND") return NextResponse.json({ error: "Strategy no longer exists." }, { status: 404 });
    if (message === "LOCKED") return NextResponse.json({ error: "Built-in strategies can be disabled but not deleted." }, { status: 409 });
    if (message === "CATALOG_CHANGED") return NextResponse.json({ error: "Strategy changed. Refresh before deleting." }, { status: 409 });
    console.error("Strategy deletion failed", error);
    return NextResponse.json({ error: "Strategy could not be deleted. Check the audit trail before retrying." }, { status: 503 });
  }
}

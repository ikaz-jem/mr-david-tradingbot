import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { getProductCatalog } from "@/lib/product-catalog";
import { ProductDefinition } from "@/models/ProductDefinition";
import { connectDB } from "@/lib/db";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { consumeAdminMutationLimit } from "@/lib/admin-mutation-limit";
import { writeSecurityAudit } from "@/lib/access-control";

export const runtime = "nodejs";
const input = z.object({ slug: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/), name: z.string().trim().min(3).max(80), description: z.string().trim().min(10).max(300), enabled: z.boolean(), cost: z.number().int().min(1).max(1000), revision: z.number().int().min(0), reason: z.string().trim().min(8).max(300) });
export async function GET() {
  const actor = await workspaceActor();
  if (actor?.organizationKind !== "platform" || !actor.can("products:read")) return NextResponse.json({ error: "Product read permission required." }, { status: 403 });
  return NextResponse.json({ catalog: await getProductCatalog(actor.isDemo), isDemo: actor.isDemo, canUpdate: actor.can("products:update") }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (actor?.organizationKind !== "platform" || !actor.can("products:update")) {
    await writeSecurityAudit({ actor, action: "products.update", resource: "products", targetType: "ProductDefinition", outcome: "denied", reason: "Product update permission required", request }).catch(() => undefined);
    return NextResponse.json({ error: "Product update permission required." }, { status: 403 });
  }
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the product fields, whole-number credit cost, and change reason." }, { status: 400 });
  await connectDB();
  if (!await consumeAdminMutationLimit(actor.id, "products:update")) return NextResponse.json({ error: "Too many catalog changes. Wait one minute and retry." }, { status: 429 });
  const { slug, revision, reason, ...fields } = parsed.data;
  const scope = actor.isDemo ? "demo" : "live";
  try {
    const db = await connectDB();
    let before: unknown = null;
    let after: unknown = null;
    await db.connection.transaction(async session => {
      const existing = await ProductDefinition.findOne({ scope, slug }).session(session);
      if (existing) {
        before = existing.toObject();
        const result = await ProductDefinition.updateOne({ _id: existing._id, revision }, { $set: fields, $inc: { revision: 1 } }, { session });
        if (!result.modifiedCount) throw new Error("CATALOG_CHANGED");
      } else {
        if (await ProductDefinition.countDocuments({ scope }).session(session) >= 20) throw new Error("CATALOG_LIMIT");
        await ProductDefinition.create([{ scope, slug, ...fields }], { session });
      }
      after = await ProductDefinition.findOne({ scope, slug }).session(session).lean();
      await AdminAuditEvent.create([{ actorId: actor.id, targetType: "platform", targetId: `product:${scope}:${slug}`, action: before ? "update_product" : "create_product", before: JSON.stringify(before), after: JSON.stringify(after), reason, status: "applied" }], { session });
    });
    await writeSecurityAudit({ actor, action: "products.update", resource: "products", targetType: "ProductDefinition", targetId: `${scope}:${slug}`, previousValue: before, newValue: after, outcome: "success", reason, request }).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    await writeSecurityAudit({ actor, action: "products.update", resource: "products", targetType: "ProductDefinition", targetId: `${scope}:${slug}`, outcome: "failed", reason, request, metadata: { error: error instanceof Error ? error.message : "unknown" } }).catch(() => undefined);
    if (error instanceof Error && error.message === "CATALOG_CHANGED") return NextResponse.json({ error: "Catalog changed. Refresh before saving." }, { status: 409 });
    if (error instanceof Error && error.message === "CATALOG_LIMIT") return NextResponse.json({ error: "Product catalog limit reached." }, { status: 409 });
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "Product already exists. Refresh the catalog." }, { status: 409 });
    console.error("Product catalog update failed", error);
    return NextResponse.json({ error: "Product could not be saved. Check the audit trail before retrying." }, { status: 503 });
  }
}


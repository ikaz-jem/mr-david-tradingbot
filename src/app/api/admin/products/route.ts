import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { getProductCatalog } from "@/lib/product-catalog";
import { ProductDefinition } from "@/models/ProductDefinition";
const input = z.object({ slug: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/), name: z.string().trim().min(3).max(80), description: z.string().trim().min(10).max(300), enabled: z.boolean(), cost: z.number().int().min(1).max(1000), revision: z.number().int().min(0) });
export async function GET() {
  const actor = await workspaceActor();
  if (actor?.organizationKind !== "platform" || !actor.can("products:read")) return NextResponse.json({ error: "Product read permission required." }, { status: 403 });
  return NextResponse.json({ catalog: await getProductCatalog(actor.isDemo), isDemo: actor.isDemo });
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (actor?.organizationKind !== "platform" || !actor.can("products:update")) return NextResponse.json({ error: "Product update permission required." }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the product fields and use whole numbers for credits." }, { status: 400 });
  const { slug, revision, ...fields } = parsed.data;
  const scope = actor.isDemo ? "demo" : "live";
  const existing = await ProductDefinition.findOne({ scope, slug });
  if (existing) {
    const result = await ProductDefinition.updateOne({ _id: existing._id, revision }, { $set: fields, $inc: { revision: 1 } });
    if (!result.modifiedCount) return NextResponse.json({ error: "Catalog changed. Refresh before saving." }, { status: 409 });
  } else {
    if (await ProductDefinition.countDocuments({ scope }) >= 20) return NextResponse.json({ error: "Product catalog limit reached." }, { status: 409 });
    try { await ProductDefinition.create({ scope, slug, ...fields }); }
    catch { return NextResponse.json({ error: "Product already exists. Refresh the catalog." }, { status: 409 }); }
  }
  return NextResponse.json({ ok: true });
}


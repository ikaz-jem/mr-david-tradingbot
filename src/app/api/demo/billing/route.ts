import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { ensureDemoWorkspace } from "@/lib/demo-workspace";
import { getProductCatalog } from "@/lib/product-catalog";
import { hasMonthlyAccess, membershipPlans, nextMonthlyEnd } from "@/lib/membership-policy";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { notifyUser } from "@/lib/notifications";

export async function GET() {
  const actor = await workspaceActor();
  if (!actor?.isDemo) return NextResponse.json({ error: "Demo accounts only." }, { status: 403 });
  const [workspace, catalog] = await Promise.all([ensureDemoWorkspace(actor.id), getProductCatalog(true)]);
  return NextResponse.json({ workspace: workspace?.toObject({ flattenMaps: true }), catalog, plans: membershipPlans });
}
const input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("monthly"), itemId: z.enum(["starter", "trader", "desk"]), requestId: z.uuid() }),
  z.object({ kind: z.literal("topup"), productId: z.string().min(1).max(80), requestId: z.uuid() }),
  z.object({ kind: z.literal("expire"), requestId: z.uuid() }),
]);
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor?.isDemo) return NextResponse.json({ error: "Demo accounts only." }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid purchase." }, { status: 400 });
  const data = parsed.data;
  const workspace = await ensureDemoWorkspace(actor.id);
  if (!workspace) return NextResponse.json({ error: "Workspace unavailable." }, { status: 503 });
  if (workspace.receipts.some(item => item.requestId === data.requestId)) return NextResponse.json({ ok: true, duplicate: true });
  if (workspace.receipts.length >= 500) return NextResponse.json({ error: "Demo purchase limit reached." }, { status: 409 });
  const now = new Date();
  const catalog = await getProductCatalog(true);
  const fields: Record<string, unknown> = {};
  const increments: Record<string, number> = { revision: 1 };
  const activity: { productId: string; amount: number; note: string; createdAt: Date }[] = [];
  let amount = 0; let credits = 0;
  if (data.kind === "monthly") {
    const plan = membershipPlans.find(item => item.id === data.itemId)!;
    fields.planId = plan.id;
    // Early renewal adds a month to the existing period; it does not discard paid days.
    fields.periodEnd = nextMonthlyEnd(hasMonthlyAccess(workspace.periodEnd) ? workspace.periodEnd : now);
    amount = plan.monthlyPrice;
    for (const product of catalog) {
      const allocation = product[plan.id];
      increments["wallets." + product.slug] = allocation;
      activity.push({ productId: product.slug, amount: allocation, note: "Simulated " + plan.name + " monthly allocation", createdAt: now });
      credits += allocation;
    }
  } else if (data.kind === "topup") {
    if (!hasMonthlyAccess(workspace.periodEnd)) return NextResponse.json({ error: "Renew your membership before adding or using credits." }, { status: 402 });
    const product = catalog.find(item => item.slug === data.productId && item.enabled);
    if (!product) return NextResponse.json({ error: "This product is not available for top-ups." }, { status: 400 });
    amount = product.topupPrice; credits = product.topupCredits;
    increments["wallets." + product.slug] = credits;
    activity.push({ productId: product.slug, amount: credits, note: "Simulated credit top-up", createdAt: now });
  } else fields.periodEnd = new Date(now.getTime() - 1000);
  const result = await DemoWorkspace.updateOne({ _id: workspace._id, revision: workspace.revision }, {
    $set: fields, $inc: increments,
    $push: { receipts: { requestId: data.requestId, kind: data.kind, productId: data.kind === "topup" ? data.productId : "membership", itemId: data.kind === "monthly" ? data.itemId : data.kind, amount, credits, createdAt: now }, activity: { $each: activity, $slice: -200 } },
  });
  if (!result.modifiedCount) return NextResponse.json({ error: "Your wallet changed. Refresh and try again." }, { status: 409 });
  await notifyUser({ userId: actor.id, kind: "billing", title: data.kind === "expire" ? "Demo membership expired" : "Simulated payment confirmed", body: data.kind === "expire" ? "Renew to unlock your preserved credit balances." : "Your demo membership and product balances have been updated. No money was charged.", href: "/dashboard/credits", sourceKey: "demo-payment:" + data.requestId }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}


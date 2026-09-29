import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { ensureProductAccount } from "@/lib/credits";
import { connectDB } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";
import { isSameOrigin } from "@/lib/request-origin";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { CreditEntry } from "@/models/CreditEntry";
import { ProductAccount } from "@/models/ProductAccount";
import { User } from "@/models/User";
import { addCalendarMonth } from "@/lib/billing-period";
import { ensureDemoWorkspace } from "@/lib/demo-workspace";
import { DemoWorkspace } from "@/models/DemoWorkspace";

export const runtime = "nodejs";
const schema = z.object({ targetUserId: z.string().regex(/^[a-f0-9]{24}$/i), action: z.enum(["credit_adjustment", "extend_month"]), amount: z.number().int().min(-500).max(500).optional(), reason: z.string().trim().min(12).max(300) }).refine(value => value.action !== "credit_adjustment" || (value.amount !== undefined && value.amount !== 0));

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid user, action, and reason of at least 12 characters." }, { status: 400 });
  try {
    const db = await connectDB();
    if (session.user.isDemo) {
      const actor = await User.findOne({ _id: session.user.id, role: "admin", status: "active", isDemo: true });
      if (!actor) return NextResponse.json({ error: "Demo admin required." }, { status: 403 });
      const target = await User.findOne({ _id: parsed.data.targetUserId, isDemo: true, status: "active", role: { $ne: "admin" } });
      if (!target) return NextResponse.json({ error: "Choose an active demo customer." }, { status: 403 });
      const workspace = await ensureDemoWorkspace(String(target._id));
      if (!workspace) return NextResponse.json({ error: "Demo workspace unavailable." }, { status: 503 });
      const balance = workspace.wallets.get("signals") ?? 0;
      const amount = parsed.data.action === "credit_adjustment" ? parsed.data.amount! : 0;
      if (balance + amount < 0) return NextResponse.json({ error: "Adjustment would create a negative balance." }, { status: 400 });
      const periodEnd = parsed.data.action === "extend_month" ? addCalendarMonth(new Date(Math.max(Date.now(), workspace.periodEnd.getTime()))) : workspace.periodEnd;
      const audit = await AdminAuditEvent.create({ actorId: actor._id, targetUserId: target._id, targetType: "user", targetId: String(target._id), action: parsed.data.action, before: `${balance}:${workspace.periodEnd.toISOString()}`, after: `${balance + amount}:${periodEnd.toISOString()}`, reason: parsed.data.reason, status: "pending" });
      const result = await DemoWorkspace.updateOne({ _id: workspace._id, revision: workspace.revision }, { $set: { periodEnd }, $inc: { "wallets.signals": amount, revision: 1 }, $push: { activity: { $each: [{ productId: "signals", amount, note: `Admin ${parsed.data.action}: ${parsed.data.reason}`, createdAt: new Date() }], $slice: -200 } } });
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: result.modifiedCount ? "applied" : "failed" } });
      if (!result.modifiedCount) return NextResponse.json({ error: "Account changed. Reload and try again." }, { status: 409 });
      await notifyUser({ userId: String(target._id), kind: "billing", title: "Demo billing updated", body: parsed.data.reason, href: "/dashboard/credits", sourceKey: `demo-adjustment:${audit._id}` }).catch(console.error);
      return NextResponse.json({ ok: true, simulated: true });
    }
    const actor = await User.findOne({ _id: session.user.id, role: "admin", status: "active", isDemo: false }).select("_id").lean();
    if (!actor) return NextResponse.json({ error: "Real admin access required." }, { status: 403 });
    const target = await User.findOne({ _id: parsed.data.targetUserId, status: "active", isDemo: false }).select("_id").lean();
    if (!target || String(target._id) === String(actor._id)) return NextResponse.json({ error: "Choose another active, non-demo account." }, { status: 400 });
    await ensureProductAccount(String(target._id), "signals");
    const operationId = randomUUID();
    await db.connection.transaction(async mongoSession => {
      const account = await ProductAccount.findOne({ userId: target._id, productId: "signals" }).session(mongoSession);
      if (!account) throw new Error("Product account missing");
      const before = `${account.subscriptionStatus}:${account.currentPeriodEnd?.toISOString() ?? "none"}:${account.creditBalance}`;
      if (parsed.data.action === "credit_adjustment") {
        const amount = parsed.data.amount!;
        if (account.creditBalance + amount < 0) throw new Error("Adjustment would create a negative balance");
        account.creditBalance += amount;
        await CreditEntry.create([{ userId: target._id, productId: "signals", amount, kind: "adjustment", sourceKey: `admin:${operationId}`, note: parsed.data.reason }], { session: mongoSession });
      } else {
        const now = new Date();
        const start = account.currentPeriodEnd && account.currentPeriodEnd > now ? account.currentPeriodEnd : now;
        account.subscriptionStatus = "active";
        account.currentPeriodStart = now;
        account.currentPeriodEnd = addCalendarMonth(start);
        account.planId = account.planId ?? "manual";
      }
      await account.save({ session: mongoSession });
      await AdminAuditEvent.create([{ actorId: actor._id, targetUserId: target._id, targetType: "user", targetId: String(target._id), action: parsed.data.action, before, after: `${account.subscriptionStatus}:${account.currentPeriodEnd?.toISOString() ?? "none"}:${account.creditBalance}`, reason: parsed.data.reason, status: "applied" }], { session: mongoSession });
    });
    await notifyUser({ userId: String(target._id), kind: "billing", title: parsed.data.action === "credit_adjustment" ? "Credit balance adjusted" : "Monthly access extended", body: `An Enrivea administrator updated your Trade research account. Reason: ${parsed.data.reason}`, href: "/dashboard/credits", sourceKey: `admin-billing:${operationId}` }).catch(error => console.error("Billing adjustment notification failed", error));
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("Admin billing adjustment failed", error); return NextResponse.json({ error: "Adjustment failed. Check account state and database transaction support before retrying." }, { status: 503 }); }
}

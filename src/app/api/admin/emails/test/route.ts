import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { workspaceActor } from "@/lib/workspace-access";
import { connectDB } from "@/lib/db";
import { hasEmailProvider, sendEmail } from "@/lib/email";
import { isSameOrigin } from "@/lib/request-origin";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { EmailDelivery } from "@/models/EmailDelivery";
import { User } from "@/models/User";
import { DemoEmail } from "@/models/DemoEmail";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const current = await workspaceActor();
  if (!current?.can("emails:update") || current.organizationKind !== "platform") return NextResponse.json({ error: "Email update permission required." }, { status: 403 });
  try {
    await connectDB();
    const demo = current.isDemo ? await User.findOne({ _id: current.id, isDemo: true }).select("email").lean() : null;
    if (demo) {
      await DemoEmail.create({ actorId: demo._id, recipient: demo.email, subject: "Enrivea Signal demo delivery test" });
      return NextResponse.json({ ok: true, simulated: true });
    }
    const actor = await User.findOne({ _id: current.id, isDemo: false, emailVerifiedAt: { $ne: null } }).select("email").lean();
    if (!actor) return NextResponse.json({ error: "Verified real operator account required." }, { status: 403 });
    if (!await hasEmailProvider()) return NextResponse.json({ error: "Resend is not configured." }, { status: 503 });
    const recent = await EmailDelivery.exists({ recipient: actor.email, category: "admin_test", createdAt: { $gt: new Date(Date.now() - 10 * 60_000) } });
    if (recent) return NextResponse.json({ error: "Please wait 10 minutes before another test email." }, { status: 429 });
    const audit = await AdminAuditEvent.create({ actorId: actor._id, targetType: "platform", targetId: "resend", action: "send_test_email", before: "none", after: actor.email, reason: "Admin-initiated delivery test" });
    try {
      await sendEmail({ to: actor.email, category: "admin_test", eventKey: `admin-test:${randomUUID()}`, subject: "Enrivea Signal email delivery test", html: "<p>This is an administrator-initiated Resend delivery test for Enrivea Signal.</p>", text: "This is an administrator-initiated Resend delivery test for Enrivea Signal." });
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "applied" } });
      return NextResponse.json({ ok: true });
    } catch (error) {
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } }).catch(() => undefined);
      throw error;
    }
  } catch (error) { console.error("Admin test email failed", error); return NextResponse.json({ error: "Test email was not accepted. Check Resend configuration and delivery records." }, { status: 503 }); }
}

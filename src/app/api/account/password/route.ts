import { compare, hash } from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-origin";
import { notifyUser } from "@/lib/notifications";
import { passwordChangedEmail, sendEmail } from "@/lib/email";
import { User } from "@/models/User";
import { SecurityAttempt } from "@/models/SecurityAttempt";
import { ensureDemoWorkspace } from "@/lib/demo-workspace";
import { DemoWorkspace } from "@/models/DemoWorkspace";

const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(128) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.currentPassword === parsed.data.newPassword) return NextResponse.json({ error: "Choose a new password of at least 12 characters." }, { status: 400 });
  try {
    await connectDB();
    if (await User.exists({ _id: session.user.id, status: "active", isDemo: true })) {
      await ensureDemoWorkspace(session.user.id);
      const workspace = await DemoWorkspace.findOne({ userId: session.user.id }).select("+passwordHash");
      // The published sample password stays valid so shared visitors cannot lock each other out.
      const valid = parsed.data.currentPassword === "DemoPassword123!" || (workspace?.passwordHash && await compare(parsed.data.currentPassword, workspace.passwordHash));
      if (!valid) return NextResponse.json({ error: "Use the sample password DemoPassword123! or your last saved demo password." }, { status: 400 });
      await DemoWorkspace.updateOne({ userId: session.user.id }, { $set: { passwordHash: await hash(parsed.data.newPassword, 12), passwordChangedAt: new Date() } });
      return NextResponse.json({ ok: true, simulated: true });
    }
    const windowStart = Math.floor(Date.now() / (15 * 60_000));
    const attempts = await SecurityAttempt.findOneAndUpdate({ key: `password:${session.user.id}:${windowStart}` }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((windowStart + 2) * 15 * 60_000) } }, { upsert: true, new: true });
    if (attempts.count > 5) return NextResponse.json({ error: "Too many password attempts. Try again in 15 minutes." }, { status: 429 });
    const user = await User.findOne({ _id: session.user.id, status: "active", isDemo: false }).select("+passwordHash name email authVersion");
    if (!user) return NextResponse.json({ error: "Password changes are unavailable for this account." }, { status: 403 });
    if (!await compare(parsed.data.currentPassword, user.passwordHash)) return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    const passwordHash = await hash(parsed.data.newPassword, 12);
    const updated = await User.findOneAndUpdate({ _id: user._id, authVersion: user.authVersion, passwordHash: user.passwordHash }, { $set: { passwordHash, mustChangePassword: false, lastPasswordChangedAt: new Date() }, $inc: { authVersion: 1 } }, { new: true });
    if (!updated) return NextResponse.json({ error: "Account changed while saving. Please try again." }, { status: 409 });
    await notifyUser({ userId: user.id, kind: "account", title: "Password changed", body: "Your password was updated. All existing sessions have been signed out.", href: "/login", sourceKey: `password:${user.id}:${updated.authVersion}` }).catch(error => console.error("Password notification failed", error));
    const template = passwordChangedEmail(user.name);
    await sendEmail({ to: user.email, category: "password_changed", eventKey: `password_changed:${user.id}:${updated.authVersion}`, ...template }).catch(error => console.error("Password email failed", error));
    return NextResponse.json({ ok: true });
  } catch (error) { console.error("Password update failed", error); return NextResponse.json({ error: "Could not change your password." }, { status: 503 }); }
}

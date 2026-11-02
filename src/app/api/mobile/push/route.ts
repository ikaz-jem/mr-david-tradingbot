import { NextResponse } from "next/server";
import { z } from "zod";
import { mobileActor } from "@/lib/mobile-auth";
import { writeSecurityAudit } from "@/lib/access-control";
import { PushDevice } from "@/models/PushDevice";
import { SecurityAttempt } from "@/models/SecurityAttempt";

export const runtime = "nodejs";
const schema = z.object({ token: z.string().regex(/^ExponentPushToken\[[A-Za-z0-9_-]+\]$|^ExpoPushToken\[[A-Za-z0-9_-]+\]$/), platform: z.enum(["ios", "android"]) });

export async function POST(request: Request) {
  const actor = await mobileActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid push token." }, { status: 400 });
  const bucket = Math.floor(Date.now() / 60_000);
  const attempt = await SecurityAttempt.findOneAndUpdate({ key: `push-register:${actor.user._id}:${bucket}` }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 60_000) } }, { upsert: true, returnDocument: "after" });
  if ((attempt?.count ?? 0) > 5) return NextResponse.json({ error: "Too many device changes. Try again shortly." }, { status: 429 });
  await PushDevice.init();
  const existing = await PushDevice.findOne({ token: parsed.data.token });
  if (existing && String(existing.userId) !== String(actor.user._id) && existing.status === "active") return NextResponse.json({ error: "This device is already registered to another account." }, { status: 409 });
  await PushDevice.updateOne({ token: parsed.data.token }, { $set: { userId: actor.user._id, sessionId: actor.mobileSession.sessionId, platform: parsed.data.platform, status: "active", lastRegisteredAt: new Date() } }, { upsert: true });
  await writeSecurityAudit({ actor: actor.access, action: "notifications.push_device.register", resource: "notifications", targetType: "device", targetId: parsed.data.platform, outcome: "success", request }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const actor = await mobileActor(request);
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await PushDevice.updateMany({ userId: actor.user._id, sessionId: actor.mobileSession.sessionId }, { $set: { status: "revoked" } });
  await writeSecurityAudit({ actor: actor.access, action: "notifications.push_device.unregister", resource: "notifications", targetType: "session", targetId: actor.mobileSession.sessionId, outcome: "success", request }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

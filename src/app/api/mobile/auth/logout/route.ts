import { NextResponse } from "next/server";
import { mobileActor } from "@/lib/mobile-auth";
import { writeSecurityAudit } from "@/lib/access-control";
import { MobileSession } from "@/models/MobileSession";
import { UserSession } from "@/models/UserSession";
import { PushDevice } from "@/models/PushDevice";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const actor = await mobileActor(request);
  if (!actor) return NextResponse.json({ ok: true });
  const now = new Date();
  const sessionId = actor.mobileSession.sessionId;
  await Promise.all([
    MobileSession.updateOne({ _id: actor.mobileSession._id }, { $set: { status: "revoked" } }),
    UserSession.updateOne({ sessionId }, { $set: { status: "revoked", revokedAt: now } }),
    PushDevice.updateMany({ userId: actor.user._id, sessionId }, { $set: { status: "revoked" } }),
  ]);
  await writeSecurityAudit({ actor: actor.access, action: "authentication.mobile_logout", resource: "sessions", targetType: "session", targetId: sessionId, outcome: "success", request }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

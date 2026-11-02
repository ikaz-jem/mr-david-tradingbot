import { NextResponse } from "next/server";
import { mobileActor } from "@/lib/mobile-auth";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const actor = await mobileActor(request);
  if (!actor) return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
  const { user } = actor;
  return NextResponse.json({ user: { id: String(user._id), name: user.name, email: user.email, isDemo: user.isDemo, mustChangePassword: user.mustChangePassword }, expiresAt: actor.mobileSession.expiresAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

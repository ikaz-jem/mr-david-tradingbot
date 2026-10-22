import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin } from "@/lib/request-origin";
import { completeEmailChange, EmailChangeError } from "@/lib/email-change";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const input = z.object({ token: z.string().min(32).max(128) }).safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid confirmation link." }, { status: 400 });
  try { await completeEmailChange(input.data.token); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof EmailChangeError ? error.message : "Email change could not be completed. Request a new link or contact support." }, { status: error instanceof EmailChangeError ? 400 : 409 }); }
}

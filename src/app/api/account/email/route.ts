import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { consumeAdminMutationLimit } from "@/lib/admin-mutation-limit";
import { EmailChangeError, requestEmailChange } from "@/lib/email-change";

const schema = z.object({ email: z.email().max(254).transform(value => value.toLowerCase()), password: z.string().min(1).max(128) });
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (actor.isDemo) return NextResponse.json({ error: "Shared demo accounts keep their demo email. Email changes are available on your own account." }, { status: 403 });
  if (!await consumeAdminMutationLimit(actor.id, "email:change", 3, 15 * 60_000)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Enter a valid email and your current password." }, { status: 400 });
  try {
    await requestEmailChange(actor.id, input.data.email, input.data.password, request);
    return NextResponse.json({ ok: true, message: "Check your new inbox for the confirmation link. Your current email still works until you confirm." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof EmailChangeError ? error.message : "The confirmation could not be sent. Your sign-in email has not changed." }, { status: error instanceof EmailChangeError ? 400 : 503 });
  }
}

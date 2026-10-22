import { compare } from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-origin";
import { User } from "@/models/User";
import { AccountClosureConflict, closeOwnedAccount } from "@/lib/account-closure";
import { consumeAdminMutationLimit } from "@/lib/admin-mutation-limit";

const schema = z.object({ password: z.string().min(1).max(128), confirmation: z.literal("CLOSE") });

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your password and type CLOSE exactly." }, { status: 400 });
  if (session.user.isDemo) return NextResponse.json({ ok: true, simulated: true });
  try {
    await connectDB();
    if (!await consumeAdminMutationLimit(session.user.id, "account:close", 5, 15 * 60_000)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    const user = await User.findOne({ _id: session.user.id, status: "active", isDemo: false }).select("+passwordHash authVersion");
    if (!user || !await compare(parsed.data.password, user.passwordHash)) return NextResponse.json({ error: "Password is incorrect." }, { status: 400 });
    await closeOwnedAccount(session.user.id, user.authVersion, request);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AccountClosureConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Account closure failed", error);
    return NextResponse.json({ error: "Could not close the account. Contact support if this continues." }, { status: 503 });
  }
}

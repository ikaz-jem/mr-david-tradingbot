import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-origin";
import { User } from "@/models/User";

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await connectDB();
  if (session.user.isDemo) return NextResponse.json({ ok: true, simulated: true });
  const result = await User.updateOne({ _id: session.user.id, status: "active" }, { $inc: { authVersion: 1 } });
  if (!result.modifiedCount) return NextResponse.json({ error: "Sessions could not be revoked." }, { status: 409 });
  return NextResponse.json({ ok: true });
}

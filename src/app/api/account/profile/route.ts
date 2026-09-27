import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-origin";
import { User } from "@/models/User";

const schema = z.object({ name: z.string().trim().min(2).max(100) });

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a name between 2 and 100 characters." }, { status: 400 });
  try {
    await connectDB();
    const user = await User.findOneAndUpdate({ _id: session.user.id, status: "active", isDemo: false }, { $set: { name: parsed.data.name } }, { new: true }).select("name").lean();
    if (!user) return NextResponse.json({ error: "Profile changes are unavailable for this account." }, { status: 403 });
    return NextResponse.json({ ok: true, name: user.name });
  } catch (error) { console.error("Profile update failed", error); return NextResponse.json({ error: "Could not update your profile." }, { status: 503 }); }
}

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-origin";
import { Notification } from "@/models/Notification";

const schema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i).optional(), all: z.boolean().optional() }).refine(value => Boolean(value.id) !== Boolean(value.all));

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a notification or mark all as read." }, { status: 400 });
  try {
    await connectDB();
    const filter = { userId: session.user.id, readAt: null, ...(parsed.data.id ? { _id: parsed.data.id } : {}) };
    const result = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
    return NextResponse.json({ ok: true, updated: result.modifiedCount });
  } catch (error) { console.error("Notification update failed", error); return NextResponse.json({ error: "Could not update notifications." }, { status: 503 }); }
}

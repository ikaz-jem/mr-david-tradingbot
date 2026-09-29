import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { User } from "@/models/User";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor || actor.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { id } = await params;
  const input = z.object({ reason: z.string().trim().min(12).max(300) }).safeParse(await request.json().catch(() => null));
  if (!input.success || !mongoose.isObjectIdOrHexString(id)) return NextResponse.json({ error: "Provide a reason of at least 12 characters." }, { status: 400 });
  const target = await User.findById(id).select("name isDemo role").lean();
  if (!target || target.role === "admin" || (actor.isDemo && !target.isDemo)) return NextResponse.json({ error: "Account unavailable." }, { status: 404 });
  const audit = await AdminAuditEvent.create({ actorId: actor.id, targetUserId: id, targetType: "user", targetId: id, action: "view_as_user", before: "administrator", after: "read-only customer preview for 15 minutes", reason: input.data.reason, status: "applied" });
  return NextResponse.json({ url: "/admin/users/" + id + "/preview?audit=" + audit.id });
}

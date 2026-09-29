import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { notifyUser } from "@/lib/notifications";
import { SupportTicket } from "@/models/SupportTicket";

const input = z.object({
  revision: z.number().int().min(0),
  body: z.string().trim().min(1).max(4000).optional(),
  internal: z.boolean().default(false),
  status: z.enum(["open", "in_progress", "waiting", "resolved", "closed"]).optional(),
  priority: z.enum(["normal", "high", "urgent"]).optional(),
  assignToMe: z.boolean().optional(),
}).refine(value => value.body || value.status || value.priority || value.assignToMe !== undefined);
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  if (!mongoose.isObjectIdOrHexString(id)) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  const staff = actor.role !== "user" && new URL(request.url).searchParams.get("view") === "staff";
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid ticket update." }, { status: 400 });
  const data = parsed.data;
  if (!staff && (data.internal || data.priority || data.assignToMe !== undefined || (data.status && !["open", "closed"].includes(data.status)))) return NextResponse.json({ error: "This action requires support access." }, { status: 403 });
  const ticket = await SupportTicket.findOne({ _id: id, isDemo: actor.isDemo, ...(staff ? {} : { userId: actor.id }) });
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  if (ticket.messages.length >= 500) return NextResponse.json({ error: "This conversation is full. Please open a new ticket." }, { status: 409 });
  const fields: Record<string, unknown> = {};
  if (data.status) fields.status = data.status;
  else if (data.body && !data.internal) fields.status = staff ? "waiting" : "open";
  if (data.priority) fields.priority = data.priority;
  if (data.assignToMe !== undefined) { fields.assignedTo = data.assignToMe ? actor.id : null; fields.assignedName = data.assignToMe ? actor.name : ""; }
  const result = await SupportTicket.updateOne({ _id: id, revision: data.revision }, {
    $set: fields, $inc: { revision: 1 },
    ...(data.body ? { $push: { messages: { authorId: actor.id, authorName: actor.name, staff, internal: data.internal, body: data.body, createdAt: new Date() } } } : {}),
  });
  if (!result.modifiedCount) return NextResponse.json({ error: "This ticket changed. Refresh the inbox before retrying." }, { status: 409 });
  if (staff && !data.internal) await notifyUser({ userId: String(ticket.userId), kind: "system", title: "Support ticket updated", body: ticket.subject, href: "/dashboard/support", sourceKey: `support:${id}:${data.revision + 1}` }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}


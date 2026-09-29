import { NextResponse } from "next/server";
import { z } from "zod";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { SupportTicket } from "@/models/SupportTicket";

const input = z.object({ subject: z.string().trim().min(5).max(160), category: z.enum(["account", "billing", "research", "exchange", "other"]), body: z.string().trim().min(10).max(4000) });
export async function GET(request: Request) {
  const actor = await workspaceActor();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const staff = new URL(request.url).searchParams.get("view") === "staff" && actor.role !== "user";
  const tickets = await SupportTicket.find({ isDemo: actor.isDemo, ...(staff ? {} : { userId: actor.id }) }).sort({ updatedAt: -1 }).limit(100).lean();
  return NextResponse.json({ tickets: tickets.map(ticket => ({ ...ticket, messages: ticket.messages.filter(message => staff || !message.internal) })), actorId: actor.id });
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const actor = await workspaceActor();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add a subject (5–160 characters) and message (10–4,000 characters)." }, { status: 400 });
  const recent = await SupportTicket.countDocuments({ userId: actor.id, createdAt: { $gt: new Date(Date.now() - 3600000) } });
  if (recent >= 5) return NextResponse.json({ error: "You can open up to five tickets per hour. Please reply to an existing ticket." }, { status: 429 });
  const ticket = await SupportTicket.create({ userId: actor.id, isDemo: actor.isDemo, subject: parsed.data.subject, category: parsed.data.category, messages: [{ authorId: actor.id, authorName: actor.name, body: parsed.data.body }] });
  return NextResponse.json({ id: String(ticket._id) }, { status: 201 });
}


import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-origin";
import { encryptServiceSecret, getServiceConfigStatus, secretFields, serviceEncryptionReady, textFields } from "@/lib/service-config";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { ServiceConfig } from "@/models/ServiceConfig";
import { User } from "@/models/User";

export const runtime = "nodejs";
const fields = [...secretFields, ...textFields] as const;
const input = z.object({ field: z.enum(fields), action: z.enum(["set", "clear"]), value: z.string().max(500).optional(), reason: z.string().trim().min(8).max(300) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a supported setting and provide an audit reason of at least 8 characters." }, { status: 400 });
  const { field, action, reason } = parsed.data;
  const value = parsed.data.value?.trim() ?? "";
  const secret = secretFields.some(item => item === field);
  if (action === "set" && (secret ? value.length < 20 : !value || value.length > 160)) return NextResponse.json({ error: secret ? "Enter a complete provider credential (at least 20 characters)." : "Enter a valid setting value." }, { status: 400 });
  if (action === "set" && (field === "resendFromEmail" || field === "resendSupportEmail") && !/^(?:[^<>\r\n]{1,80}\s*<)?[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}>?$/.test(value)) return NextResponse.json({ error: "Enter a valid email address or sender name with an email address." }, { status: 400 });
  if (action === "set" && field === "openaiModel" && !/^[A-Za-z0-9._-]{2,100}$/.test(value)) return NextResponse.json({ error: "Enter a valid model identifier." }, { status: 400 });
  if (!serviceEncryptionReady()) return NextResponse.json({ error: "A strong NEXTAUTH_SECRET must be set at deployment before credentials can be stored." }, { status: 503 });
  try {
    await connectDB();
    const actor = await User.findOne({ _id: session.user.id, role: "admin", status: "active" }).select("_id isDemo").lean();
    if (!actor) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const key = actor.isDemo ? "demo" : "global";
    await ServiceConfig.updateOne({ key }, { $setOnInsert: { key } }, { upsert: true });
    const current = await ServiceConfig.findOne({ key }).lean();
    if (!current) throw new Error("Service config missing");
    const storedField = secret ? `${field}Encrypted` : field;
    const before = String(current[storedField as keyof typeof current] ?? "");
    const next = action === "clear" ? "" : secret ? encryptServiceSecret(value, field as (typeof secretFields)[number]) : value;
    const audit = await AdminAuditEvent.create({ actorId: actor._id, targetType: "platform", targetId: "service-config", action: `${action}_${field}`, before: before ? "dashboard override present" : "no dashboard override", after: next ? "dashboard override present" : "dashboard override removed", reason });
    try {
      const updated = await ServiceConfig.updateOne({ _id: current._id, updatedAt: current.updatedAt }, { $set: { [storedField]: next } });
      if (updated.modifiedCount !== 1) {
        await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } });
        return NextResponse.json({ error: "Configuration changed concurrently. Refresh and retry." }, { status: 409 });
      }
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "applied" } });
      return NextResponse.json({ ok: true, status: await getServiceConfigStatus(Boolean(actor.isDemo)) }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      await AdminAuditEvent.updateOne({ _id: audit._id }, { $set: { status: "failed" } }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error("Service configuration update failed", error);
    return NextResponse.json({ error: "Configuration could not be saved. Check the audit trail and retry." }, { status: 503 });
  }
}

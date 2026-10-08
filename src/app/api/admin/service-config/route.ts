import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { workspaceActor } from "@/lib/workspace-access";
import { isSameOrigin } from "@/lib/request-origin";
import { encryptServiceSecret, getServiceConfig, getServiceConfigStatus, secretFields, serviceEncryptionReady, textFields } from "@/lib/service-config";
import { describeOpenAIModel, fallbackOpenAIModels, isSupportedResearchModel } from "@/lib/openai-model-catalog";
import { AdminAuditEvent } from "@/models/AdminAuditEvent";
import { ServiceConfig } from "@/models/ServiceConfig";
import { OpenAIProviderHealthError, verifyOpenAIProvider } from "@/lib/openai-provider-health";

export const runtime = "nodejs";
const fields = [...secretFields, ...textFields] as const;
const input = z.object({ field: z.enum(fields), action: z.enum(["set", "clear"]), value: z.string().max(500).optional(), reason: z.string().trim().min(8).max(300) });
class OpenAIModelDiscoveryError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`OpenAI returned ${status}`);
    this.status = status;
  }
}

async function adminActor(permission: "settings:read" | "settings:update") {
  const actor = await workspaceActor();
  return actor?.organizationKind === "platform" && actor.can(permission) ? actor : null;
}

export async function GET() {
  const actor = await adminActor("settings:read");
  if (!actor) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const service = await getServiceConfig(Boolean(actor.isDemo));
  if (!service.openaiApiKey) return NextResponse.json({ models: fallbackOpenAIModels, source: "curated", notice: "Save an OpenAI API key to load the models available to this API project." }, { headers: { "Cache-Control": "no-store" } });
  try {
    const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${service.openaiApiKey}` }, signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!response.ok) throw new OpenAIModelDiscoveryError(response.status);
    const body = await response.json() as { data?: { id?: string }[] };
    const ids = [...new Set((body.data ?? []).map((model) => model.id ?? "").filter(isSupportedResearchModel))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (service.openaiModel && !ids.includes(service.openaiModel)) ids.unshift(service.openaiModel);
    const models = ids.map(describeOpenAIModel);
    if (!models.length) throw new Error("No compatible response models returned");
    return NextResponse.json({ models, source: "openai", notice: "Models available to the configured OpenAI API project." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.warn("OpenAI model discovery failed", error instanceof Error ? error.message : error);
    const models = service.openaiModel && !fallbackOpenAIModels.some((model) => model.id === service.openaiModel) ? [describeOpenAIModel(service.openaiModel), ...fallbackOpenAIModels] : fallbackOpenAIModels;
    const notice = error instanceof OpenAIModelDiscoveryError && (error.status === 401 || error.status === 403) ? "OpenAI rejected the configured API key. Check the key and project permissions; showing the curated compatible list." : "OpenAI model discovery is temporarily unavailable. Showing the curated compatible list.";
    return NextResponse.json({ models, source: "curated", notice }, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
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
    const actor = await adminActor("settings:update");
    if (!actor) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const key = actor.isDemo ? "demo" : "global";
    let verifiedModels: string[] | null = null;
    if (field === "openaiApiKey" && action === "set") verifiedModels = await verifyOpenAIProvider(value);
    await ServiceConfig.updateOne({ key }, { $setOnInsert: { key } }, { upsert: true });
    const current = await ServiceConfig.findOne({ key }).lean();
    if (!current) throw new Error("Service config missing");
    const storedField = secret ? `${field}Encrypted` : field;
    const before = String(current[storedField as keyof typeof current] ?? "");
    const next = action === "clear" ? "" : secret ? encryptServiceSecret(value, field as (typeof secretFields)[number]) : value;
    if (field === "openaiModel" && action === "set") {
      const available = await verifyOpenAIProvider((await getServiceConfig(Boolean(actor.isDemo))).openaiApiKey);
      if (!available.includes(value)) return NextResponse.json({ error: "The selected model is not available to the configured OpenAI project." }, { status: 400 });
    }
    const audit = await AdminAuditEvent.create({ actorId: actor.id, targetType: "platform", targetId: "service-config", action: `${action}_${field}`, before: before ? "dashboard override present" : "no dashboard override", after: next ? "dashboard override present" : "dashboard override removed", reason });
    try {
      const health = field === "openaiApiKey" ? { openaiVerifiedAt: action === "set" ? new Date() : null, openaiLastError: "" } : {};
      const model = verifiedModels && current.openaiModel && !verifiedModels.includes(current.openaiModel) ? { openaiModel: "" } : {};
      const updated = await ServiceConfig.updateOne({ _id: current._id, updatedAt: current.updatedAt }, { $set: { [storedField]: next, ...health, ...model } });
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
    if (error instanceof OpenAIProviderHealthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Service configuration update failed", error);
    return NextResponse.json({ error: "Configuration could not be saved. Check the audit trail and retry." }, { status: 503 });
  }
}

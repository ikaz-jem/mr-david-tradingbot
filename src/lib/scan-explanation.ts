import "server-only";
import { z } from "zod";
import { getServiceConfig, recordOpenAIHealth } from "@/lib/service-config";
import type { analyzeCandles } from "@/lib/scanner";
import { enforceResearchDecision } from "@/lib/scan-ai-policy";

const narrativeSchema = z.object({
  decision: z.enum(["publish", "no_setup"]),
  confidence: z.number().int().min(0).max(100),
  summary: z.string().min(20).max(500),
  thesis: z.string().min(20).max(1200),
  riskNote: z.string().min(20).max(800),
});

export async function evaluateSetup(symbol: string, analysis: ReturnType<typeof analyzeCandles>, interval = "4h", settings?: Awaited<ReturnType<typeof getServiceConfig>>, strategy?: { requestedSlug: string; selectedSlug: string; selectedName: string; version: number }) {
  const service = settings ?? await getServiceConfig();
  if (!service.openaiApiKey || !service.openaiModel) throw new Error("AI provider is not configured");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", signal: AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${service.openaiApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: service.openaiModel,
      store: false,
      input: [{ role: "system", content: "You are the bounded research decision layer for a directional crypto scanner using Spot candles. Evaluate the server-selected long or short candidate using only the supplied closed-candle facts and approved strategy metadata. Never invent prices, indicators, news, probabilities, performance, institutional intent, or execution claims. The server controls strategy eligibility, direction, and all numeric trade levels. Return publish only when deterministicEligible is true and the evidence is internally consistent; otherwise return no_setup. Confidence measures confidence in the decision itself, not trade probability or probability of profit. A high-confidence no_setup means the supplied evidence strongly supports staying out. Be concise, cautious, and explicit about invalidation. This is research, not investment advice." }, { role: "user", content: JSON.stringify({ symbol, timeframe: interval, strategy, deterministicEligible: analysis.hasSetup, candidateSide: analysis.setupSide, proposedLevels: { entry: analysis.entry, stop: analysis.stop, target: analysis.target }, facts: analysis.facts, deterministicSummary: analysis.summary, dataCutoff: analysis.dataCutoff.toISOString() }) }],
      text: { format: { type: "json_schema", name: "trade_research_decision", strict: true, schema: { type: "object", additionalProperties: false, properties: { decision: { type: "string", enum: ["publish", "no_setup"] }, confidence: { type: "integer", minimum: 0, maximum: 100 }, summary: { type: "string" }, thesis: { type: "string" }, riskNote: { type: "string" } }, required: ["decision", "confidence", "summary", "thesis", "riskNote"] } } },
    }),
  });
  if (!response.ok) {
    await recordOpenAIHealth(service.scope, `OpenAI request rejected (${response.status}).`).catch(() => undefined);
    throw new Error(`AI provider unavailable (${response.status})`);
  }
  const body = await response.json();
  const outputText = body.output?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content ?? []).find((item: { type: string }) => item.type === "output_text")?.text;
  if (body.status !== "completed" || !outputText) throw new Error("AI analysis was incomplete");
  const evaluation = narrativeSchema.parse(JSON.parse(outputText));
  await recordOpenAIHealth(service.scope).catch(() => undefined);
  return {
    ...evaluation,
    decision: enforceResearchDecision(analysis.hasSetup, evaluation.decision),
    providerResponseId: typeof body.id === "string" ? body.id : "",
    inputTokens: Number(body.usage?.input_tokens ?? 0),
    outputTokens: Number(body.usage?.output_tokens ?? 0),
  };
}

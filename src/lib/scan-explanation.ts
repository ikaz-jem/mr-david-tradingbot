import "server-only";
import { z } from "zod";
import { getServiceConfig } from "@/lib/service-config";
import type { analyzeCandles } from "@/lib/scanner";

const narrativeSchema = z.object({ thesis: z.string().min(20).max(1200), riskNote: z.string().min(20).max(800) });

export async function explainSetup(symbol: string, analysis: ReturnType<typeof analyzeCandles>, interval = "4h", settings?: Awaited<ReturnType<typeof getServiceConfig>>) {
  const service = settings ?? await getServiceConfig();
  if (!service.openaiApiKey || !service.openaiModel) throw new Error("AI provider is not configured");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", signal: AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${service.openaiApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: service.openaiModel,
      store: false,
      input: [{ role: "system", content: "You write concise, cautious crypto market research. Use only supplied facts. Do not invent market data, probabilities, performance claims, or numeric trade levels. State uncertainty; this is not investment advice." }, { role: "user", content: JSON.stringify({ symbol, timeframe: interval, facts: analysis.facts, dataCutoff: analysis.dataCutoff.toISOString() }) }],
      text: { format: { type: "json_schema", name: "trade_research", strict: true, schema: { type: "object", additionalProperties: false, properties: { thesis: { type: "string" }, riskNote: { type: "string" } }, required: ["thesis", "riskNote"] } } },
    }),
  });
  if (!response.ok) throw new Error(`AI provider unavailable (${response.status})`);
  const body = await response.json();
  const outputText = body.output?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content ?? []).find((item: { type: string }) => item.type === "output_text")?.text;
  if (body.status !== "completed" || !outputText) throw new Error("AI analysis was incomplete");
  return narrativeSchema.parse(JSON.parse(outputText));
}

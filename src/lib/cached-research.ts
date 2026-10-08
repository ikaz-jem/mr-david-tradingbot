import "server-only";
import { createHash } from "node:crypto";
import { connectDB } from "@/lib/db";
import { evaluateSetup } from "@/lib/scan-explanation";
import { analyzeCandles, getClosedCandles, type ScanCandle } from "@/lib/scanner";
import type { ScanInterval } from "@/lib/scan-markets";
import type { getServiceConfig } from "@/lib/service-config";
import { ResearchCache } from "@/models/ResearchCache";

const CACHE_TTL_MS = 5 * 60 * 1000;
const DECISION_POLICY_VERSION = "directional-v1";
const pending = new Map<string, Promise<unknown>>();

type Evaluation = Awaited<ReturnType<typeof evaluateSetup>>;

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function readCache<T>(key: string): Promise<T | null> {
  await connectDB();
  const record = await ResearchCache.findOne({ key, expiresAt: { $gt: new Date() } }).select("payload").lean();
  return record ? record.payload as T : null;
}

async function storeCache<T>(key: string, kind: "candles" | "decision", payload: T) {
  await ResearchCache.findOneAndUpdate(
    { key },
    { $set: { kind, payload, expiresAt: new Date(Date.now() + CACHE_TTL_MS) } },
    { upsert: true, returnDocument: "after" },
  );
}

async function singleFlight<T>(key: string, producer: () => Promise<T>): Promise<T> {
  const existing = pending.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = producer().finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}

export async function getSharedClosedCandles(symbol: Parameters<typeof getClosedCandles>[0], interval: ScanInterval) {
  const key = `candles:${symbol}:${interval}`;
  const cached = await readCache<ScanCandle[]>(key);
  if (cached) return { candles: cached, cacheHit: true };
  const candles = await singleFlight(key, async () => {
    const secondCheck = await readCache<ScanCandle[]>(key);
    if (secondCheck) return secondCheck;
    const fresh = await getClosedCandles(symbol, interval);
    await storeCache(key, "candles", fresh);
    return fresh;
  });
  return { candles, cacheHit: false };
}

export async function getSharedResearchDecision(
  symbol: string,
  interval: ScanInterval,
  analysis: ReturnType<typeof analyzeCandles>,
  service: Awaited<ReturnType<typeof getServiceConfig>>,
  strategy: { requestedSlug: string; selectedSlug: string; selectedName: string; version: number },
) {
  const key = `decision:${digest({ policy: DECISION_POLICY_VERSION, symbol, interval, strategy, dataCutoff: analysis.dataCutoff.toISOString(), facts: analysis.facts, side: analysis.setupSide, model: service.openaiModel })}`;
  const cached = await readCache<Evaluation>(key);
  if (cached) return { evaluation: cached, cacheHit: true };
  const evaluation = await singleFlight(key, async () => {
    const secondCheck = await readCache<Evaluation>(key);
    if (secondCheck) return secondCheck;
    const fresh = await evaluateSetup(symbol, analysis, interval, service, strategy);
    await storeCache(key, "decision", fresh);
    return fresh;
  });
  return { evaluation, cacheHit: false };
}

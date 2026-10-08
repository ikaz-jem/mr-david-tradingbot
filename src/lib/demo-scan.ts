import "server-only";
import { getPlatformConfig } from "@/lib/platform-config";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { ensureDemoWorkspace } from "@/lib/demo-workspace";
import { getProductCatalog } from "@/lib/product-catalog";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { Signal } from "@/models/Signal";
import { ScanRun } from "@/models/ScanRun";
import type { ScanInterval } from "@/lib/scan-markets";
import { getSharedClosedCandles, getSharedResearchDecision } from "@/lib/cached-research";
import { getServiceConfig } from "@/lib/service-config";
import { getEnabledStrategies } from "@/lib/strategy-catalog";
import { resolveStrategySelection } from "@/lib/strategy-selection";

export async function runDemoScan(userId: string, symbol: string, interval: ScanInterval, strategySlug: string, requestId: string) {
  const [config, service, strategies] = await Promise.all([getPlatformConfig(true), getServiceConfig(true), getEnabledStrategies(true, "signals")]);
  if (config.maintenanceMode) return NextResponse.json({ error: config.maintenanceMessage }, { status: 503 });
  if (!config.scansOpen || !config.allowedScanSymbols.includes(symbol)) return NextResponse.json({ error: config.scansPausedMessage }, { status: 503 });
  if (!service.openaiApiKey || !service.openaiModel) return NextResponse.json({ error: "Complete the AI provider configuration in Platform controls before running research." }, { status: 503 });
  if (!strategies.some(item => item.slug === strategySlug)) return NextResponse.json({ error: "Choose an available research strategy and try again." }, { status: 400 });
  const workspace = await ensureDemoWorkspace(userId);
  if (!workspace) return NextResponse.json({ error: "Demo workspace unavailable." }, { status: 503 });
  const product = (await getProductCatalog(true)).find(item => item.slug === "signals");
  if (!product?.enabled) return NextResponse.json({ error: "The scanner is paused in the demo catalog." }, { status: 503 });
  const previous = workspace.receipts.find(item => item.requestId === requestId);
  if (previous && (previous.kind !== "scan" || previous.itemId !== symbol + ":" + interval + ":" + strategySlug)) return NextResponse.json({ error: "Request ID was already used for another action." }, { status: 409 });
  const existing = await ScanRun.findOne({ userId, requestId }).lean();
  if (previous || existing) {
    if (previous && existing?.status === "completed") return NextResponse.json({ outcome: existing.outcome, side: existing.setupSide ?? null, summary: existing.summary, confidence: existing.aiConfidence, sharedResult: existing.aiCacheHit, signalId: existing.signalId?.toString() ?? null, balance: workspace.creditBalance, cost: Math.abs(previous.credits ?? product.cost) });
    return NextResponse.json({ error: existing?.status === "failed" ? "This AI scan failed. Start a new scan to retry." : "This AI scan request is already being processed." }, { status: 409 });
  }
  if (!workspace.activatedAt) return NextResponse.json({ error: "Activate the demo account to unlock platform products." }, { status: 402 });
  if (workspace.creditBalance < product.cost) return NextResponse.json({ error: "Not enough platform credits. Add credits from Billing." }, { status: 402 });
  if (workspace.receipts.length >= 500) return NextResponse.json({ error: "Demo activity limit reached." }, { status: 409 });
  if (await ScanRun.exists({ userId, status: "running", createdAt: { $gt: new Date(Date.now() - 60_000) } })) return NextResponse.json({ error: "An AI scan is already running. Wait for it to finish." }, { status: 429 });
  const run = await ScanRun.create({ userId, requestId, symbol, interval, requestedStrategySlug: strategySlug, creditCost: product.cost });
  let charged = false;
  let signalId: mongoose.Types.ObjectId | null = null;
  try {
    const { candles, cacheHit: marketCacheHit } = await getSharedClosedCandles(symbol as Parameters<typeof getSharedClosedCandles>[0], interval);
    const selection = resolveStrategySelection(candles, strategySlug, strategies);
    const { analysis } = selection;
    const strategy = { requestedSlug: selection.requested.slug, selectedSlug: selection.selected.slug, selectedName: selection.selected.name, version: selection.selected.version };
    const { evaluation, cacheHit: aiCacheHit } = await getSharedResearchDecision(symbol, interval, analysis, service, strategy);
    const setupSide = analysis.setupSide;
    const publish = evaluation.decision === "publish" && setupSide !== null;
    const debited = await DemoWorkspace.findOneAndUpdate({ _id: workspace._id, activatedAt: { $ne: null }, creditBalance: { $gte: product.cost }, "receipts.requestId": { $ne: requestId } }, {
      $inc: { creditBalance: -product.cost, revision: 1 },
      $push: { receipts: { requestId, kind: "scan", productId: "signals", itemId: symbol + ":" + interval + ":" + strategySlug, amount: 0, credits: -product.cost, createdAt: new Date() }, activity: { $each: [{ productId: "signals", amount: -product.cost, note: symbol + " " + interval + " " + strategy.selectedName + " research", createdAt: new Date() }], $slice: -200 } },
    }, { new: true });
    if (!debited) throw new Error("The demo wallet changed before capture");
    charged = true;
    if (publish) {
      signalId = new mongoose.Types.ObjectId(createHash("sha256").update(userId + ":" + requestId).digest("hex").slice(0, 24));
      await Signal.create({ _id: signalId, userId, symbol, interval, requestedStrategySlug: strategy.requestedSlug, strategySlug: strategy.selectedSlug, strategyVersion: strategy.version, side: setupSide, status: "watch", entry: analysis.entry, stop: analysis.stop, target: analysis.target, thesis: evaluation.thesis, riskNote: evaluation.riskNote, confidence: evaluation.confidence, modelVersion: service.openaiModel, providerResponseId: evaluation.providerResponseId, marketFacts: analysis.facts, dataCutoff: analysis.dataCutoff, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), analysisCost: product.cost });
    }
    await ScanRun.updateOne({ _id: run._id }, { $set: { status: "completed", outcome: publish ? "setup" : "no_setup", setupSide: publish ? setupSide : null, requestedStrategySlug: strategy.requestedSlug, strategySlug: strategy.selectedSlug, strategyVersion: strategy.version, summary: evaluation.summary, modelVersion: service.openaiModel, providerResponseId: evaluation.providerResponseId, aiDecision: evaluation.decision, aiConfidence: evaluation.confidence, inputTokens: aiCacheHit ? 0 : evaluation.inputTokens, outputTokens: aiCacheHit ? 0 : evaluation.outputTokens, marketCacheHit, aiCacheHit, signalId, dataCutoff: analysis.dataCutoff, charged: true } });
    return NextResponse.json({ outcome: publish ? "setup" : "no_setup", side: publish ? setupSide : null, strategy: strategy.selectedName, routed: selection.routed, summary: evaluation.summary, confidence: evaluation.confidence, sharedResult: aiCacheHit, signalId: signalId?.toString() ?? null, balance: debited.creditBalance, cost: product.cost });
  } catch (error) {
    console.error("Demo AI scan failed", error);
    if (charged) {
      await DemoWorkspace.updateOne({ _id: workspace._id, "receipts.requestId": requestId }, { $inc: { creditBalance: product.cost, revision: 1 }, $pull: { receipts: { requestId } }, $push: { activity: { $each: [{ productId: "signals", amount: product.cost, note: symbol + " " + interval + " failed AI scan refund", createdAt: new Date() }], $slice: -200 } } }).catch(refundError => console.error("Demo AI scan refund failed", refundError));
      if (signalId) await Signal.deleteOne({ _id: signalId, userId }).catch(() => undefined);
    }
    await ScanRun.updateOne({ _id: run._id }, { $set: { status: "failed", charged: false, summary: "The AI scan failed; no credit was charged." } });
    return NextResponse.json({ error: "The AI scan could not complete. No credit was charged; check the provider credentials and account balance." }, { status: 503 });
  }
}


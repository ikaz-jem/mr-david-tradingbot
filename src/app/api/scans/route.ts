import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { scanInput } from "@/lib/scanner";
import { getSharedClosedCandles, getSharedResearchDecision } from "@/lib/cached-research";
import { CreditEntry } from "@/models/CreditEntry";
import { ScanRun } from "@/models/ScanRun";
import { Signal } from "@/models/Signal";
import { User } from "@/models/User";
import { isSameOrigin } from "@/lib/request-origin";
import { getPlatformConfig } from "@/lib/platform-config";
import { notifyUser } from "@/lib/notifications";
import { PLATFORM_CREDIT_ID } from "@/lib/credits";
import { getAIServiceConfig } from "@/lib/service-config";
import { runDemoScan } from "@/lib/demo-scan";
import { getProductCatalog } from "@/lib/product-catalog";
import { accountEventEmail, hasEmailProvider, sendEmail } from "@/lib/email";
import { getEnabledStrategies } from "@/lib/strategy-catalog";
import { resolveStrategySelection } from "@/lib/strategy-selection";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to run a scan." }, { status: 401 });
  const parsed = scanInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select a supported Spot pair and try again." }, { status: 400 });

  let runId: mongoose.Types.ObjectId | undefined;
  let charged = false;
  let signalId: mongoose.Types.ObjectId | undefined;
  let balanceAfterCharge: number | undefined;
  let creditCost = 1;
  const userId = new mongoose.Types.ObjectId(session.user.id);
  const { symbol, requestId, interval, strategySlug } = parsed.data;
  try {
    await connectDB();
    if (session.user.isDemo) return await runDemoScan(session.user.id, symbol, interval, strategySlug, requestId);
    const config = await getPlatformConfig();
    if (config.maintenanceMode) return NextResponse.json({ error: config.maintenanceMessage }, { status: 503 });
    if (!config.scansOpen) return NextResponse.json({ error: config.scansPausedMessage }, { status: 503 });
    if (!config.allowedScanSymbols.includes(symbol)) return NextResponse.json({ error: "This pair is temporarily unavailable for research. No credit was charged." }, { status: 503 });
    const [service, product, strategies] = await Promise.all([getAIServiceConfig("research"), getProductCatalog(false).then(items => items.find(item => item.slug === "signals")), getEnabledStrategies(false, "signals")]);
    if (!service.openaiApiKey || !service.openaiModel) return NextResponse.json({ error: "AI scanning is not configured yet." }, { status: 503 });
    if (!product?.enabled) return NextResponse.json({ error: "Trade research is temporarily unavailable." }, { status: 503 });
    if (!strategies.some(item => item.slug === strategySlug)) return NextResponse.json({ error: "Choose an available research strategy and try again." }, { status: 400 });
    creditCost = product.cost;
    const user = await User.findOne({ _id: userId, status: "active" }).select("_id name email activatedAt creditBalance settings").lean();
    if (!user) return NextResponse.json({ error: "Account unavailable." }, { status: 403 });
    if (!user.activatedAt) return NextResponse.json({ error: "Activate your account once before using platform products." }, { status: 402 });
    if (user.creditBalance < creditCost) return NextResponse.json({ error: `You need ${creditCost} platform credit${creditCost === 1 ? "" : "s"} to run this scan.` }, { status: 402 });
    const existing = await ScanRun.findOne({ userId, requestId }).lean();
    if (existing) return NextResponse.json({ error: existing.status === "completed" ? "This scan was already completed. Refresh to see it." : "This scan request was already submitted." }, { status: 409 });
    if (await ScanRun.exists({ userId, status: "running", createdAt: { $gt: new Date(Date.now() - 60_000) } })) return NextResponse.json({ error: "A scan is already running. Wait for it to finish." }, { status: 429 });
    const run = await ScanRun.create({ userId, requestId, symbol, interval, requestedStrategySlug: strategySlug, creditCost });
    runId = run._id;

    const { candles, cacheHit: marketCacheHit } = await getSharedClosedCandles(symbol, interval);
    const selection = resolveStrategySelection(candles, strategySlug, strategies);
    const { analysis } = selection;
    const strategy = { requestedSlug: selection.requested.slug, selectedSlug: selection.selected.slug, selectedName: selection.selected.name, version: selection.selected.version };
    const { evaluation, cacheHit: aiCacheHit, source: decisionSource } = await getSharedResearchDecision(symbol, interval, analysis, service, strategy);
    const setupSide = analysis.setupSide;
    const publish = evaluation.decision === "publish" && setupSide !== null;
    const mongoSession = await mongoose.startSession();
    try {
      await mongoSession.withTransaction(async () => {
        const debited = await User.findOneAndUpdate(
          { _id: userId, status: "active", activatedAt: { $ne: null }, creditBalance: { $gte: creditCost } },
          { $inc: { creditBalance: -creditCost } },
          { returnDocument: "after", session: mongoSession },
        );
        if (!debited) throw new Error("No credits remain for this scan");
        balanceAfterCharge = debited.creditBalance;
        await CreditEntry.create([{ userId, productId: PLATFORM_CREDIT_ID, amount: -creditCost, kind: "capture", sourceKey: `scan:${runId}`, note: `${symbol} ${interval} trade research` }], { session: mongoSession });
        if (publish) {
          const [signal] = await Signal.create([{ userId, symbol, interval, requestedStrategySlug: strategy.requestedSlug, strategySlug: strategy.selectedSlug, strategyVersion: strategy.version, side: setupSide, status: "watch", entry: analysis.entry, stop: analysis.stop, target: analysis.target, thesis: evaluation.thesis, riskNote: evaluation.riskNote, confidence: evaluation.confidence, modelVersion: service.openaiModel, providerResponseId: evaluation.providerResponseId, marketFacts: analysis.facts, dataCutoff: analysis.dataCutoff, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), analysisCost: creditCost }], { session: mongoSession });
          signalId = signal._id;
        }
        const completed = await ScanRun.updateOne(
          { _id: runId, userId, status: "running" },
          { $set: { status: "completed", outcome: publish ? "setup" : "no_setup", setupSide: publish ? setupSide : null, requestedStrategySlug: strategy.requestedSlug, strategySlug: strategy.selectedSlug, strategyVersion: strategy.version, summary: evaluation.summary, modelVersion: decisionSource === "ai" ? service.openaiModel : "rule-engine", providerResponseId: evaluation.providerResponseId, aiDecision: evaluation.decision, aiConfidence: decisionSource === "ai" ? evaluation.confidence : null, ruleReadinessScore: analysis.readinessScore, inputTokens: aiCacheHit ? 0 : evaluation.inputTokens, outputTokens: aiCacheHit ? 0 : evaluation.outputTokens, marketCacheHit, aiCacheHit, signalId: signalId ?? null, dataCutoff: analysis.dataCutoff, charged: true } },
          { session: mongoSession },
        );
        if (completed.modifiedCount !== 1) throw new Error("Scan state changed before completion");
      });
      charged = true;
    } finally {
      await mongoSession.endSession();
    }
    const direction = setupSide === "sell" ? "short" : "long";
    await notifyUser({ userId: session.user.id, kind: "research", title: publish ? `${symbol} ${direction} setup found` : `${symbol} research scan completed`, body: evaluation.summary, href: "/dashboard/signals", sourceKey: `scan:${runId}` }).catch(error => console.error("Scan notification failed", error));
    try {
      const appUrl = process.env.APP_URL;
      if (publish && user.settings?.emailResearch !== false && appUrl && await hasEmailProvider()) {
        const title = `${symbol} ${direction} setup found`;
        const template = accountEventEmail(user.name, title, evaluation.summary, new URL("/dashboard/signals", appUrl).toString());
        await sendEmail({ to: user.email, category: "research", eventKey: `research:${runId}`, ...template });
      }
    } catch (error) { console.error("Scan email failed", error); }
    return NextResponse.json({ outcome: publish ? "setup" : "no_setup", side: publish ? setupSide : null, strategy: strategy.selectedName, routed: selection.routed, summary: evaluation.summary, confidence: decisionSource === "ai" ? evaluation.confidence : null, readinessScore: analysis.readinessScore, dataCutoff: analysis.dataCutoff.toISOString(), decisionSource, sharedResult: aiCacheHit, signalId: signalId?.toString() ?? null, balance: balanceAfterCharge, cost: creditCost });
  } catch (error) {
    console.error("Scan failed", error);
    if (runId && !charged) await ScanRun.updateOne({ _id: runId, userId, status: "running" }, { $set: { status: "failed", charged: false, summary: "The scan failed; no credit was charged." } }).catch(statusError => console.error("Scan status requires reconciliation", statusError));
    if (runId && !charged) await notifyUser({ userId: session.user.id, kind: "research", title: "Scan could not complete", body: "No credit was charged. You can try again.", href: "/dashboard/signals", sourceKey: `scan-failed:${runId}` }).catch(notificationError => console.error("Scan failure notification failed", notificationError));
    return NextResponse.json({ error: charged ? "The scan completed, but its response could not be delivered. Refresh your research history before retrying." : "The scan could not complete. No credit was charged; please try again." }, { status: 503 });
  }
}

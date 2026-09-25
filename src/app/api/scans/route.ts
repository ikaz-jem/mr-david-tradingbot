import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { analyzeCandles, explainSetup, getClosedCandles, scanInput } from "@/lib/scanner";
import { CreditEntry } from "@/models/CreditEntry";
import { ScanRun } from "@/models/ScanRun";
import { Signal } from "@/models/Signal";
import { User } from "@/models/User";
import { isSameOrigin } from "@/lib/request-origin";
import { getPlatformConfig } from "@/lib/platform-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to run a scan." }, { status: 401 });
  const parsed = scanInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select a supported Spot pair and try again." }, { status: 400 });

  let runId: mongoose.Types.ObjectId | undefined;
  let charged = false;
  let captureRecorded = false;
  let signalId: mongoose.Types.ObjectId | undefined;
  const userId = new mongoose.Types.ObjectId(session.user.id);
  const { symbol, requestId } = parsed.data;
  try {
    await connectDB();
    if (!(await getPlatformConfig()).scansOpen) return NextResponse.json({ error: "Research scans are temporarily paused by operations. No credit was charged." }, { status: 503 });
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) return NextResponse.json({ error: "AI scanning is not configured yet." }, { status: 503 });
    const user = await User.findOne({ _id: userId, status: "active" }).select("creditBalance");
    if (!user) return NextResponse.json({ error: "Account unavailable." }, { status: 403 });
    if (user.creditBalance < 1) return NextResponse.json({ error: "You need one credit to run this scan." }, { status: 402 });
    const existing = await ScanRun.findOne({ userId, requestId }).lean();
    if (existing) return NextResponse.json({ error: existing.status === "completed" ? "This scan was already completed. Refresh to see it." : "This scan request was already submitted." }, { status: 409 });
    if (await ScanRun.exists({ userId, status: "running", createdAt: { $gt: new Date(Date.now() - 60_000) } })) return NextResponse.json({ error: "A scan is already running. Wait for it to finish." }, { status: 429 });
    const run = await ScanRun.create({ userId, requestId, symbol });
    runId = run._id;

    const analysis = analyzeCandles(await getClosedCandles(symbol));
    const narrative = analysis.hasSetup ? await explainSetup(symbol, analysis) : null;
    const debited = await User.findOneAndUpdate({ _id: userId, status: "active", creditBalance: { $gte: 1 } }, { $inc: { creditBalance: -1 } });
    if (!debited) throw new Error("No credits remain for this scan");
    charged = true;
    await CreditEntry.create({ userId, amount: -1, kind: "capture", sourceKey: `scan:${runId}`, note: `${symbol} 4h research scan` });
    captureRecorded = true;
    if (analysis.hasSetup && narrative) {
      const signal = await Signal.create({ userId, symbol, interval: "4h", side: "buy", status: "watch", entry: analysis.entry, stop: analysis.stop, target: analysis.target, thesis: narrative.thesis, riskNote: narrative.riskNote, modelVersion: process.env.OPENAI_MODEL, marketFacts: analysis.facts, dataCutoff: analysis.dataCutoff, expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), analysisCost: 1 });
      signalId = signal._id;
    }
    await ScanRun.updateOne({ _id: runId }, { $set: { status: "completed", outcome: analysis.hasSetup ? "setup" : "no_setup", summary: analysis.summary, signalId: signalId ?? null, dataCutoff: analysis.dataCutoff, charged: true } });
    return NextResponse.json({ outcome: analysis.hasSetup ? "setup" : "no_setup", summary: analysis.summary, signalId: signalId?.toString() ?? null, balance: debited.creditBalance - 1 });
  } catch (error) {
    console.error("Scan failed", error);
    let refundVerified = !charged;
    if (charged) {
      try {
        const refund = await User.updateOne({ _id: userId }, { $inc: { creditBalance: 1 } });
        if (refund.modifiedCount !== 1) throw new Error("Credit refund did not update the wallet");
        if (captureRecorded || await CreditEntry.exists({ sourceKey: `scan:${runId}` })) await CreditEntry.updateOne({ sourceKey: `refund:scan:${runId}` }, { $setOnInsert: { userId, amount: 1, kind: "refund", note: "Failed scan refund", sourceKey: `refund:scan:${runId}` } }, { upsert: true });
        if (signalId) await Signal.deleteOne({ _id: signalId, userId });
        refundVerified = true;
      } catch (refundError) { console.error("Scan refund requires reconciliation", refundError); }
    }
    if (runId) await ScanRun.updateOne({ _id: runId }, { $set: { status: "failed", charged: charged && !refundVerified, summary: refundVerified ? "The scan failed; no credit was charged." : "The scan failed; credit reconciliation is required." } }).catch(error => console.error("Scan status requires reconciliation", error));
    return NextResponse.json({ error: refundVerified ? "The scan could not complete. No credit was charged; please try again." : "The scan could not complete. Please contact support before retrying; your credit balance needs review." }, { status: 503 });
  }
}

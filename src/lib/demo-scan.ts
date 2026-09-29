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
import { hasMonthlyAccess } from "@/lib/membership-policy";
import type { ScanInterval } from "@/lib/scan-markets";

export async function runDemoScan(userId: string, symbol: string, interval: ScanInterval, requestId: string) {
  const config = await getPlatformConfig(true);
  if (!config.scansOpen || !config.allowedScanSymbols.includes(symbol)) return NextResponse.json({ error: "This pair or research scanning is paused in demo controls." }, { status: 503 });
  const workspace = await ensureDemoWorkspace(userId);
  if (!workspace) return NextResponse.json({ error: "Demo workspace unavailable." }, { status: 503 });
  const product = (await getProductCatalog(true)).find(item => item.slug === "signals");
  if (!product?.enabled) return NextResponse.json({ error: "The scanner is paused in the demo catalog." }, { status: 503 });
  const previous = workspace.receipts.find(item => item.requestId === requestId);
  if (previous && (previous.kind !== "scan" || previous.itemId !== symbol + ":" + interval)) return NextResponse.json({ error: "Request ID was already used for another action." }, { status: 409 });
  if (!previous) {
    if (!hasMonthlyAccess(workspace.periodEnd)) return NextResponse.json({ error: "Renew your membership to unlock your preserved credits." }, { status: 402 });
    if ((workspace.wallets.get("signals") ?? 0) < product.cost) return NextResponse.json({ error: "Not enough scanner credits. Add credits from Billing." }, { status: 402 });
    if (workspace.receipts.length >= 500) return NextResponse.json({ error: "Demo activity limit reached." }, { status: 409 });
    const result = await DemoWorkspace.updateOne({ _id: workspace._id, revision: workspace.revision, periodEnd: { $gt: new Date() }, "wallets.signals": { $gte: product.cost } }, {
      $inc: { "wallets.signals": -product.cost, revision: 1 },
      $push: { receipts: { requestId, kind: "scan", productId: "signals", itemId: symbol + ":" + interval, amount: 0, credits: -product.cost, createdAt: new Date() }, activity: { $each: [{ productId: "signals", amount: -product.cost, note: symbol + " " + interval + " simulated scan", createdAt: new Date() }], $slice: -200 } },
    });
    if (!result.modifiedCount) return NextResponse.json({ error: "Your wallet changed. Retry this scan." }, { status: 409 });
  }
  // The receipt is the idempotency record. A retry repairs a missing projection without a second debit.
  const id = new mongoose.Types.ObjectId(createHash("sha256").update(userId + ":" + requestId).digest("hex").slice(0, 24));
  const entry = symbol === "BTCUSDT" ? 64000 : symbol === "ETHUSDT" ? 2800 : symbol === "SOLUSDT" ? 145 : 10 + (parseInt(id.toString().slice(-4), 16) % 9000) / 100;
  await Signal.updateOne({ _id: id, userId }, { $setOnInsert: { userId, symbol, interval, side: "buy", status: "watch", entry, stop: Number((entry * .97).toFixed(5)), target: Number((entry * 1.06).toFixed(5)), thesis: "DEMO: illustrative breakout with a pre-defined invalidation level. This sample shows how an explained trade idea appears; it is not based on current market data.", riskNote: "Synthetic prices and narrative. Never use this demo card to place a trade.", modelVersion: "demo-scan-v1", marketFacts: { simulated: true }, dataCutoff: new Date(), expiresAt: new Date(Date.now() + 43200000), analysisCost: previous ? Math.abs(previous.credits ?? 0) : product.cost } }, { upsert: true });
  await ScanRun.updateOne({ userId, requestId }, { $setOnInsert: { symbol, interval, creditCost: previous ? Math.abs(previous.credits ?? 0) : product.cost, status: "completed", outcome: "setup", signalId: id, charged: true, summary: "Simulated research. No AI service or exchange was contacted.", dataCutoff: new Date() } }, { upsert: true });
  return NextResponse.json({ outcome: "setup", summary: "Simulated research card created. No AI service or exchange was contacted.", signalId: String(id), cost: previous ? Math.abs(previous.credits ?? 0) : product.cost });
}


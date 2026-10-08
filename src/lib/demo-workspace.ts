import "server-only";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { DemoWorkspace } from "@/models/DemoWorkspace";
import { User } from "@/models/User";
import { Signal } from "@/models/Signal";
import { PaperOutcome } from "@/models/PaperOutcome";
import { Order } from "@/models/Order";
import { SupportTicket } from "@/models/SupportTicket";
import { notifyUser } from "@/lib/notifications";
import { nextMonthlyEnd } from "@/lib/membership-policy";

export async function ensureDemoWorkspace(userId: string) {
  if (!await User.exists({ _id: userId, isDemo: true })) throw new Error("Demo access is unavailable");
  const now = new Date();
  await DemoWorkspace.updateOne({ userId }, { $setOnInsert: { userId, planId: "trader", periodEnd: nextMonthlyEnd(now), activatedAt: now, creditBalance: 82, wallets: { signals: 82, portfolio: 20, strategy: 10 }, activity: [{ productId: "platform", amount: 100, note: "Sample activation and refill credits", createdAt: now }, { productId: "platform", amount: -18, note: "Sample historical usage", createdAt: now }], connections: [{ provider: "binance", label: "Sample Binance Spot", connectedAt: now }] } }, { upsert: true });
  return DemoWorkspace.findOne({ userId });
}
export async function seedDemoResearch(userId: string, name: string) {
  await ensureDemoWorkspace(userId);
  const pairs = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "LINKUSDT"];
  const prices = [64000, 2800, 145, 580, 0.58, 13.2];
  for (let index = 0; index < pairs.length; index++) {
    const id = new mongoose.Types.ObjectId(createHash("sha256").update("demo-research-v1:" + userId + ":" + index).digest("hex").slice(0, 24));
    const at = new Date(Date.now() - (7 - index) * 86400000);
    await Signal.updateOne({ _id: id, userId }, { $setOnInsert: { userId, symbol: pairs[index], interval: index % 2 ? "1h" : "4h", side: "buy", status: "closed", entry: prices[index], stop: prices[index] * .97, target: prices[index] * 1.06, thesis: "DEMO: illustrative momentum setup with a consolidation breakout. This is synthetic data, not a current trade recommendation.", riskNote: "Synthetic fixture for interface review. No real market observation or order.", modelVersion: "demo-fixture-v1", marketFacts: { simulated: true }, dataCutoff: at, expiresAt: new Date(at.getTime() + 43200000), analysisCost: 1 } }, { upsert: true });
    await PaperOutcome.updateOne({ signalId: id }, { $setOnInsert: { userId, signalId: id, status: "closed", reason: index % 3 === 0 ? "stop" : "target", entryAt: at, exitAt: new Date(at.getTime() + 21600000), exitPrice: prices[index] * (index % 3 === 0 ? .97 : 1.06), netReturnPct: index % 3 === 0 ? -3.3 : 5.7, methodVersion: "demo-fixture-v1", feeRate: .001, slippageRate: .0005, checkedAt: at } }, { upsert: true });
    if (index < 3) await Order.updateOne({ clientOrderId: `demo-${userId}-${index}` }, { $setOnInsert: { userId, signalId: id, exchange: "binance_spot", clientOrderId: `demo-${userId}-${index}`, exchangeOrderId: `SIM-${String(id).slice(-8)}`, symbol: pairs[index], side: "BUY", quantity: index === 0 ? "0.002" : index === 1 ? "0.04" : "1.5", status: index === 0 ? "filled" : index === 1 ? "cancelled" : "unknown", filledQuantity: index === 0 ? "0.002" : "0", feeAmount: index === 0 ? "0.000002" : "0", feeAsset: index === 0 ? pairs[index].replace("USDT", "") : null } }, { upsert: true });
  }
  await SupportTicket.updateOne({ seedKey: "demo-support-v1:" + userId }, { $setOnInsert: { seedKey: "demo-support-v1:" + userId, userId, isDemo: true, subject: "How do activation and platform credits work?", category: "billing", status: "open", messages: [{ authorId: userId, authorName: name, body: "This is a sample support request. After the one-time activation, can I refill the shared balance whenever it runs low?", createdAt: new Date() }] } }, { upsert: true });
  await notifyUser({ userId, kind: "system", title: "Your demo workspace is ready", body: "Explore one-time activation, shared platform credits, research, and support. No real money or trades are involved.", href: "/dashboard/credits", sourceKey: "demo-welcome-v1:" + userId });
}


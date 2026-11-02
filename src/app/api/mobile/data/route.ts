import { NextResponse } from "next/server";
import { mobileActor } from "@/lib/mobile-auth";
import { getAccountCreditState } from "@/lib/credits";
import { Notification } from "@/models/Notification";
import { Signal } from "@/models/Signal";
import { ScanRun } from "@/models/ScanRun";
import { Order } from "@/models/Order";
import { CreditEntry } from "@/models/CreditEntry";
import { User } from "@/models/User";
import { ExchangeConnection } from "@/models/ExchangeConnection";
import { PaperOutcome } from "@/models/PaperOutcome";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const actor = await mobileActor(request);
  if (!actor) return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
  const section = new URL(request.url).searchParams.get("section") ?? "overview";
  if (actor.user.mustChangePassword && section !== "settings") return NextResponse.json({ error: "Change your temporary password first." }, { status: 403 });
  const userId = actor.user._id;
  if (section === "overview") {
    const [wallet, signalCount, orderCount, notifications, recentSignals, orders] = await Promise.all([
      getAccountCreditState(String(userId)), Signal.countDocuments({ userId }), Order.countDocuments({ userId }),
      Notification.countDocuments({ userId, readAt: null }), Signal.find({ userId }).sort({ createdAt: -1 }).limit(4).select("symbol interval side confidence status createdAt").lean(),
      Order.find({ userId }).sort({ createdAt: -1 }).limit(10).select("symbol source market status netPnl pnlComplete createdAt").lean(),
    ]);
    return NextResponse.json({ wallet, signalCount, orderCount, unreadCount: notifications, recentSignals, recentOrders: orders }, { headers: { "Cache-Control": "no-store" } });
  }
  if (section === "research") {
    const [signals, runs] = await Promise.all([
      Signal.find({ userId }).sort({ createdAt: -1 }).limit(50).select("symbol interval side status entry stop target thesis riskNote confidence strategySlug dataCutoff expiresAt createdAt").lean(),
      ScanRun.find({ userId }).sort({ createdAt: -1 }).limit(50).select("symbol interval outcome setupSide summary aiConfidence ruleReadinessScore strategySlug charged creditCost createdAt").lean(),
    ]);
    return NextResponse.json({ signals, runs }, { headers: { "Cache-Control": "no-store" } });
  }
  if (section === "notifications") {
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(100).select("kind title body href readAt createdAt").lean();
    return NextResponse.json({ notifications }, { headers: { "Cache-Control": "no-store" } });
  }
  if (section === "billing") {
    const [wallet, entries] = await Promise.all([getAccountCreditState(String(userId)), CreditEntry.find({ userId }).sort({ createdAt: -1 }).limit(50).select("kind amount note createdAt").lean()]);
    return NextResponse.json({ wallet, entries }, { headers: { "Cache-Control": "no-store" } });
  }
  if (section === "performance") {
    const [orders, paperOutcomes, publishedIdeas, [paperStats], [exchangeStats]] = await Promise.all([
      Order.find({ userId }).sort({ createdAt: -1 }).limit(100).select("symbol source exchange market side status trackingStatus quoteAmount marginAmount leverage averageFillPrice markPrice netPnl realizedPnl unrealizedPnl pnlComplete protectionStatus createdAt closedAt").lean(),
      PaperOutcome.find({ userId }).sort({ updatedAt: -1 }).limit(30).select("signalId status reason netReturnPct checkedAt updatedAt").lean(),
      Signal.countDocuments({ userId }),
      PaperOutcome.aggregate<{ count: number; wins: number; average: number }>([
        { $match: { userId, status: "closed", netReturnPct: { $type: "number" } } },
        { $group: { _id: null, count: { $sum: 1 }, wins: { $sum: { $cond: [{ $gt: ["$netReturnPct", 0] }, 1, 0] } }, average: { $avg: "$netReturnPct" } } },
      ]),
      Order.aggregate<{ count: number; pnl: number }>([
        { $match: { userId, pnlComplete: true, netPnl: { $type: "number" } } },
        { $group: { _id: null, count: { $sum: 1 }, pnl: { $sum: "$netPnl" } } },
      ]),
    ]);
    const signalIds = paperOutcomes.map(item => item.signalId);
    const outcomeSignals = signalIds.length ? await Signal.find({ _id: { $in: signalIds }, userId }).select("symbol").lean() : [];
    const symbols = new Map(outcomeSignals.map(item => [String(item._id), item.symbol]));
    const paper = paperOutcomes.map(item => ({ _id: item._id, symbol: symbols.get(String(item.signalId)) ?? null, status: item.status, reason: item.reason, netReturnPct: item.netReturnPct, checkedAt: item.checkedAt }));
    return NextResponse.json({ orders, completePnl: exchangeStats?.pnl ?? 0, completeCount: exchangeStats?.count ?? 0, publishedIdeas, paper, paperStats: { count: paperStats?.count ?? 0, wins: paperStats?.wins ?? 0, average: paperStats?.average ?? null } }, { headers: { "Cache-Control": "no-store" } });
  }
  if (section === "settings") {
    const [user, connectionCount] = await Promise.all([
      User.findById(userId).select("name email countryCode role isDemo mustChangePassword settings createdAt lastPasswordChangedAt").lean(),
      ExchangeConnection.countDocuments({ userId }),
    ]);
    return NextResponse.json({ user, connectionCount }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ error: "Unknown section." }, { status: 404 });
}

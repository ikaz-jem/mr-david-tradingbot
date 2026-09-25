import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { evaluatePaperSignal, getPaperCandles, paperStartTime, PAPER_FEE_RATE, PAPER_METHOD, PAPER_SLIPPAGE_RATE } from "@/lib/paper";
import { isSameOrigin } from "@/lib/request-origin";
import { PaperOutcome } from "@/models/PaperOutcome";
import { Signal } from "@/models/Signal";
import { User } from "@/models/User";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    await connectDB();
    if (!await User.exists({ _id: session.user.id, status: "active" })) return NextResponse.json({ error: "Account unavailable." }, { status: 403 });
    const signals = await Signal.find({ userId: session.user.id }).sort({ createdAt: -1 }).limit(30).lean();
    const outcomes = await PaperOutcome.find({ signalId: { $in: signals.map(signal => signal._id) } }).lean();
    const bySignal = new Map(outcomes.map(outcome => [outcome.signalId.toString(), outcome]));
    const now = new Date();
    const due = signals.filter(signal => {
      const existing = bySignal.get(signal._id.toString());
      return !existing || (!["closed", "expired"].includes(existing.status) && now.getTime() - existing.checkedAt.getTime() >= 60_000);
    }).slice(0, 10);
    let updated = 0;
    const failures: string[] = [];
    for (const signal of due) {
      try {
        const start = paperStartTime(signal.createdAt);
        const end = Math.min(now.getTime(), signal.expiresAt.getTime()) - 1;
        const candles = end >= start + 59_999 ? await getPaperCandles(signal.symbol, start, end) : [];
        const result = evaluatePaperSignal(signal, candles, now);
        await PaperOutcome.updateOne({ signalId: signal._id }, { $set: { userId: signal.userId, ...result, methodVersion: PAPER_METHOD, feeRate: PAPER_FEE_RATE, slippageRate: PAPER_SLIPPAGE_RATE, checkedAt: now } }, { upsert: true });
        updated++;
      } catch (error) { console.error("Paper reconciliation failed", signal._id, error); failures.push(signal.symbol); }
    }
    return NextResponse.json({ updated, pending: Math.max(signals.length - outcomes.filter(outcome => ["closed", "expired"].includes(outcome.status)).length - updated, 0), failures });
  } catch (error) {
    console.error("Paper reconciliation unavailable", error);
    return NextResponse.json({ error: "Paper outcomes are unavailable right now." }, { status: 503 });
  }
}

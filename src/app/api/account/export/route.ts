import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Signal } from "@/models/Signal";
import { ScanRun } from "@/models/ScanRun";
import { CreditEntry } from "@/models/CreditEntry";
import { BillingPurchase } from "@/models/BillingPurchase";
import { Notification } from "@/models/Notification";
import { SupportTicket } from "@/models/SupportTicket";
import { ExchangeConnection } from "@/models/ExchangeConnection";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await connectDB();
  const userId = session.user.id;
  const [account, signals, scans, credits, purchases, notifications, tickets, connections] = await Promise.all([
    User.findById(userId).select("-passwordHash -authVersion").lean(),
    Signal.find({ userId }).sort({ createdAt: -1 }).limit(500).lean(),
    ScanRun.find({ userId }).sort({ createdAt: -1 }).limit(500).lean(),
    CreditEntry.find({ userId }).sort({ createdAt: -1 }).limit(500).lean(),
    BillingPurchase.find({ userId }).sort({ createdAt: -1 }).limit(500).lean(),
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(500).lean(),
    SupportTicket.find({ userId }).sort({ createdAt: -1 }).limit(200).lean(),
    ExchangeConnection.find({ userId }).select("provider market environment keyLast4 status access ipRestricted lastCheckedAt createdAt updatedAt").lean(),
  ]);
  if (!account) return NextResponse.json({ error: "Account unavailable." }, { status: 404 });
  return NextResponse.json({ exportedAt: new Date().toISOString(), account, connections, signals, scans, creditLedger: credits, purchases, notifications, supportTickets: tickets }, {
    headers: { "Content-Disposition": `attachment; filename="enrivea-signal-export-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" },
  });
}

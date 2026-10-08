import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-origin";
import { scanIntervals, scanSymbols } from "@/lib/scan-markets";
import { User } from "@/models/User";

const schema = z.object({
  timezone: z.string().trim().min(1).max(64),
  locale: z.literal("en"),
  defaultSymbol: z.enum(scanSymbols),
  defaultInterval: z.enum(scanIntervals),
  riskProfile: z.enum(["conservative", "balanced", "aggressive"]),
  compactMode: z.boolean(),
  reducedMotion: z.boolean(),
  inAppResearch: z.boolean(),
  inAppBilling: z.boolean(),
  inAppExchange: z.boolean(),
  emailResearch: z.boolean(),
  emailBilling: z.boolean(),
  emailSecurity: z.boolean(),
});

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the selected preferences and try again." }, { status: 400 });
  try {
    if (!Intl.DateTimeFormat(undefined, { timeZone: parsed.data.timezone })) throw new Error("Invalid timezone");
    await connectDB();
    const user = await User.findOneAndUpdate(
      { _id: session.user.id, status: "active" },
      { $set: Object.fromEntries(Object.entries(parsed.data).map(([key, value]) => [`settings.${key}`, value])) },
      { returnDocument: "after", runValidators: true },
    ).select("settings").lean();
    if (!user) return NextResponse.json({ error: "Settings are unavailable for this account." }, { status: 403 });
    return NextResponse.json({ ok: true, settings: user.settings });
  } catch (error) {
    if (error instanceof RangeError || (error instanceof Error && error.message === "Invalid timezone")) return NextResponse.json({ error: "Choose a valid timezone." }, { status: 400 });
    console.error("Preference update failed", error);
    return NextResponse.json({ error: "Could not save your preferences." }, { status: 503 });
  }
}

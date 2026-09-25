import { randomBytes } from "node:crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { paystackTestKey, paystackTestPlanCode, paystackTestRequest } from "@/lib/paystack";
import { isSameOrigin } from "@/lib/request-origin";
import { PaystackCheckout } from "@/models/PaystackCheckout";
import { User } from "@/models/User";

export const runtime = "nodejs";
const schema = z.object({ planId: z.enum(["starter", "trader", "desk"]) });
type PaystackPlan = { plan_code: string; domain: string; interval: string; amount: number; currency: string };
type PaystackAuthorization = { reference: string; authorization_url: string };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Select a valid plan." }, { status: 400 });
  const key = paystackTestKey();
  const planCode = paystackTestPlanCode(parsed.data.planId);
  if (!key || !planCode) return NextResponse.json({ error: "Paystack test checkout is not configured." }, { status: 503 });
  let callbackUrl: string;
  try {
    const appOrigin = new URL(process.env.APP_URL!);
    if (!["http:", "https:"].includes(appOrigin.protocol) || appOrigin.origin !== new URL(process.env.NEXTAUTH_URL!).origin) throw new Error("Invalid app origin");
    callbackUrl = new URL("/dashboard/credits", appOrigin).toString();
  } catch { return NextResponse.json({ error: "App URL is not configured for test checkout." }, { status: 503 }); }
  try {
    await connectDB();
    const user = await User.findOne({ _id: session.user.id, status: "active", emailVerifiedAt: { $ne: null } }).select("email");
    if (!user) return NextResponse.json({ error: "Account unavailable." }, { status: 403 });
    const plan = await paystackTestRequest<PaystackPlan>(`plan/${encodeURIComponent(planCode)}`);
    if (plan.domain !== "test" || plan.interval !== "monthly" || plan.plan_code !== planCode || !Number.isSafeInteger(plan.amount) || plan.amount <= 0 || !/^[A-Z]{3}$/.test(plan.currency)) {
      return NextResponse.json({ error: "The Paystack test plan is not a valid monthly plan." }, { status: 503 });
    }
    const reference = `enrivea-test-${randomBytes(16).toString("hex")}`;
    const checkout = await PaystackCheckout.create({ userId: user._id, planId: parsed.data.planId, planCode, reference, expectedAmount: plan.amount, currency: plan.currency });
    try {
      const authorization = await paystackTestRequest<PaystackAuthorization>("transaction/initialize", { method: "POST", body: {
        email: user.email,
        amount: String(plan.amount),
        currency: plan.currency,
        plan: planCode,
        reference,
        callback_url: callbackUrl,
        metadata: JSON.stringify({ checkoutId: checkout.id, product: "enrivea-signal-sandbox" }),
      } });
      if (authorization.reference !== reference || !authorization.authorization_url.startsWith("https://checkout.paystack.com/")) throw new Error("Paystack returned an invalid checkout URL");
      await PaystackCheckout.updateOne({ _id: checkout._id }, { $set: { status: "pending", authorizationUrl: authorization.authorization_url } });
      return NextResponse.json({ url: authorization.authorization_url, sandbox: true });
    } catch (error) {
      await PaystackCheckout.updateOne({ _id: checkout._id }, { $set: { status: "failed" } });
      throw error;
    }
  } catch (error) {
    console.error("Paystack sandbox checkout failed", error);
    return NextResponse.json({ error: "Paystack test checkout is unavailable." }, { status: 503 });
  }
}

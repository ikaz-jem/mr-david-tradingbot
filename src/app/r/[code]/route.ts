import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { affiliateConfig, referralSponsor } from "@/lib/affiliates";
import { cookies } from "next/headers";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await connectDB();
  const sponsor = await referralSponsor(code);
  const response = NextResponse.redirect(new URL("/register", request.url));
  response.headers.set("Cache-Control", "no-store");
  // First valid referral wins until expiry; attribution becomes permanent at registration.
  if (sponsor && !(await cookies()).get("enrivea-referral")) {
    const config = await affiliateConfig(false);
    response.cookies.set("enrivea-referral", code, { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: config.cookieDays * 86400 });
  }
  return response;
}

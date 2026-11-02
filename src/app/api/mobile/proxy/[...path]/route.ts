import { NextResponse } from "next/server";
import { mobileActor, mobileCookie } from "@/lib/mobile-auth";
import { mobileRouteAccess } from "@/lib/mobile-route-policy";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };

async function forward(request: Request, context: Context) {
  const path = (await context.params).path.join("/");
  const method = request.method;
  const access = mobileRouteAccess(path, method);
  const publicRoute = access === "public";
  if (access === "deny") return NextResponse.json({ error: "Mobile route unavailable." }, { status: 404 });
  const actor = publicRoute ? null : await mobileActor(request);
  if (!publicRoute && !actor) return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
  if (actor?.user.mustChangePassword && path !== "account/password") return NextResponse.json({ error: "Change your temporary password first." }, { status: 403 });
  const configuredOrigin = process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (!configuredOrigin) return NextResponse.json({ error: "Mobile API origin is not configured." }, { status: 503 });
  let origin: string;
  try {
    const value = new URL(configuredOrigin);
    if (value.protocol !== "https:" && !(value.protocol === "http:" && ["localhost", "127.0.0.1"].includes(value.hostname))) throw new Error("Invalid protocol");
    origin = value.origin;
  } catch { return NextResponse.json({ error: "Mobile API origin is invalid." }, { status: 503 }); }
  const endpoint = new URL(`/api/${path}`, origin);
  endpoint.search = new URL(request.url).search;
  const headers = new Headers({ Accept: "application/json", Origin: origin });
  if (actor) headers.set("Cookie", await mobileCookie(actor));
  let body: string | undefined;
  if (!["GET", "HEAD"].includes(method)) {
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return NextResponse.json({ error: "JSON request required." }, { status: 415 });
    body = await request.text();
    if (body.length > 65_536) return NextResponse.json({ error: "Request too large." }, { status: 413 });
    headers.set("Content-Type", "application/json");
    if (publicRoute && path === "auth/register") {
      let payload: { referralCode?: unknown };
      try { payload = JSON.parse(body) as { referralCode?: unknown }; }
      catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
      const referralCode = payload.referralCode;
      if (typeof referralCode === "string" && /^[a-f0-9]{24}$/.test(referralCode)) headers.set("Cookie", `enrivea-referral=${referralCode}`);
    }
  }
  try {
    const upstream = await fetch(endpoint, { method, headers, body, cache: "no-store", redirect: "manual" });
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return NextResponse.json({ error: "Unexpected server response." }, { status: 502 });
    return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Mobile API gateway failed", path, error);
    return NextResponse.json({ error: "The service is temporarily unavailable." }, { status: 503 });
  }
}

export async function GET(request: Request, context: Context) { return forward(request, context); }
export async function POST(request: Request, context: Context) { return forward(request, context); }
export async function PATCH(request: Request, context: Context) { return forward(request, context); }
export async function DELETE(request: Request, context: Context) { return forward(request, context); }

import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { demoAdminApiAllowed, demoAdminPageAllowed } from "@/lib/demo-policy";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  const headers = new Headers(request.headers);
  // Never trust a caller-supplied path header; layout checks use this overwritten value.
  headers.set("x-enrivea-path", path);
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token?.mustChangePassword) {
    const mayRotatePassword = path === "/api/account/password" || path.startsWith("/api/auth/");
    if (path.startsWith("/api/") && !mayRotatePassword) return NextResponse.json({ error: "Change your temporary password before continuing." }, { status: 403 });
    if ((path === "/admin" || path.startsWith("/admin/") || path.startsWith("/dashboard/")) && path !== "/dashboard/settings") {
      const target = new URL("/dashboard/settings", request.url);
      target.searchParams.set("password", "required");
      return NextResponse.redirect(target);
    }
  }
  if (token?.isDemo) {
    if (path.startsWith("/api/admin/") && !demoAdminApiAllowed(path)) return NextResponse.json({ error: "This live operation is unavailable in the public demo." }, { status: 403 });
    if ((path === "/admin" || path.startsWith("/admin/")) && !demoAdminPageAllowed(path)) return NextResponse.redirect(new URL("/admin", request.url));
  }
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ["/admin/:path*", "/dashboard/:path*", "/api/:path*"] };

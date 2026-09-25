export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = process.env.NEXTAUTH_URL || process.env.APP_URL;
  if (!origin || !allowed) return false;
  try { return new URL(origin).origin === new URL(allowed).origin; }
  catch { return false; }
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = [process.env.NEXTAUTH_URL, process.env.APP_URL,
    ...[process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(Boolean).map(host => `https://${host}`)];
  return allowed.some(value => {
    if (!value) return false;
    try {
      const candidate = new URL(value);
      return ["http:", "https:"].includes(candidate.protocol) && new URL(origin).origin === candidate.origin;
    } catch { return false; }
  });
}

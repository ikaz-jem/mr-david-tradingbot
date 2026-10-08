// Public showcase accounts are intentionally available on deployed previews and production.
// They may access only demo-scoped records and never act as real platform administrators.
export const demoLoginEnabled = () => true;
export const demoAdminPages = ["/admin", "/admin/access", "/admin/users", "/admin/billing", "/admin/products", "/admin/strategies", "/admin/support", "/admin/controls", "/admin/emails", "/admin/signals", "/admin/activity", "/admin/data", "/admin/orders", "/admin/system"];
export function demoAdminPageAllowed(path: string) {
  if (path === "/admin/affiliates") return true;
  return demoAdminPages.includes(path) || path.startsWith("/admin/controls/") || /^\/admin\/users\/[a-f0-9]{24}\/preview$/.test(path);
}
export function demoAdminApiAllowed(path: string) {
  if (path === "/api/admin/payment-gateways") return true;
  if (path === "/api/admin/affiliates") return true;
  return ["/api/admin/access", "/api/admin/controls", "/api/admin/service-config", "/api/admin/products", "/api/admin/strategies", "/api/admin/notifications", "/api/admin/billing/adjust", "/api/admin/emails/test"].includes(path) || /^\/api\/admin\/users\/[a-f0-9]{24}\/(access|preview)$/.test(path) || /^\/api\/admin\/signals\/[a-f0-9]{24}\/moderate$/.test(path);
}
export function isShowcaseAccount(email: string) {
  return ["demo-user@enrivea.invalid", "demo-admin@enrivea.invalid"].includes(email);
}

// Public showcase accounts are intentionally available on deployed previews and production.
// They may access only demo-scoped records and never act as real platform administrators.
export const demoLoginEnabled = () => true;
export const demoAdminPages = ["/admin", "/admin/users", "/admin/billing", "/admin/products", "/admin/support", "/admin/controls", "/admin/emails", "/admin/signals", "/admin/activity", "/admin/data", "/admin/orders", "/admin/system"];
export function demoAdminPageAllowed(path: string) {
  return demoAdminPages.includes(path) || /^\/admin\/users\/[a-f0-9]{24}\/preview$/.test(path);
}
export function demoAdminApiAllowed(path: string) {
  return ["/api/admin/controls", "/api/admin/service-config", "/api/admin/products", "/api/admin/notifications", "/api/admin/billing/adjust", "/api/admin/emails/test"].includes(path) || /^\/api\/admin\/users\/[a-f0-9]{24}\/(access|preview)$/.test(path) || /^\/api\/admin\/signals\/[a-f0-9]{24}\/moderate$/.test(path);
}
export function isShowcaseAccount(email: string) {
  return ["demo-user@enrivea.invalid", "demo-admin@enrivea.invalid"].includes(email);
}

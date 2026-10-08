import "server-only";
import { headers } from "next/headers";
import { connectDB } from "@/lib/db";
import { permissionCatalog, systemRoleTemplates, type PermissionKey } from "@/lib/access-control-catalog";
import { resolvePermissionEffects, type PermissionEffect } from "@/lib/access-control-policy";
import { Organization } from "@/models/Organization";
import { Permission } from "@/models/Permission";
import { AccessRole } from "@/models/AccessRole";
import { RolePermission } from "@/models/RolePermission";
import { UserRole } from "@/models/UserRole";
import { UserPermission } from "@/models/UserPermission";
import { AuthorizationAuditLog } from "@/models/AuthorizationAuditLog";
import { User } from "@/models/User";

export type AccessActor = { id: string; name: string; email: string; role: string; isDemo: boolean; organizationId: string; organizationKind: "platform" | "customer"; superAdmin: boolean; roles: string[]; permissions: string[]; can: (permission: string) => boolean };

export async function writeSecurityAudit(input: { actor?: Partial<AccessActor> | null; action: string; resource: string; targetType: string; targetId?: string; previousValue?: unknown; newValue?: unknown; outcome: "success" | "denied" | "failed"; reason?: string; request?: Request; metadata?: unknown }) {
  await connectDB();
  let ip = "", userAgent = "", requestId = "";
  if (input.request) {
    ip = input.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    userAgent = input.request.headers.get("user-agent") ?? "";
    requestId = input.request.headers.get("x-request-id") ?? "";
  } else {
    try { const values = await headers(); ip = values.get("x-forwarded-for")?.split(",")[0]?.trim() ?? ""; userAgent = values.get("user-agent") ?? ""; requestId = values.get("x-request-id") ?? ""; } catch {}
  }
  await AuthorizationAuditLog.create({ organizationId: input.actor?.organizationId || null, actorId: input.actor?.id || null, action: input.action, resource: input.resource, targetType: input.targetType, targetId: input.targetId ?? "", previousValue: input.previousValue ?? null, newValue: input.newValue ?? null, outcome: input.outcome, reason: input.reason ?? "", ip, userAgent, requestId, metadata: input.metadata ?? null });
}

export async function ensureAccessControlForUser(userId: string) {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) return null;
  let organizationId = user.organizationId;
  if (!organizationId) {
    const platformMember = user.role === "admin" || user.role === "staff";
    const slug = platformMember ? `enrivea-${user.isDemo ? "demo" : "operations"}` : `account-${user._id}`;
    const organization = await Organization.findOneAndUpdate({ slug, isDemo: user.isDemo }, { $setOnInsert: { name: platformMember ? `Enrivea ${user.isDemo ? "Demo " : ""}Operations` : `${user.name}'s workspace`, slug, kind: platformMember ? "platform" : "customer", isDemo: user.isDemo, createdBy: user._id } }, { upsert: true, returnDocument: "after" });
    organizationId = organization!._id;
    user.organizationId = organizationId;
    await user.save();
  }
  for (const [key, module, resource, action, description, risk] of permissionCatalog) await Permission.updateOne({ key }, { $setOnInsert: { key, module, resource, action, name: key, description, risk } }, { upsert: true });
  const permissionRows = await Permission.find({ active: true }).select("_id key").lean();
  const permissionIds = new Map(permissionRows.map(item => [item.key, item._id]));
  for (const template of systemRoleTemplates) {
    const role = await AccessRole.findOneAndUpdate({ organizationId, slug: template.slug }, { $setOnInsert: { organizationId, slug: template.slug, name: template.name, description: template.description, system: true, superAdmin: template.superAdmin, createdBy: user._id } }, { upsert: true, returnDocument: "after" });
    if (!role) continue;
    for (const key of template.permissions) {
      if (key === "*:*") continue;
      const permissionId = permissionIds.get(key);
      if (permissionId) await RolePermission.updateOne({ organizationId, roleId: role._id, permissionId }, { $setOnInsert: { organizationId, roleId: role._id, permissionId, effect: "allow", grantedBy: user._id } }, { upsert: true });
    }
  }
  if (!await UserRole.exists({ organizationId, userId: user._id })) {
    const fallbackSlug = user.role === "admin" ? "super-admin" : user.role === "staff" ? "staff" : "customer";
    const fallbackRole = await AccessRole.findOne({ organizationId, slug: fallbackSlug }).select("_id").lean();
    if (fallbackRole) await UserRole.create({ organizationId, userId: user._id, roleId: fallbackRole._id, assignedBy: user._id });
  }
  return { user, organizationId: String(organizationId) };
}

export async function resolveEffectivePermissions(userId: string): Promise<AccessActor | null> {
  await connectDB();
  let user = await User.findOne({ _id: userId, status: "active" }).select("name email role isDemo organizationId").lean();
  if (!user) return null;
  if (!user.organizationId) { await ensureAccessControlForUser(userId); user = await User.findOne({ _id: userId, status: "active" }).select("name email role isDemo organizationId").lean(); }
  if (!user?.organizationId) return null;
  const organization = await Organization.findOne({ _id: user.organizationId, status: "active" }).select("kind").lean();
  if (!organization) return null;
  const now = new Date();
  const assignments = await UserRole.find({ organizationId: user.organizationId, userId: user._id, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }).lean();
  const allRoles = await AccessRole.find({ organizationId: user.organizationId, status: "active" }).lean();
  const roleMap = new Map(allRoles.map(role => [String(role._id), role]));
  const selected = new Map<string, (typeof allRoles)[number]>();
  const visit = (id: string, depth = 0) => { if (depth > 8 || selected.has(id)) return; const role = roleMap.get(id); if (!role) return; selected.set(id, role); if (role.parentRoleId) visit(String(role.parentRoleId), depth + 1); };
  assignments.forEach(item => visit(String(item.roleId)));
  const roles = [...selected.values()];
  const superAdmin = roles.some(role => role.superAdmin) || (!assignments.length && user.role === "admin");
  const roleLinks = roles.length ? await RolePermission.find({ organizationId: user.organizationId, roleId: { $in: roles.map(role => role._id) } }).lean() : [];
  const overrides = await UserPermission.find({ organizationId: user.organizationId, userId: user._id, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }).lean();
  const permissionIds = [...new Set([...roleLinks, ...overrides].map(item => String(item.permissionId)))];
  const permissions = await Permission.find({ _id: { $in: permissionIds }, active: true }).select("_id key").lean();
  const keyById = new Map(permissions.map(item => [String(item._id), item.key]));
  const roleEffects: PermissionEffect[] = roleLinks.flatMap(item => { const key = keyById.get(String(item.permissionId)); return key ? [{ key, effect: item.effect, source: `role:${item.roleId}` }] : []; });
  const userEffects: PermissionEffect[] = overrides.flatMap(item => { const key = keyById.get(String(item.permissionId)); return key ? [{ key, effect: item.effect, source: "user-override" }] : []; });
  const resolved = resolvePermissionEffects(roleEffects, userEffects);
  const can = (permission: string) => superAdmin || resolved.can(permission);
  const effective = superAdmin ? ["*:*"] : permissionCatalog.map(item => item[0]).filter(can);
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, isDemo: Boolean(user.isDemo), organizationId: String(user.organizationId), organizationKind: organization.kind, superAdmin, roles: roles.map(role => role.slug), permissions: effective, can };
}

export function can(actor: AccessActor | null | undefined, permission: PermissionKey | string) { return Boolean(actor?.can(permission)); }

export async function requirePermission(userId: string, permission: PermissionKey, request?: Request) {
  const actor = await resolveEffectivePermissions(userId);
  if (actor?.can(permission)) return actor;
  await writeSecurityAudit({ actor, action: "authorization.denied", resource: permission.split(":")[0], targetType: "permission", targetId: permission, outcome: "denied", reason: `Missing ${permission}`, request }).catch(() => undefined);
  return null;
}

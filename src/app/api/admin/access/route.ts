import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { workspaceActor } from "@/lib/workspace-access";
import { ensureAccessControlForUser, resolveEffectivePermissions, writeSecurityAudit } from "@/lib/access-control";
import { isSameOrigin } from "@/lib/request-origin";
import { emailActionUrl, issueEmailToken } from "@/lib/email-tokens";
import { hasEmailProvider, sendEmail, staffInvitationEmail } from "@/lib/email";
import { Organization } from "@/models/Organization";
import { Permission } from "@/models/Permission";
import { AccessRole } from "@/models/AccessRole";
import { RolePermission } from "@/models/RolePermission";
import { UserRole } from "@/models/UserRole";
import { UserPermission } from "@/models/UserPermission";
import { AuthorizationAuditLog } from "@/models/AuthorizationAuditLog";
import { UserSession } from "@/models/UserSession";
import { SecurityAttempt } from "@/models/SecurityAttempt";
import { User } from "@/models/User";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const permissionKey = z.string().regex(/^[a-z*][a-z0-9-]*:[a-z*][a-z0-9-]*$/).max(80);
const roleFields = { name: z.string().trim().min(3).max(80), slug: z.string().trim().regex(/^[a-z][a-z0-9-]{1,39}$/), description: z.string().trim().min(20).max(300), parentRoleId: objectId.nullable(), permissionKeys: z.array(permissionKey).max(200) };
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite_staff"), name: z.string().trim().min(2).max(100), email: z.email().max(254), roleIds: z.array(objectId).min(1).max(10) }),
  z.object({ action: z.literal("assign_roles"), userId: objectId, roleIds: z.array(objectId).min(1).max(10), reason: z.string().trim().min(8).max(300) }),
  z.object({ action: z.literal("set_staff_status"), userId: objectId, status: z.enum(["active", "suspended", "deactivated"]), reason: z.string().trim().min(8).max(300) }),
  z.object({ action: z.literal("create_role"), ...roleFields }),
  z.object({ action: z.literal("update_role"), roleId: objectId, revision: z.number().int().min(0), ...roleFields }),
  z.object({ action: z.literal("clone_role"), roleId: objectId, name: z.string().trim().min(3).max(80), slug: z.string().trim().regex(/^[a-z][a-z0-9-]{1,39}$/) }),
  z.object({ action: z.literal("delete_role"), roleId: objectId, revision: z.number().int().min(0), reason: z.string().trim().min(8).max(300) }),
  z.object({ action: z.literal("set_override"), userId: objectId, permissionKey, effect: z.enum(["allow", "deny"]).nullable(), reason: z.string().trim().min(8).max(300) }),
]);

async function actorWith(permission: string, request?: Request) {
  const actor = await workspaceActor();
  if (actor?.organizationKind === "platform" && actor.can(permission)) return actor;
  await writeSecurityAudit({ actor, action: "authorization.denied", resource: permission.split(":")[0], targetType: "permission", targetId: permission, outcome: "denied", reason: `Missing ${permission}`, request }).catch(() => undefined);
  return null;
}

async function rateLimit(actorId: string) {
  const bucket = Math.floor(Date.now() / 60_000);
  const key = `access-control:${actorId}:${bucket}`;
  const row = await SecurityAttempt.findOneAndUpdate({ key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 60_000) } }, { upsert: true, returnDocument: "after" });
  return (row?.count ?? 0) <= 30;
}

async function ensureLegacyPlatformMembers(actor: NonNullable<Awaited<ReturnType<typeof workspaceActor>>>) {
  const legacy = await User.find({ organizationId: null, isDemo: actor.isDemo, role: { $in: ["admin", "staff"] } }).select("_id").limit(100).lean();
  for (const user of legacy) await ensureAccessControlForUser(String(user._id));
}

async function isLastActiveSuperAdmin(organizationId: string, userId: string) {
  const superRole = await AccessRole.findOne({ organizationId, superAdmin: true, status: "active" }).select("_id").lean();
  if (!superRole) return false;
  const assignedIds = await UserRole.distinct("userId", { organizationId, roleId: superRole._id });
  const activeIds = await User.distinct("_id", { _id: { $in: assignedIds }, organizationId, status: "active" });
  return activeIds.length === 1 && String(activeIds[0]) === userId;
}

async function createsInheritanceCycle(organizationId: string, roleId: string, parentRoleId: string | null) {
  if (!parentRoleId) return false;
  const roles = await AccessRole.find({ organizationId }).select("_id parentRoleId").lean();
  const parents = new Map(roles.map(role => [String(role._id), role.parentRoleId ? String(role.parentRoleId) : null]));
  let cursor: string | null = parentRoleId;
  const visited = new Set<string>();
  while (cursor && !visited.has(cursor)) {
    if (cursor === roleId) return true;
    visited.add(cursor);
    cursor = parents.get(cursor) ?? null;
  }
  return false;
}

export async function GET(request: Request) {
  const actor = await actorWith("access:read", request);
  if (!actor) return NextResponse.json({ error: "Access management permission required." }, { status: 403 });
  await ensureAccessControlForUser(actor.id);
  await ensureLegacyPlatformMembers(actor);
  const [organization, roles, permissions, links, assignments, overrides, staff, audits] = await Promise.all([
    Organization.findById(actor.organizationId).select("name slug kind status").lean(),
    AccessRole.find({ organizationId: actor.organizationId }).sort({ system: -1, name: 1 }).lean(),
    Permission.find({ active: true }).sort({ module: 1, resource: 1, action: 1 }).lean(),
    RolePermission.find({ organizationId: actor.organizationId }).lean(),
    UserRole.find({ organizationId: actor.organizationId }).lean(),
    UserPermission.find({ organizationId: actor.organizationId }).lean(),
    User.find({ organizationId: actor.organizationId, role: { $in: ["admin", "staff"] } }).select("name email status role lastActivityAt mfaEnrolledAt createdAt").sort({ createdAt: -1 }).lean(),
    AuthorizationAuditLog.find({ organizationId: actor.organizationId }).sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  const keyById = new Map(permissions.map(item => [String(item._id), item.key]));
  const staffRows = await Promise.all(staff.map(async user => {
    const effective = await resolveEffectivePermissions(String(user._id));
    return { id: String(user._id), name: user.name, email: user.email, status: user.status, legacyRole: user.role, roleIds: assignments.filter(item => String(item.userId) === String(user._id)).map(item => String(item.roleId)), overrides: overrides.filter(item => String(item.userId) === String(user._id)).map(item => ({ permissionKey: keyById.get(String(item.permissionId)), effect: item.effect, reason: item.reason })), effectivePermissions: effective?.permissions ?? [], superAdmin: Boolean(effective?.superAdmin), lastActivityAt: user.lastActivityAt?.toISOString() ?? null, mfaEnrolled: Boolean(user.mfaEnrolledAt), createdAt: user.createdAt.toISOString() };
  }));
  return NextResponse.json({ organization, actor: { id: actor.id, superAdmin: actor.superAdmin, permissions: actor.permissions }, permissions: permissions.map(item => ({ id: String(item._id), key: item.key, module: item.module, resource: item.resource, action: item.action, name: item.name, description: item.description, risk: item.risk })), roles: roles.map(role => ({ id: String(role._id), slug: role.slug, name: role.name, description: role.description, parentRoleId: role.parentRoleId ? String(role.parentRoleId) : null, system: role.system, superAdmin: role.superAdmin, status: role.status, revision: role.revision, permissionKeys: links.filter(item => String(item.roleId) === String(role._id) && item.effect === "allow").map(item => keyById.get(String(item.permissionId))).filter(Boolean) })), staff: staffRows, audits: audits.map(item => ({ id: String(item._id), actorId: item.actorId ? String(item.actorId) : null, action: item.action, resource: item.resource, targetType: item.targetType, targetId: item.targetId, outcome: item.outcome, reason: item.reason, createdAt: item.createdAt.toISOString() })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the access-control fields and try again." }, { status: 400 });
  const required = parsed.data.action === "invite_staff" ? "staff:create" : parsed.data.action === "assign_roles" ? "roles:assign" : parsed.data.action === "set_staff_status" ? "staff:update" : parsed.data.action === "set_override" ? "permissions:manage" : parsed.data.action === "delete_role" ? "roles:delete" : parsed.data.action === "create_role" || parsed.data.action === "clone_role" ? "roles:create" : "roles:update";
  const actor = await actorWith(required, request);
  if (!actor) return NextResponse.json({ error: `Permission required: ${required}` }, { status: 403 });
  if (!await rateLimit(actor.id)) return NextResponse.json({ error: "Too many sensitive access changes. Wait one minute and retry." }, { status: 429 });
  await connectDB();
  const organization = await Organization.findById(actor.organizationId).lean();
  if (!organization) return NextResponse.json({ error: "Organization unavailable." }, { status: 409 });
  try {
    if (parsed.data.action === "invite_staff") {
      if (!actor.superAdmin) return NextResponse.json({ error: "Only a Super Admin can invite staff." }, { status: 403 });
      const email = parsed.data.email.toLowerCase();
      if (await User.exists({ email })) return NextResponse.json({ error: "An account already uses this email." }, { status: 409 });
      const roles = await AccessRole.find({ _id: { $in: parsed.data.roleIds }, organizationId: actor.organizationId, status: "active" });
      if (roles.length !== parsed.data.roleIds.length || roles.some(role => role.superAdmin && !actor.superAdmin)) return NextResponse.json({ error: "One or more roles cannot be assigned." }, { status: 403 });
      if (!actor.isDemo && !await hasEmailProvider()) return NextResponse.json({ error: "Configure Resend and APP_URL before inviting live staff." }, { status: 503 });
      const passwordHash = await hash(randomBytes(32).toString("base64url"), 12);
      const user = await User.create({ organizationId: actor.organizationId, name: parsed.data.name, email, passwordHash, role: "staff", status: "invited", isDemo: actor.isDemo, invitedAt: new Date(), invitedBy: actor.id, mustChangePassword: true });
      await UserRole.insertMany(roles.map(role => ({ organizationId: actor.organizationId, userId: user._id, roleId: role._id, assignedBy: actor.id })));
      const token = await issueEmailToken(user._id, "invite", 48 * 60);
      const inviteUrl = emailActionUrl("/reset-password", token);
      if (!actor.isDemo) { const template = staffInvitationEmail(user.name, organization.name, inviteUrl); await sendEmail({ to: user.email, category: "staff_invite", eventKey: `staff-invite:${user.id}`, ...template }); }
      await writeSecurityAudit({ actor, action: "staff.invited", resource: "staff", targetType: "user", targetId: user.id, newValue: { email, roles: roles.map(role => role.slug) }, outcome: "success", request });
      return NextResponse.json({ ok: true, message: "Staff invitation created.", ...(actor.isDemo ? { inviteUrl } : {}) });
    }
    if (parsed.data.action === "assign_roles") {
      const target = await User.findOne({ _id: parsed.data.userId, organizationId: actor.organizationId, role: { $in: ["admin", "staff"] } });
      const roles = await AccessRole.find({ _id: { $in: parsed.data.roleIds }, organizationId: actor.organizationId, status: "active" });
      if (!target || roles.length !== parsed.data.roleIds.length) return NextResponse.json({ error: "Staff member or role unavailable in this organization." }, { status: 404 });
      if (String(target._id) === actor.id) return NextResponse.json({ error: "You cannot change your own role assignments." }, { status: 409 });
      if (roles.some(role => role.superAdmin) && !actor.superAdmin) return NextResponse.json({ error: "Only a Super Admin can grant Super Admin." }, { status: 403 });
      const targetAccess = await resolveEffectivePermissions(target.id);
      if (targetAccess?.superAdmin && !roles.some(role => role.superAdmin) && await isLastActiveSuperAdmin(actor.organizationId, target.id)) return NextResponse.json({ error: "The last active Super Admin cannot be demoted." }, { status: 409 });
      const previous = await UserRole.find({ organizationId: actor.organizationId, userId: target._id }).lean();
      await UserRole.deleteMany({ organizationId: actor.organizationId, userId: target._id });
      await UserRole.insertMany(roles.map(role => ({ organizationId: actor.organizationId, userId: target._id, roleId: role._id, assignedBy: actor.id })));
      await User.updateOne({ _id: target._id }, { $set: { role: roles.some(role => role.slug === "admin" || role.superAdmin) ? "admin" : "staff" }, $inc: { authVersion: 1 } });
      await UserSession.updateMany({ userId: target._id, status: "active" }, { $set: { status: "revoked", revokedAt: new Date() } });
      await writeSecurityAudit({ actor, action: "staff.roles_changed", resource: "roles", targetType: "user", targetId: target.id, previousValue: previous.map(item => String(item.roleId)), newValue: roles.map(role => role.slug), outcome: "success", reason: parsed.data.reason, request });
      return NextResponse.json({ ok: true, message: "Role assignments saved and active sessions revoked." });
    }
    if (parsed.data.action === "set_staff_status") {
      const target = await User.findOne({ _id: parsed.data.userId, organizationId: actor.organizationId, role: { $in: ["admin", "staff"] } });
      if (!target) return NextResponse.json({ error: "Staff member unavailable in this organization." }, { status: 404 });
      if (String(target._id) === actor.id) return NextResponse.json({ error: "You cannot change your own access status." }, { status: 409 });
      const targetAccess = await resolveEffectivePermissions(target.id);
      if (targetAccess?.superAdmin && !actor.superAdmin) return NextResponse.json({ error: "Only a Super Admin can change this account." }, { status: 403 });
      if (targetAccess?.superAdmin && parsed.data.status !== "active" && await isLastActiveSuperAdmin(actor.organizationId, target.id)) return NextResponse.json({ error: "The last active Super Admin cannot be suspended or deactivated." }, { status: 409 });
      const before = target.status;
      target.status = parsed.data.status; target.authVersion += 1; await target.save();
      await UserSession.updateMany({ userId: target._id, status: "active" }, { $set: { status: "revoked", revokedAt: new Date() } });
      await writeSecurityAudit({ actor, action: `staff.${parsed.data.status}`, resource: "staff", targetType: "user", targetId: target.id, previousValue: before, newValue: parsed.data.status, outcome: "success", reason: parsed.data.reason, request });
      return NextResponse.json({ ok: true, message: `Staff account ${parsed.data.status}.` });
    }
    if (parsed.data.action === "set_override") {
      if (!actor.superAdmin) return NextResponse.json({ error: "Only a Super Admin can grant direct overrides." }, { status: 403 });
      const target = await User.findOne({ _id: parsed.data.userId, organizationId: actor.organizationId }).select("_id").lean();
      const permission = await Permission.findOne({ key: parsed.data.permissionKey, active: true }).lean();
      if (!target || !permission) return NextResponse.json({ error: "Target or permission unavailable." }, { status: 404 });
      const previous = await UserPermission.findOne({ organizationId: actor.organizationId, userId: target._id, permissionId: permission._id }).lean();
      if (parsed.data.effect) await UserPermission.updateOne({ organizationId: actor.organizationId, userId: target._id, permissionId: permission._id }, { $set: { effect: parsed.data.effect, reason: parsed.data.reason, grantedBy: actor.id } }, { upsert: true });
      else await UserPermission.deleteOne({ organizationId: actor.organizationId, userId: target._id, permissionId: permission._id });
      await User.updateOne({ _id: target._id }, { $inc: { authVersion: 1 } });
      await writeSecurityAudit({ actor, action: "permission.override_changed", resource: "permissions", targetType: "user", targetId: String(target._id), previousValue: previous?.effect ?? null, newValue: parsed.data.effect, outcome: "success", reason: parsed.data.reason, request });
      return NextResponse.json({ ok: true, message: "Direct permission override updated." });
    }
    if (!actor.superAdmin) return NextResponse.json({ error: "Only a Super Admin can manage role definitions." }, { status: 403 });
    if (parsed.data.action === "clone_role") {
      const source = await AccessRole.findOne({ _id: parsed.data.roleId, organizationId: actor.organizationId });
      if (!source) return NextResponse.json({ error: "Source role unavailable." }, { status: 404 });
      const role = await AccessRole.create({ organizationId: actor.organizationId, slug: parsed.data.slug, name: parsed.data.name, description: `Clone of ${source.name}. ${source.description}`, parentRoleId: source.parentRoleId, system: false, superAdmin: false, createdBy: actor.id });
      const sourceLinks = await RolePermission.find({ organizationId: actor.organizationId, roleId: source._id }).lean();
      if (sourceLinks.length) await RolePermission.insertMany(sourceLinks.map(link => ({ organizationId: actor.organizationId, roleId: role._id, permissionId: link.permissionId, effect: link.effect, grantedBy: actor.id })));
      await writeSecurityAudit({ actor, action: "role.cloned", resource: "roles", targetType: "role", targetId: role.id, newValue: { slug: role.slug, source: source.slug }, outcome: "success", request });
      return NextResponse.json({ ok: true, message: "Role cloned." });
    }
    if (parsed.data.action === "delete_role") {
      const role = await AccessRole.findOne({ _id: parsed.data.roleId, organizationId: actor.organizationId });
      if (!role) return NextResponse.json({ error: "Role unavailable." }, { status: 404 });
      if (role.system) return NextResponse.json({ error: "System roles cannot be deleted." }, { status: 409 });
      if (role.revision !== parsed.data.revision) return NextResponse.json({ error: "Role changed. Refresh before deleting." }, { status: 409 });
      if (await UserRole.exists({ organizationId: actor.organizationId, roleId: role._id })) return NextResponse.json({ error: "Remove this role from all staff before deleting it." }, { status: 409 });
      await Promise.all([RolePermission.deleteMany({ organizationId: actor.organizationId, roleId: role._id }), AccessRole.deleteOne({ _id: role._id })]);
      await writeSecurityAudit({ actor, action: "role.deleted", resource: "roles", targetType: "role", targetId: role.id, previousValue: { slug: role.slug, name: role.name }, outcome: "success", reason: parsed.data.reason, request });
      return NextResponse.json({ ok: true, message: "Custom role deleted." });
    }
    const fields = parsed.data;
    const permissionRows = await Permission.find({ key: { $in: fields.permissionKeys }, active: true });
    if (permissionRows.length !== fields.permissionKeys.length) return NextResponse.json({ error: "One or more permission keys are invalid." }, { status: 400 });
    if (!actor.superAdmin && permissionRows.some(item => !actor.can(item.key))) return NextResponse.json({ error: "You cannot grant a permission you do not hold." }, { status: 403 });
    if (fields.parentRoleId && !await AccessRole.exists({ _id: fields.parentRoleId, organizationId: actor.organizationId, status: "active" })) return NextResponse.json({ error: "Parent role unavailable in this organization." }, { status: 400 });
    let role;
    let previous: unknown = null;
    if (fields.action === "create_role") role = await AccessRole.create({ organizationId: actor.organizationId, slug: fields.slug, name: fields.name, description: fields.description, parentRoleId: fields.parentRoleId, system: false, superAdmin: false, createdBy: actor.id });
    else {
      role = await AccessRole.findOne({ _id: fields.roleId, organizationId: actor.organizationId });
      if (!role) return NextResponse.json({ error: "Role unavailable." }, { status: 404 });
      if (role.system) return NextResponse.json({ error: "System roles are immutable. Clone one to customize it." }, { status: 409 });
      if (role.revision !== fields.revision) return NextResponse.json({ error: "Role changed. Refresh and retry." }, { status: 409 });
      if (fields.parentRoleId === role.id) return NextResponse.json({ error: "A role cannot inherit from itself." }, { status: 400 });
      if (await createsInheritanceCycle(actor.organizationId, role.id, fields.parentRoleId)) return NextResponse.json({ error: "That parent would create a role inheritance cycle." }, { status: 409 });
      previous = { name: role.name, description: role.description, parentRoleId: role.parentRoleId };
      role.name = fields.name; role.description = fields.description; role.set("parentRoleId", fields.parentRoleId); role.revision += 1; await role.save();
    }
    await RolePermission.deleteMany({ organizationId: actor.organizationId, roleId: role._id });
    if (permissionRows.length) await RolePermission.insertMany(permissionRows.map(permission => ({ organizationId: actor.organizationId, roleId: role._id, permissionId: permission._id, effect: "allow", grantedBy: actor.id })));
    await writeSecurityAudit({ actor, action: fields.action === "create_role" ? "role.created" : "role.updated", resource: "roles", targetType: "role", targetId: role.id, previousValue: previous, newValue: { slug: role.slug, name: role.name, permissions: fields.permissionKeys }, outcome: "success", request });
    return NextResponse.json({ ok: true, message: fields.action === "create_role" ? "Custom role created." : "Role updated." });
  } catch (error) {
    await writeSecurityAudit({ actor, action: `access.${parsed.data.action}.failed`, resource: "access", targetType: "operation", outcome: "failed", reason: error instanceof Error ? error.message : "Unknown failure", request }).catch(() => undefined);
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: "That email or role identifier is already in use." }, { status: 409 });
    console.error("Access control mutation failed", error);
    return NextResponse.json({ error: "The access change could not be completed." }, { status: 503 });
  }
}

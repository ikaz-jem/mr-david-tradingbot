# Access control and authorization

Enrivea uses deny-by-default, organization-scoped RBAC with optional per-user overrides. UI visibility is a convenience only: every protected read and mutation must authorize again on the server.

## Data model

- `Organization`: tenant/security boundary (`platform` or `customer`).
- `Permission`: normalized `resource:action` catalog entry.
- `AccessRole`: tenant-scoped system or custom role with optional parent role.
- `RolePermission`: normalized allow/deny link between roles and permissions.
- `UserRole`: tenant-scoped, optionally expiring role assignment.
- `UserPermission`: exceptional, optionally expiring direct allow/deny override with a reason.
- `UserSession`: tracked JWT session identifier, last activity, expiry and revocation state.
- `AuthorizationAuditLog`: append-only security event with actor, tenant, target, before/after values, outcome, reason, IP, user agent and request ID.

The legacy `User.role` field remains temporarily for migration and compatibility. It is not the authorization source of truth.

## Permission resolution

`resolveEffectivePermissions(userId)` in `src/lib/access-control.ts` resolves the current active user, organization, assignments, parent roles (maximum depth eight), role permissions and user overrides. Precedence is:

1. Direct user deny
2. Direct user allow
3. Role deny
4. Role allow
5. Default deny

`resource:manage` implies all actions for that resource. `*:*` is reserved for the protected Super Admin system role. Disabled users, organizations, roles and expired assignments are excluded.

## Server usage

For pages and route handlers, resolve the signed-in actor on the server:

```ts
const actor = await workspaceActor();
if (!actor?.can("billing:read")) notFound();
```

For APIs, return `403`, validate tenant ownership in the query itself, require same-origin protection for cookie-authenticated mutations, and write a security audit event for sensitive success, denial and failure outcomes.

Never trust a role, permission, organization ID, price, credit amount, or target user ID supplied by the browser. Never rely on hidden buttons as enforcement.

## Administration

`/admin/access` provides:

- invitation-based staff onboarding with a single-use, 48-hour password setup token;
- active/suspended/deactivated lifecycle controls;
- multi-role assignment and immediate session revocation;
- immutable system roles and cloneable custom roles;
- parent-role inheritance with cycle prevention;
- searchable permission editing and a role-permission matrix;
- direct user overrides, restricted to Super Admin;
- effective-access inspection and an append-only security audit viewer.

The last active Super Admin cannot be demoted, suspended or deactivated. Self role/status changes are blocked. Custom-role writes use optimistic revisions.

## Session lifecycle

NextAuth still uses signed JWTs, but each login creates a `UserSession` record. The JWT callback checks account status, verification, `authVersion`, session status and expiry. Permission snapshots refresh at least once per minute. Role/status/override changes increment `authVersion` and revoke tracked sessions; logout revokes its specific session. Activity writes are throttled to a five-minute cadence.

## Migration

Back up the database, then run:

```bash
npm run migrate:access
```

The migration is idempotent. It creates live/demo platform organizations, personal customer organizations, seeds the permission catalog and protected roles, sets `organizationId`, and maps legacy `admin`, `staff`, and `user` records to `super-admin`, `staff`, and `customer` assignments respectively.

Run `npm test`, `npm run typecheck`, and `npm run build` after migration. Keep the legacy role field until all deployment environments have migrated and all remaining compatibility reads have been retired.

## Adding a feature

1. Decide whether it reads or changes protected data.
2. Reuse or add a catalog permission in `access-control-catalog.ts`.
3. Assign it only to the least-privileged system roles that need it.
4. Gate the server page/API with `actor.can(...)`.
5. Include `organizationId` or ownership in every resource query where the data is tenant-owned.
6. Audit high-risk mutations with before/after values and a human reason.
7. Add allow, deny, cross-tenant and privilege-escalation tests.
8. Optionally use the same permission on navigation/UI controls; never treat that as the security boundary.

## Security notes

- Database credentials, exchange secrets and AI/payment keys are never represented as permissions or returned through the access APIs.
- Super Admin is a protected system role, not a string accepted from a client.
- Staff invitation errors avoid disclosing secrets; live invitations require a configured Resend provider.
- Audit records have no application update/delete endpoint. Database retention and export controls should be configured operationally.
- MFA fields and enforcement hooks are present, but an MFA provider/enrollment ceremony must be completed before claiming enforced MFA in production.

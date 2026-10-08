export type PermissionEffect = { key: string; effect: "allow" | "deny"; source: string };

export function permissionImplies(granted: string, requested: string) {
  if (granted === "*:*" || granted === requested) return true;
  const [grantedResource, grantedAction] = granted.split(":");
  const [requestedResource] = requested.split(":");
  return grantedResource === requestedResource && grantedAction === "manage";
}

export function sameTenant(actorOrganizationId: string | null | undefined, resourceOrganizationId: string | null | undefined) {
  return Boolean(actorOrganizationId && resourceOrganizationId && actorOrganizationId === resourceOrganizationId);
}

export function canGrantPermissions(actorPermissions: string[], requestedPermissions: string[]) {
  return requestedPermissions.every(requested => actorPermissions.some(granted => permissionImplies(granted, requested)));
}

export function resolvePermissionEffects(roleEffects: PermissionEffect[], userEffects: PermissionEffect[]) {
  const roleAllows = roleEffects.filter(item => item.effect === "allow").map(item => item.key);
  const roleDenies = roleEffects.filter(item => item.effect === "deny").map(item => item.key);
  const userAllows = userEffects.filter(item => item.effect === "allow").map(item => item.key);
  const userDenies = userEffects.filter(item => item.effect === "deny").map(item => item.key);
  const can = (permission: string) => {
    if (userDenies.some(key => permissionImplies(key, permission))) return false;
    if (userAllows.some(key => permissionImplies(key, permission))) return true;
    if (roleDenies.some(key => permissionImplies(key, permission))) return false;
    return roleAllows.some(key => permissionImplies(key, permission));
  };
  return { can, roleAllows, roleDenies, userAllows, userDenies };
}

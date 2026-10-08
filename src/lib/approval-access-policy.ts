type ScannerActor = { isDemo: boolean; organizationKind: string; can: (permission: string) => boolean };
export function canAccessLiveApprovalScanner(actor: ScannerActor | null | undefined, write = false) {
  return Boolean(actor && !actor.isDemo && actor.organizationKind === "platform" && actor.can(write ? "settings:update" : "settings:read"));
}

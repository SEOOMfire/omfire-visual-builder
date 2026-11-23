import type { Capability } from "../module-contract";

export type RoleScope = "platform" | "assigned_tenants" | "tenant";

export interface PlatformPrincipal {
  userId: string;
  email: string;
  displayName: string;
  tenantId: string;
  tenantSlug: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  roleScope: RoleScope;
  capabilities: ReadonlySet<Capability>;
}

export class CapabilityDeniedError extends Error {
  readonly status = 403;

  constructor(readonly capability: Capability) {
    super(`Missing required capability "${capability}".`);
    this.name = "CapabilityDeniedError";
  }
}

export function hasCapability(
  principal: Pick<PlatformPrincipal, "capabilities"> | null | undefined,
  capability: Capability,
): boolean {
  return principal?.capabilities.has(capability) ?? false;
}

export function requireCapability(
  principal: Pick<PlatformPrincipal, "capabilities"> | null | undefined,
  capability: Capability,
): void {
  if (!hasCapability(principal, capability)) throw new CapabilityDeniedError(capability);
}

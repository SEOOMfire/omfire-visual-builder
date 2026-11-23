import {
  CapabilityDeniedError,
  hasCapability,
  requireCapability,
  type PlatformPrincipal,
} from "../../../platform/auth/capabilities";
import type { Capability } from "../../../platform/module-contract";
import type { BuilderCapabilities } from "../types";

export const VISUAL_BUILDER_SLUG = "visual-builder";

export class VisualBuilderInputError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "VisualBuilderInputError";
    this.status = status;
  }
}

export function authorizeVisualBuilder(
  principal: PlatformPrincipal | null | undefined,
): asserts principal is PlatformPrincipal {
  if (!principal) throw new CapabilityDeniedError("visual-builder.read");
  requireCapability(principal, "visual-builder.read");
}

export function visualBuilderCaps(principal: PlatformPrincipal): BuilderCapabilities {
  return {
    create: hasCapability(principal, "visual-builder.create"),
    upload: hasCapability(principal, "visual-builder.upload"),
    configure: hasCapability(principal, "visual-builder.configure"),
    delete: hasCapability(principal, "visual-builder.delete"),
  };
}

export function requireVisualBuilderCapability(principal: PlatformPrincipal, action: keyof BuilderCapabilities): void {
  const capability = `visual-builder.${action}` as Capability;
  if (!hasCapability(principal, capability)) throw new CapabilityDeniedError(capability);
}

export function databaseContext(principal: PlatformPrincipal) {
  return { userId: principal.userId, tenantId: principal.tenantId };
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{5,200}$/;

export function requireUuid(value: unknown, message: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new VisualBuilderInputError(message);
  return value;
}

import "server-only";

import type { PlatformPrincipal } from "../auth/capabilities";
import { tenantQuery } from "../database/client";

export class ModuleUnavailableError extends Error {
  readonly status = 404;

  constructor() {
    super("Modul nicht verfügbar.");
    this.name = "ModuleUnavailableError";
  }
}

export async function requireEnabledModule(principal: PlatformPrincipal, slug: string): Promise<void> {
  const rows = await tenantQuery<{ enabled: boolean; customer_visible: boolean }>(
    { userId: principal.userId, tenantId: principal.tenantId },
    "select enabled, customer_visible from public.tenant_modules where tenant_id = $1 and module_slug = $2",
    [principal.tenantId, slug],
  );
  const row = rows[0];
  const internal = principal.roleScope === "platform" || principal.roleScope === "assigned_tenants";
  if (!row?.enabled || (!row.customer_visible && !internal)) throw new ModuleUnavailableError();
}

import "server-only";

import { NextResponse } from "next/server";
import { CapabilityDeniedError } from "../../../platform/auth/capabilities";
import { createAuthProvider } from "../../../platform/auth/server";
import { internalApiError } from "../../../platform/http/server-errors";
import { ModuleUnavailableError, requireEnabledModule } from "../../../platform/modules/tenant-module-status";
import { authorizeVisualBuilder, VISUAL_BUILDER_SLUG, VisualBuilderInputError } from "./access";

export async function visualBuilderPrincipal() {
  const provider = await createAuthProvider();
  const principal = await provider.loadPrincipal();
  authorizeVisualBuilder(principal);
  await requireEnabledModule(principal, VISUAL_BUILDER_SLUG);
  return principal;
}

export function visualBuilderApiError(request: Request, error: unknown, area: string) {
  if (error instanceof ModuleUnavailableError) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  if (error instanceof CapabilityDeniedError) return NextResponse.json({ error: "Dafür fehlt die Berechtigung." }, { status: 403 });
  if (error instanceof VisualBuilderInputError) return NextResponse.json({ error: error.message }, { status: error.status });
  return internalApiError(request, error, area);
}

import { randomBytes, createHash } from "node:crypto";
import type { PlatformPrincipal } from "../../../platform/auth/capabilities";
import type { Capability } from "../../../platform/module-contract";
import { runtimeQuery } from "../../../platform/database/client";
import { isDriveConfigured, driveParentFolderId } from "./drive";
import { storePreview } from "./previews";

const PING_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type TokenRow = { user_id: string; tenant_id: string; token_id: string };
type PrincipalRow = {
  user_id: string;
  email: string;
  display_name: string;
  tenant_id: string;
  tenant_slug: string;
  role_id: string;
  role_key: string;
  role_name: string;
  role_scope: PlatformPrincipal["roleScope"];
  capabilities: string[] | null;
};

export const MCP_INSTRUCTIONS = [
  "Ablauf: erst system_status, dann brand_assets des Kunden, dann compose_creative.",
  "Hinweise immer nennen. Vor save_creative nachfragen.",
  "Bei einer CSV immer erst check_batch, danach run_batch.",
  "Fehlt eine Kampagne, nachfragen und nichts raten.",
].join(" ");

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.match(/^Bearer\s+(\S+)/i)?.[1];
  return bearer || request.headers.get("x-api-key")?.trim() || null;
}

export function hashApiToken(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function newApiToken(): { secret: string; prefix: string; hash: string } {
  const secret = `vb_${randomBytes(24).toString("base64url")}`;
  return { secret, prefix: secret.slice(0, 12), hash: hashApiToken(secret) };
}

export async function principalFromToken(secret: string): Promise<PlatformPrincipal | null> {
  const resolved = await runtimeQuery<TokenRow>("select * from private.resolve_api_token($1)", [hashApiToken(secret)]);
  const token = resolved[0];
  if (!token) return null;
  const rows = await runtimeQuery<PrincipalRow>("select * from private.membership_principal($1, $2)", [token.user_id, token.tenant_id]);
  const person = rows[0];
  if (!person) return null;
  return {
    userId: person.user_id,
    email: person.email,
    displayName: person.display_name,
    tenantId: person.tenant_id,
    tenantSlug: person.tenant_slug,
    roleId: person.role_id,
    roleKey: person.role_key,
    roleName: person.role_name,
    roleScope: person.role_scope,
    capabilities: new Set((person.capabilities ?? []) as Capability[]),
  };
}

export function driveNextStep(): string {
  if (!isDriveConfigured()) return "Google Drive ist noch nicht verbunden. Trag GOOGLE_DRIVE_CLIENT_EMAIL und GOOGLE_DRIVE_PRIVATE_KEY in Coolify ein.";
  if (!process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim()) return "Der Ordner „Visual Builder“ fehlt. Trag GOOGLE_DRIVE_ROOT_FOLDER_ID in Coolify ein.";
  return "";
}

export async function systemStatus(): Promise<string> {
  const drive = isDriveConfigured();
  const root = Boolean(process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim() || driveParentFolderId());
  const router = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const lines = [
    drive ? "Google Drive ist verbunden." : "Google Drive ist noch nicht verbunden. Trag GOOGLE_DRIVE_CLIENT_EMAIL und GOOGLE_DRIVE_PRIVATE_KEY in Coolify ein.",
    root ? "Der Wurzelordner ist gesetzt." : "Der Ordner „Visual Builder“ fehlt. Trag GOOGLE_DRIVE_ROOT_FOLDER_ID in Coolify ein.",
    router ? "Übersetzung und Prüfung sind erreichbar." : "Übersetzung und Prüfung sind noch nicht freigeschaltet. Trag OPENROUTER_API_KEY in Coolify ein.",
  ];
  return lines.join(" ");
}

export async function pingImage(): Promise<{ base64: string; token: string | null; note: string }> {
  try {
    const token = await storePreview(`ping-${Date.now()}.png`, PING_PNG);
    return { base64: PING_PNG.toString("base64"), token, note: "Testbild, 1×1 Pixel." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Vorschau konnte nicht abgelegt werden.";
    return { base64: PING_PNG.toString("base64"), token: null, note: message };
  }
}

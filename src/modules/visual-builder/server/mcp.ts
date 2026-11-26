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
  "Gib Vorschauen immer als Markdown-Bild mit dem gelieferten Link aus.",
  "Nenne den Dateinamen des Motivs aus der Antwort.",
  "Ablauf: erst system_status, dann brand_assets des Kunden, dann compose_creative.",
  "Hinweise immer nennen. Vor save_creative nachfragen.",
  "Bei einer CSV immer erst check_batch, danach run_batch.",
  "Bei einem eingefügten Briefing die Angaben herausziehen: Gerät, Speicher, Zeitraum, Tarife, Einmalpreise, Altpreise, Monatspreise, Datenvolumen. Fehlende Pflichtangaben gezielt nachfragen: Monatspreis je Tarif, Datenvolumen, Kampagne oder Headline, Kanäle, Zielgruppe.",
  "Interne Begriffe wie SUB 10 oder OTC nie ins Motiv schreiben.",
  "Ist der neue Einmalpreis höher als der alte, nachfragen und nie statt verwenden.",
  "Aus einem freigegebenen Briefing eine CSV nach docs/CSV.md erzeugen, zur Freigabe zeigen, dann check_batch, dann run_batch.",
  "Für Dezember und Januar ist die Deko keine, solange keine Winter-Deko im Bestand liegt.",
  "Fehlt eine Kampagne, nachfragen und nichts raten.",
  "Änderungen an edit_creative geben, als Liste mit ziel, aktion, wert und optional formate. Den Satz selbst übersetzen. adjust_creative nur, wenn sich der Satz nicht übersetzen lässt; dann steht er unverändert in aenderung.text.",
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
  const { oteloStatus } = await import("./otelo-render");
  const status = await oteloStatus();
  return `${status} Änderungen am Motiv laufen über edit_creative. adjust_creative bleibt für freie Sätze. Die Liste steht in help_adjust.`;
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

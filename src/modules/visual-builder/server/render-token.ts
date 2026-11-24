import { createHash } from "node:crypto";

/** Shared with the render page. Derived from the runtime password so no extra secret is required. */
export function renderToken(): string {
  const explicit = process.env.RENDER_TOKEN?.trim();
  if (explicit) return explicit;
  const base = process.env.APP_RUNTIME_PASSWORD?.trim() || "";
  if (!base) return "";
  return createHash("sha256").update(`visual-builder-render:${base}`).digest("base64url");
}

export function renderAuthorized(header: string | null): boolean {
  const expected = renderToken();
  if (!expected || !header) return false;
  return header === expected;
}

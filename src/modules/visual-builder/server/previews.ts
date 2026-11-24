import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderToken } from "./render-token";

const DAY_MS = 24 * 60 * 60 * 1000;

function key(): string {
  const value = renderToken();
  if (!value) throw new Error("Vorschau-Links sind nicht freigegeben. APP_RUNTIME_PASSWORD fehlt.");
  return value;
}

export function signPreview(relativePath: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ p: relativePath, e: now + DAY_MS })).toString("base64url");
  const signature = createHmac("sha256", key()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readPreviewToken(token: string, now = Date.now()): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", key()).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { p?: string; e?: number };
  if (!body.p || !body.e || body.e < now) return null;
  if (body.p.includes("..") || body.p.startsWith("/")) return null;
  return body.p;
}

export async function storePreview(name: string, bytes: Buffer): Promise<string> {
  const root = process.env.FILE_STORAGE_ROOT?.trim();
  if (!root) throw new Error("FILE_STORAGE_ROOT fehlt.");
  const relative = `previews/${name}`;
  const path = join(root, relative);
  await mkdir(join(root, "previews"), { recursive: true });
  await writeFile(path, bytes);
  return signPreview(relative);
}

export async function loadPreview(token: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  const relative = readPreviewToken(token);
  if (!relative) return null;
  const root = process.env.FILE_STORAGE_ROOT?.trim();
  if (!root) return null;
  const bytes = await readFile(join(root, relative));
  const contentType = relative.endsWith(".png") ? "image/png" : relative.endsWith(".zip") ? "application/zip" : "image/jpeg";
  return { bytes, contentType };
}

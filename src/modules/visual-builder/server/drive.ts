import "server-only";

import { createSign } from "node:crypto";
import { closestFormat } from "../layout";
import type { DriveImage } from "../types";
import { DRIVE_ID_PATTERN, VisualBuilderInputError } from "./access";

/**
 * Google Drive through one OMfire service account. The key lives in the server
 * environment, never in the database; tenants only own folder IDs.
 */
export const DRIVE_CLIENT_EMAIL_VARIABLE = "GOOGLE_DRIVE_CLIENT_EMAIL";
export const DRIVE_PRIVATE_KEY_VARIABLE = "GOOGLE_DRIVE_PRIVATE_KEY";
/** Optional: shared-drive folder under which "Ordner anlegen" creates tenant folders. */
export const DRIVE_PARENT_FOLDER_VARIABLE = "GOOGLE_DRIVE_PARENT_FOLDER_ID";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const MAX_IMAGES = 3000;
const MAX_FOLDERS = 500;
const MAX_ANCESTRY_DEPTH = 12;

type Credentials = { clientEmail: string; privateKey: string };

let cachedToken: { token: string; expiresAt: number; email: string } | null = null;

function credentials(): Credentials | null {
  const clientEmail = process.env[DRIVE_CLIENT_EMAIL_VARIABLE]?.trim();
  const privateKey = process.env[DRIVE_PRIVATE_KEY_VARIABLE]?.trim().replace(/\\n/g, "\n");
  return clientEmail && privateKey ? { clientEmail, privateKey } : null;
}

export function isDriveConfigured(): boolean {
  return credentials() !== null;
}

export function driveParentFolderId(): string | null {
  const value = process.env[DRIVE_PARENT_FOLDER_VARIABLE]?.trim();
  return value && DRIVE_ID_PATTERN.test(value) ? value : null;
}

export function driveServiceAccountEmail(): string | null {
  return credentials()?.clientEmail ?? null;
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

async function accessToken(): Promise<string> {
  const creds = credentials();
  if (!creds) throw new VisualBuilderInputError("Google Drive ist noch nicht verbunden.", 503);
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.email === creds.clientEmail && cachedToken.expiresAt - 60 > now) return cachedToken.token;
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: creds.clientEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = signer.sign(creds.privateKey, "base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claim}.${signature}` }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new VisualBuilderInputError("Die Anmeldung bei Google Drive ist fehlgeschlagen.", 502);
  }
  const json = await response.json() as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: now + json.expires_in, email: creds.clientEmail };
  return json.access_token;
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  const response = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    signal: init.signal ?? AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 404) throw new VisualBuilderInputError("Der Drive-Ordner oder die Datei wurde nicht gefunden oder ist nicht freigegeben.", 404);
    if (response.status === 403 && /storageQuotaExceeded|do not have storage quota/i.test(body)) {
      throw new VisualBuilderInputError("Hochladen braucht einen Ordner in einer geteilten Ablage (Shared Drive).", 409);
    }
    if (response.status === 403) throw new VisualBuilderInputError("Für diesen Drive-Ordner fehlt die Freigabe.", 403);
    throw new VisualBuilderInputError(`Google Drive hat die Anfrage abgelehnt (${response.status}).`, 502);
  }
  return response;
}

function query(params: Record<string, string>): string {
  return new URLSearchParams({ supportsAllDrives: "true", ...params }).toString();
}

function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function driveFolderName(folderId: string): Promise<string> {
  const response = await driveFetch(`${API}/files/${encodeURIComponent(folderId)}?${query({ fields: "id,name,mimeType" })}`);
  const json = await response.json() as { name: string; mimeType: string };
  if (json.mimeType !== FOLDER_MIME) throw new VisualBuilderInputError("Die ID gehört nicht zu einem Ordner.");
  return json.name;
}

export async function createDriveFolder(name: string, parentId: string): Promise<string> {
  const response = await driveFetch(`${API}/files?${query({ fields: "id" })}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  return ((await response.json()) as { id: string }).id;
}

/** All images below the folder, including subfolders, with pixel sizes. */
export async function listDriveImages(rootId: string): Promise<{ images: Omit<DriveImage, "override">[]; error: string | null }> {
  const images: Omit<DriveImage, "override">[] = [];
  const queue: Array<{ id: string; path: string }> = [{ id: rootId, path: "" }];
  const seen = new Set<string>();
  try {
    while (queue.length && images.length < MAX_IMAGES && seen.size < MAX_FOLDERS) {
      const folder = queue.shift()!;
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      let pageToken: string | undefined;
      do {
        const params: Record<string, string> = {
          q: `'${escapeQueryValue(folder.id)}' in parents and (mimeType='${FOLDER_MIME}' or mimeType contains 'image/') and trashed=false`,
          pageSize: "1000",
          fields: "nextPageToken,files(id,name,mimeType,thumbnailLink,imageMediaMetadata(width,height,rotation))",
          includeItemsFromAllDrives: "true",
        };
        if (pageToken) params.pageToken = pageToken;
        const json = await (await driveFetch(`${API}/files?${query(params)}`)).json() as {
          nextPageToken?: string;
          files?: Array<{ id: string; name: string; mimeType: string; thumbnailLink?: string; imageMediaMetadata?: { width?: number; height?: number; rotation?: number } }>;
        };
        for (const file of json.files ?? []) {
          if (file.mimeType === FOLDER_MIME) {
            queue.push({ id: file.id, path: folder.path ? `${folder.path}/${file.name}` : file.name });
            continue;
          }
          let width = file.imageMediaMetadata?.width ?? 0;
          let height = file.imageMediaMetadata?.height ?? 0;
          const rotation = file.imageMediaMetadata?.rotation ?? 0;
          if (rotation === 1 || rotation === 3) [width, height] = [height, width];
          images.push({ id: file.id, name: file.name, folder: folder.path, width, height, thumb: file.thumbnailLink ?? null });
        }
        pageToken = json.nextPageToken;
      } while (pageToken);
    }
  } catch (error) {
    return { images, error: error instanceof VisualBuilderInputError ? error.message : "Google Drive konnte nicht gelesen werden." };
  }
  images.sort((left, right) => left.name.localeCompare(right.name));
  return { images, error: null };
}

/**
 * The service account may see other tenants' folders, so every file request
 * must prove that the file lies below one of the caller's library folders.
 */
export async function assertInsideFolders(fileId: string, allowedFolderIds: ReadonlySet<string>): Promise<{ mimeType: string; name: string }> {
  if (!DRIVE_ID_PATTERN.test(fileId)) throw new VisualBuilderInputError("Die Datei ist ungültig.");
  const meta = await (await driveFetch(`${API}/files/${encodeURIComponent(fileId)}?${query({ fields: "id,name,mimeType,parents" })}`)).json() as {
    name: string; mimeType: string; parents?: string[];
  };
  let frontier = meta.parents ?? [];
  for (let depth = 0; depth < MAX_ANCESTRY_DEPTH && frontier.length; depth += 1) {
    if (frontier.some((id) => allowedFolderIds.has(id))) return { mimeType: meta.mimeType, name: meta.name };
    const next: string[] = [];
    for (const parentId of frontier) {
      const parent = await (await driveFetch(`${API}/files/${encodeURIComponent(parentId)}?${query({ fields: "parents" })}`)).json() as { parents?: string[] };
      next.push(...(parent.parents ?? []));
    }
    frontier = next;
  }
  throw new VisualBuilderInputError("Die Datei liegt nicht in einer Bibliothek dieses Mandanten.", 404);
}

export async function driveImageStream(fileId: string): Promise<Response> {
  return driveFetch(`${API}/files/${encodeURIComponent(fileId)}?${query({ alt: "media" })}`, { signal: AbortSignal.timeout(60_000) });
}

export async function uploadDriveImage(input: { folderId: string; name: string; contentType: string; bytes: Uint8Array }): Promise<{ id: string; name: string }> {
  const boundary = `vb${crypto.randomUUID().replaceAll("-", "")}`;
  const metadata = JSON.stringify({ name: input.name, parents: [input.folderId] });
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${input.contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--`);
  const response = await driveFetch(`${UPLOAD_API}/files?${query({ uploadType: "multipart", fields: "id,name" })}`, {
    method: "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body: Buffer.concat([head, Buffer.from(input.bytes), tail]),
    signal: AbortSignal.timeout(60_000),
  });
  return await response.json() as { id: string; name: string };
}

export function autoFormatOf(image: Pick<DriveImage, "width" | "height">) {
  return closestFormat(image.width && image.height ? image.width / image.height : 1);
}

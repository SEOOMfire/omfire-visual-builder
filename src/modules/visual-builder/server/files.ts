import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { PlatformPrincipal } from "../../../platform/auth/capabilities";
import { tenantQuery } from "../../../platform/database/client";
import { createFileStorage } from "../../../platform/storage/server";
import { databaseContext, VisualBuilderInputError } from "./access";

export const MAX_ASSET_BYTES = 4 * 1024 * 1024;
export const UPLOAD_PART_MAX_BYTES = 3 * 1024 * 1024;
export const MAX_UPLOAD_PARTS = 16;

export function safeFilename(value: string, fallback = "datei"): string {
  const normalized = value.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 120) || fallback;
}

export async function storeModuleFile(
  principal: PlatformPrincipal,
  input: { area: string; filename: string; contentType: string; bytes: Uint8Array },
): Promise<string> {
  const fileId = randomUUID();
  const filename = safeFilename(input.filename);
  const storageKey = `${principal.tenantId}/${new Date().getUTCFullYear()}/visual-builder/${input.area}/${fileId}-${filename}`;
  const storage = createFileStorage();
  await storage.put(storageKey, input.bytes);
  try {
    await tenantQuery(
      databaseContext(principal),
      `insert into public.file_objects
         (id, tenant_id, storage_key, original_filename, content_type, byte_size, checksum, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        fileId,
        principal.tenantId,
        storageKey,
        filename,
        input.contentType.toLowerCase(),
        input.bytes.byteLength,
        createHash("sha256").update(input.bytes).digest("hex"),
        principal.userId,
      ],
    );
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
  return fileId;
}

export async function retireModuleFiles(principal: PlatformPrincipal, fileIds: ReadonlyArray<string | null | undefined>): Promise<void> {
  const ids = fileIds.filter((id): id is string => Boolean(id));
  if (!ids.length) return;
  const rows = await tenantQuery<{ storage_key: string }>(
    databaseContext(principal),
    `update public.file_objects set deleted_at = now()
     where tenant_id = $1 and id = any($2::uuid[]) and deleted_at is null
     returning storage_key`,
    [principal.tenantId, ids],
  );
  const storage = createFileStorage();
  for (const row of rows) {
    await storage.delete(row.storage_key).catch(() => undefined);
  }
}

export async function readModuleFile(principal: PlatformPrincipal, fileId: string): Promise<{ bytes: Uint8Array; contentType: string; filename: string }> {
  const rows = await tenantQuery<{ storage_key: string; content_type: string; original_filename: string }>(
    databaseContext(principal),
    `select storage_key, content_type, original_filename from public.file_objects
     where tenant_id = $1 and id = $2 and deleted_at is null limit 1`,
    [principal.tenantId, fileId],
  );
  const row = rows[0];
  if (!row || !row.storage_key.startsWith(`${principal.tenantId}/`)) throw new VisualBuilderInputError("Datei nicht gefunden.", 404);
  return { bytes: await createFileStorage().read(row.storage_key), contentType: row.content_type, filename: row.original_filename };
}

function stagingPrefix(principal: PlatformPrincipal, uploadId: string): string {
  return `${principal.tenantId}/visual-builder/staging/${principal.userId}/${uploadId}`;
}

/** Large exports arrive in parts, because a single request body is capped by the host. */
export async function storeUploadPart(principal: PlatformPrincipal, uploadId: string, part: number, bytes: Uint8Array): Promise<void> {
  if (!Number.isInteger(part) || part < 0 || part >= MAX_UPLOAD_PARTS) throw new VisualBuilderInputError("Der Upload-Teil ist ungültig.");
  if (bytes.byteLength === 0 || bytes.byteLength > UPLOAD_PART_MAX_BYTES) throw new VisualBuilderInputError("Der Upload-Teil ist zu groß.");
  await createFileStorage().put(`${stagingPrefix(principal, uploadId)}/${part}`, bytes);
}

export async function assembleUpload(
  principal: PlatformPrincipal,
  input: { uploadId: string; parts: number; byteSize: number; sha256: string },
): Promise<Uint8Array> {
  if (!Number.isInteger(input.parts) || input.parts < 1 || input.parts > MAX_UPLOAD_PARTS) throw new VisualBuilderInputError("Der Upload ist unvollständig.");
  const storage = createFileStorage();
  const prefix = stagingPrefix(principal, input.uploadId);
  const chunks: Uint8Array[] = [];
  for (let part = 0; part < input.parts; part += 1) {
    chunks.push(await storage.read(`${prefix}/${part}`).catch(() => {
      throw new VisualBuilderInputError("Der Upload ist unvollständig. Bitte erneut speichern.");
    }));
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (total !== input.byteSize || createHash("sha256").update(bytes).digest("hex") !== input.sha256) {
    throw new VisualBuilderInputError("Der Upload ist beschädigt. Bitte erneut speichern.");
  }
  return bytes;
}

/** Removes this upload and stale leftovers of aborted saves; no scheduled cleanup exists. */
export async function clearStaging(principal: PlatformPrincipal, uploadId: string): Promise<void> {
  const storage = createFileStorage();
  const current = `${stagingPrefix(principal, uploadId)}/`;
  const staleBefore = Date.now() - 60 * 60 * 1000;
  const files = await storage.list(`${principal.tenantId}/visual-builder/staging/${principal.userId}`).catch(() => []);
  for (const file of files) {
    if (file.key.startsWith(current) || Date.parse(file.modifiedAt) < staleBefore) {
      await storage.delete(file.key).catch(() => undefined);
    }
  }
}

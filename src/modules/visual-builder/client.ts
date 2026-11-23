"use client";

import type { ArchiveEntry, Bootstrap, DriveListing, Fmt, Locale, Violation } from "./types";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new ApiError(body?.error || "Die Anfrage ist fehlgeschlagen.", response.status);
  return body as T;
}

export async function getJson<T>(url: string): Promise<T> {
  return parse<T>(await fetch(url, { credentials: "same-origin", cache: "no-store" }));
}

export async function action<T = { ok: true }>(name: string, payload: Record<string, unknown> = {}): Promise<T> {
  return parse<T>(await fetch("/api/visual-builder", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, action: name }),
  }));
}

export async function postForm<T = { ok: true }>(url: string, form: FormData): Promise<T> {
  return parse<T>(await fetch(url, { method: "POST", credentials: "same-origin", body: form }));
}

export const api = {
  bootstrap: () => getJson<Bootstrap>("/api/visual-builder"),
  guideline: () => getJson<{ text: string; filename: string | null; updatedAt: string | null }>("/api/visual-builder?view=guideline"),
  creativeState: (id: string) => getJson<{ state: unknown }>(`/api/visual-builder?creative=${encodeURIComponent(id)}`),
  library: (libraryId: string | null) => getJson<DriveListing>(`/api/visual-builder/drive?library=${encodeURIComponent(libraryId ?? "")}`),
  creatives: () => getJson<{ creatives: ArchiveEntry[] }>("/api/visual-builder/creatives"),
  translate: (items: Array<{ key: string; text: string; isHtml: boolean }>, targetLang: string, targetLabel: string) =>
    action<{ translations: Record<string, string> }>("translate", { items, targetLang, targetLabel }),
  check: (text: string, locale: Locale) => action<{ ok: boolean; violations: Violation[]; checkId: string | null }>("check", { text, locale }),
  setImageFormat: (fileId: string, format: Fmt | null) => action("image.format", { fileId, format }),
  deleteCreative: (id: string) => action<{ deleted: boolean }>("creative.delete", { id }),
};

export const driveImageUrl = (id: string) => `/api/visual-builder/drive?image=${encodeURIComponent(id)}`;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    image.src = src;
  });
}

const PART_BYTES = 3 * 1024 * 1024 - 64 * 1024;

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Sends a large file in parts below the hosting request limit. */
export async function uploadInParts(blob: Blob): Promise<{ id: string; parts: number; byteSize: number; sha256: string }> {
  const buffer = await blob.arrayBuffer();
  const id = crypto.randomUUID();
  const parts = Math.max(1, Math.ceil(buffer.byteLength / PART_BYTES));
  for (let part = 0; part < parts; part += 1) {
    const chunk = buffer.slice(part * PART_BYTES, Math.min(buffer.byteLength, (part + 1) * PART_BYTES));
    await parse(await fetch(`/api/visual-builder/files?upload=${id}&part=${part}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/octet-stream" },
      body: chunk,
    }));
  }
  return { id, parts, byteSize: buffer.byteLength, sha256: await sha256Hex(buffer) };
}

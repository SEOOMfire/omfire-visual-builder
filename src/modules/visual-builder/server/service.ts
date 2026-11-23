import "server-only";

import type { PlatformPrincipal } from "../../../platform/auth/capabilities";
import { tenantQuery } from "../../../platform/database/client";
import { canDownloadArchivedCreative } from "../approval";
import { BADGE_SHAPES, DEFAULT_BADGE_LINES, MAX_BADGE_LINES, decodeBadgeLines, encodeBadgeLines, isCtaShape, normalizeBadgeColors, normalizeBadgeLine, normalizeBrand } from "../brand";
import { FORMAT_IDS, isFormat, isValidRect } from "../layout";
import type {
  ArchiveEntry,
  BadgeAsset,
  BadgeLine,
  BadgeShape,
  Bootstrap,
  StickerAsset,
  CtaAsset,
  DriveListing,
  ExampleAsset,
  Fmt,
  FontAsset,
  GuidelineStatus,
  Language,
  Library,
  LogoAsset,
  Rect,
} from "../types";
import {
  databaseContext,
  DRIVE_ID_PATTERN,
  requireUuid,
  requireVisualBuilderCapability,
  visualBuilderCaps,
  VisualBuilderInputError,
} from "./access";
import {
  assertInsideFolders,
  createDriveFolder,
  driveFolderName,
  driveImageStream,
  driveParentFolderId,
  driveServiceAccountEmail,
  isDriveConfigured,
  listDriveImages,
  uploadDriveImage,
} from "./drive";
import {
  assembleUpload,
  clearStaging,
  MAX_ASSET_BYTES,
  retireModuleFiles,
  storeModuleFile,
} from "./files";
import { parseFolderId } from "./parse";

const ctx = databaseContext;

export const DEFAULT_LANGUAGES: ReadonlyArray<{ code: string; label: string }> = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "Englisch" },
  { code: "fr", label: "Französisch" },
  { code: "es", label: "Spanisch" },
  { code: "it", label: "Italienisch" },
  { code: "nl", label: "Niederländisch" },
  { code: "da", label: "Dänisch" },
  { code: "fi", label: "Finnisch" },
  { code: "pl", label: "Polnisch" },
];

export const assetUrl = (id: string) => `/api/visual-builder/files?asset=${id}`;
const creativeFileUrl = (id: string, part: string) => `/api/visual-builder/files?creative=${id}&part=${part}`;

type AssetRow = {
  id: string;
  kind: "logo" | "cta" | "font" | "example" | "badge" | "sticker";
  name: string;
  variant: string;
  file_id: string | null;
  cta_text: string | null;
  style: Record<string, unknown>;
  font_family: string | null;
  font_weight: number | null;
};

function styleNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 20000 ? Math.round(parsed) : 0;
}

function styleString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export async function loadBootstrap(principal: PlatformPrincipal): Promise<Bootstrap> {
  const [settings, languages, assets, zones, libraries, guidelines] = await Promise.all([
    tenantQuery<{ default_font: string | null; brand: unknown }>(ctx(principal),
      `select default_font, brand from public.visual_builder_settings where tenant_id = $1`, [principal.tenantId]),
    listLanguages(principal),
    tenantQuery<AssetRow>(ctx(principal),
      `select id, kind, name, variant, file_id, cta_text, style, font_family, font_weight
       from public.visual_builder_assets where tenant_id = $1 order by created_at desc`, [principal.tenantId]),
    tenantQuery<{ format: string; rect: unknown }>(ctx(principal),
      `select format, rect from public.visual_builder_safe_zones where tenant_id = $1`, [principal.tenantId]),
    listLibraries(principal),
    tenantQuery<{ present: boolean }>(ctx(principal),
      `select char_length(content_text) > 0 as present from public.visual_builder_guidelines where tenant_id = $1`, [principal.tenantId]),
  ]);
  const logos: LogoAsset[] = [];
  const ctas: CtaAsset[] = [];
  const fonts: FontAsset[] = [];
  const examples: ExampleAsset[] = [];
  const badges: BadgeAsset[] = [];
  const stickers: StickerAsset[] = [];
  for (const row of assets) {
    if (row.kind === "sticker" && row.file_id) {
      stickers.push({ id: row.id, name: row.name, url: assetUrl(row.id) });
    } else if (row.kind === "logo" && row.file_id) {
      logos.push({ id: row.id, name: row.name, variant: row.variant === "wide" ? "wide" : "square", url: assetUrl(row.id) });
    } else if (row.kind === "cta") {
      ctas.push({
        id: row.id,
        name: row.name,
        variant: row.variant === "graphic" ? "graphic" : "text",
        text: row.cta_text,
        style: {
          bg_color: styleString(row.style?.bg_color, 20),
          text_color: styleString(row.style?.text_color, 20),
          font_family: styleString(row.style?.font_family, 80),
          shape: isCtaShape(row.style?.shape) ? row.style.shape : null,
          border_color: styleString(row.style?.border_color, 20),
        },
        url: row.file_id ? assetUrl(row.id) : null,
      });
    } else if (row.kind === "font" && row.file_id && row.font_family) {
      fonts.push({
        id: row.id,
        name: row.name,
        family: row.font_family,
        weight: row.font_weight ?? 400,
        style: row.variant === "italic" ? "italic" : "normal",
        url: assetUrl(row.id),
      });
    } else if (row.kind === "example" && row.file_id) {
      examples.push({
        id: row.id,
        name: row.name,
        url: assetUrl(row.id),
        width: styleNumber(row.style?.width),
        height: styleNumber(row.style?.height),
        cutout: row.style?.cutout === "1",
      });
    } else if (row.kind === "badge" && (BADGE_SHAPES as readonly string[]).includes(row.variant)) {
      const shape = row.variant as BadgeShape;
      const lines = decodeBadgeLines(row.cta_text);
      badges.push({ id: row.id, name: row.name, shape, lines: lines.length ? lines : DEFAULT_BADGE_LINES[shape], colors: normalizeBadgeColors(row.style) });
    }
  }
  const safeZones: Partial<Record<Fmt, Rect>> = {};
  for (const zone of zones) {
    if (isFormat(zone.format) && isValidRect(zone.rect)) safeZones[zone.format] = zone.rect;
  }
  const capabilities = visualBuilderCaps(principal);
  return {
    capabilities,
    driveConfigured: isDriveConfigured(),
    driveServiceAccount: capabilities.configure ? driveServiceAccountEmail() : null,
    driveCanCreateFolders: capabilities.configure && isDriveConfigured() && Boolean(driveParentFolderId()),
    defaultFont: settings[0]?.default_font ?? null,
    brand: normalizeBrand(settings[0]?.brand),
    languages,
    logos,
    ctas,
    badges,
    stickers,
    fonts,
    examples,
    safeZones,
    libraries,
    hasGuidelines: Boolean(guidelines[0]?.present),
  };
}

/* ---------- Languages ---------- */

export async function listLanguages(principal: PlatformPrincipal): Promise<Language[]> {
  return tenantQuery<Language>(ctx(principal),
    `select id, code, label, active from public.visual_builder_languages where tenant_id = $1 order by label`, [principal.tenantId]);
}

export async function saveLanguage(principal: PlatformPrincipal, input: { id?: unknown; code?: unknown; label?: unknown; active?: unknown }) {
  requireVisualBuilderCapability(principal, "configure");
  const code = String(input.code ?? "").trim();
  const label = String(input.label ?? "").trim();
  if (!/^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8}){0,2}$/.test(code)) throw new VisualBuilderInputError("Das Sprachkürzel ist ungültig (z. B. fr oder fr-FR).");
  if (!label || label.length > 80) throw new VisualBuilderInputError("Bitte eine Bezeichnung angeben.");
  const active = typeof input.active === "boolean" ? input.active : true;
  if (input.id) {
    const id = requireUuid(input.id, "Die Sprache ist ungültig.");
    await tenantQuery(ctx(principal),
      `update public.visual_builder_languages set code = $3, label = $4, active = $5 where tenant_id = $1 and id = $2`,
      [principal.tenantId, id, code, label, active]);
    return;
  }
  await tenantQuery(ctx(principal),
    `insert into public.visual_builder_languages (tenant_id, code, label, active) values ($1,$2,$3,$4)
     on conflict (tenant_id, code) do update set label = excluded.label, active = excluded.active`,
    [principal.tenantId, code, label, active]);
}

export async function deleteLanguage(principal: PlatformPrincipal, id: unknown) {
  requireVisualBuilderCapability(principal, "configure");
  await tenantQuery(ctx(principal), `delete from public.visual_builder_languages where tenant_id = $1 and id = $2`,
    [principal.tenantId, requireUuid(id, "Die Sprache ist ungültig.")]);
}

export async function seedDefaultLanguages(principal: PlatformPrincipal) {
  requireVisualBuilderCapability(principal, "configure");
  for (const language of DEFAULT_LANGUAGES) {
    await tenantQuery(ctx(principal),
      `insert into public.visual_builder_languages (tenant_id, code, label) values ($1,$2,$3) on conflict (tenant_id, code) do nothing`,
      [principal.tenantId, language.code, language.label]);
  }
}

/* ---------- Assets: logos, buttons, fonts ---------- */

const IMAGE_TYPES = new Map<string, readonly string[]>([
  ["image/png", ["png"]],
  ["image/jpeg", ["jpg", "jpeg"]],
  ["image/webp", ["webp"]],
  ["image/svg+xml", ["svg"]],
]);
const FONT_EXTENSIONS: Record<string, string> = { otf: "font/otf", ttf: "font/ttf", woff: "font/woff", woff2: "font/woff2" };

function extensionOf(filename: string): string {
  return filename.split(".").at(-1)?.toLowerCase() ?? "";
}

function validateImage(file: File): string {
  const type = (file.type || "").toLowerCase();
  if (!IMAGE_TYPES.get(type)?.includes(extensionOf(file.name))) throw new VisualBuilderInputError("Bitte PNG, JPG, WebP oder SVG hochladen.");
  if (file.size <= 0 || file.size > MAX_ASSET_BYTES) throw new VisualBuilderInputError("Die Datei ist zu groß (max. 4 MB).");
  return type;
}

function validateFont(file: File): string {
  const type = FONT_EXTENSIONS[extensionOf(file.name)];
  if (!type) throw new VisualBuilderInputError("Bitte eine Schriftdatei (OTF, TTF, WOFF, WOFF2) hochladen.");
  if (file.size <= 0 || file.size > MAX_ASSET_BYTES) throw new VisualBuilderInputError("Die Datei ist zu groß (max. 4 MB).");
  return type;
}

function text(form: FormData, key: string, max: number): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function color(form: FormData, key: string): string | null {
  const value = text(form, key, 20);
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : null;
}

export async function createAsset(principal: PlatformPrincipal, form: FormData): Promise<void> {
  requireVisualBuilderCapability(principal, "configure");
  const kind = text(form, "kind", 10);
  const file = form.get("file");
  const upload = file instanceof File && file.size > 0 ? file : null;
  let name = text(form, "name", 120);
  let variant: string;
  let fileId: string | null = null;
  let ctaText: string | null = null;
  let style: Record<string, string | null> = {};
  let fontFamily: string | null = null;
  let fontWeight: number | null = null;

  if (kind === "sticker") {
    if (!upload) throw new VisualBuilderInputError("Bitte eine Grafik wählen.");
    variant = "image";
    const type = validateImage(upload);
    name ||= upload.name.replace(/\.[^.]+$/, "");
    fileId = await storeModuleFile(principal, { area: "stickers", filename: upload.name, contentType: type, bytes: new Uint8Array(await upload.arrayBuffer()) });
  } else if (kind === "logo") {
    if (!upload) throw new VisualBuilderInputError("Bitte eine Logo-Datei wählen.");
    variant = text(form, "variant", 10) === "wide" ? "wide" : "square";
    const type = validateImage(upload);
    name ||= upload.name.replace(/\.[^.]+$/, "");
    fileId = await storeModuleFile(principal, { area: "logos", filename: upload.name, contentType: type, bytes: new Uint8Array(await upload.arrayBuffer()) });
  } else if (kind === "cta") {
    variant = text(form, "variant", 10) === "graphic" ? "graphic" : "text";
    if (!name) throw new VisualBuilderInputError("Bitte einen Namen angeben.");
    if (variant === "graphic") {
      if (!upload) throw new VisualBuilderInputError("Bitte eine Grafik wählen.");
      const type = validateImage(upload);
      fileId = await storeModuleFile(principal, { area: "ctas", filename: upload.name, contentType: type, bytes: new Uint8Array(await upload.arrayBuffer()) });
    } else {
      ctaText = text(form, "text", 200) || null;
      const shape = text(form, "shape", 10);
      style = {
        bg_color: color(form, "bg_color"),
        text_color: color(form, "text_color"),
        font_family: text(form, "font_family", 80) || null,
        shape: isCtaShape(shape) ? shape : null,
        border_color: color(form, "border_color"),
      };
    }
  } else if (kind === "badge") {
    variant = text(form, "variant", 12);
    if (!(BADGE_SHAPES as readonly string[]).includes(variant)) throw new VisualBuilderInputError("Bitte eine Form wählen.");
    if (!name) throw new VisualBuilderInputError("Bitte einen Namen angeben.");
    let lines: BadgeLine[] = [];
    try {
      const parsed = JSON.parse(text(form, "lines", 3000) || "[]") as unknown;
      lines = (Array.isArray(parsed) ? parsed : []).slice(0, MAX_BADGE_LINES)
        .map((entry) => normalizeBadgeLine(entry, 40)).filter((line): line is BadgeLine => line !== null && line.text.trim() !== "");
    } catch {
      throw new VisualBuilderInputError("Die Zeilen sind ungültig.");
    }
    if (encodeBadgeLines(lines).length > 200) throw new VisualBuilderInputError("Zu viel Text für eine Vorlage (höchstens 200 Zeichen). Längere Texte lassen sich im Editor eintragen.");
    ctaText = encodeBadgeLines(lines) || null;
    style = {
      bg_color: color(form, "bg_color"),
      text_color: color(form, "text_color"),
      accent_bg: color(form, "accent_bg"),
      accent_fg: color(form, "accent_fg"),
      border_color: color(form, "border_color"),
    };
  } else if (kind === "font") {
    if (!upload) throw new VisualBuilderInputError("Bitte eine Schriftdatei wählen.");
    fontFamily = text(form, "family", 80);
    if (!fontFamily || /["\\;{}]/.test(fontFamily)) throw new VisualBuilderInputError("Bitte einen gültigen Schriftnamen angeben.");
    const weight = Number(text(form, "weight", 4) || 400);
    if (!Number.isInteger(weight) || weight < 100 || weight > 900 || weight % 100 !== 0) throw new VisualBuilderInputError("Die Strichstärke ist ungültig.");
    fontWeight = weight;
    variant = text(form, "style", 10) === "italic" ? "italic" : "normal";
    name ||= upload.name.replace(/\.[^.]+$/, "");
    const type = validateFont(upload);
    fileId = await storeModuleFile(principal, { area: "fonts", filename: upload.name, contentType: type, bytes: new Uint8Array(await upload.arrayBuffer()) });
  } else if (kind === "example") {
    if (!upload) throw new VisualBuilderInputError("Bitte eine Bilddatei wählen.");
    variant = "image";
    const type = validateImage(upload);
    name ||= upload.name.replace(/\.[^.]+$/, "");
    const width = Number(text(form, "width", 6));
    const height = Number(text(form, "height", 6));
    style = {
      width: Number.isFinite(width) && width > 0 ? String(Math.round(width)) : null,
      height: Number.isFinite(height) && height > 0 ? String(Math.round(height)) : null,
      cutout: text(form, "cutout", 1) === "1" ? "1" : null,
    };
    fileId = await storeModuleFile(principal, { area: "examples", filename: upload.name, contentType: type, bytes: new Uint8Array(await upload.arrayBuffer()) });
  } else {
    throw new VisualBuilderInputError("Unbekannte Art.");
  }

  try {
    await tenantQuery(ctx(principal),
      `insert into public.visual_builder_assets
         (tenant_id, kind, name, variant, file_id, cta_text, style, font_family, font_weight, created_by)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)`,
      [principal.tenantId, kind, name, variant, fileId, ctaText, JSON.stringify(style), fontFamily, fontWeight, principal.userId]);
  } catch (error) {
    await retireModuleFiles(principal, [fileId]);
    throw error;
  }
}

export async function deleteAsset(principal: PlatformPrincipal, id: unknown): Promise<void> {
  requireVisualBuilderCapability(principal, "configure");
  const rows = await tenantQuery<{ file_id: string | null }>(ctx(principal),
    `delete from public.visual_builder_assets where tenant_id = $1 and id = $2 returning file_id`,
    [principal.tenantId, requireUuid(id, "Der Eintrag ist ungültig.")]);
  await retireModuleFiles(principal, rows.map((row) => row.file_id));
}

export async function assetFileId(principal: PlatformPrincipal, id: string): Promise<string> {
  const rows = await tenantQuery<{ file_id: string | null }>(ctx(principal),
    `select file_id from public.visual_builder_assets where tenant_id = $1 and id = $2`,
    [principal.tenantId, requireUuid(id, "Der Eintrag ist ungültig.")]);
  if (!rows[0]?.file_id) throw new VisualBuilderInputError("Datei nicht gefunden.", 404);
  return rows[0].file_id;
}

/* ---------- Guidelines, safe zones, settings ---------- */

export async function loadGuideline(principal: PlatformPrincipal): Promise<{ text: string; filename: string | null; updatedAt: string | null }> {
  const rows = await tenantQuery<{ content_text: string; filename: string | null; updated_at: string }>(ctx(principal),
    `select content_text, filename, updated_at from public.visual_builder_guidelines where tenant_id = $1`, [principal.tenantId]);
  return { text: rows[0]?.content_text ?? "", filename: rows[0]?.filename ?? null, updatedAt: rows[0]?.updated_at ?? null };
}

export async function saveGuideline(principal: PlatformPrincipal, input: { text?: unknown; filename?: unknown }) {
  requireVisualBuilderCapability(principal, "configure");
  const content = typeof input.text === "string" ? input.text : "";
  if (content.length > 50_000) throw new VisualBuilderInputError("Die Richtlinien sind zu lang (max. 50.000 Zeichen).");
  const filename = typeof input.filename === "string" && input.filename.trim() ? input.filename.trim().slice(0, 200) : null;
  await tenantQuery(ctx(principal),
    `insert into public.visual_builder_guidelines (tenant_id, content_text, filename, updated_by, updated_at)
     values ($1,$2,$3,$4,now())
     on conflict (tenant_id) do update set content_text = excluded.content_text,
       filename = coalesce(excluded.filename, visual_builder_guidelines.filename),
       updated_by = excluded.updated_by, updated_at = now()`,
    [principal.tenantId, content, filename, principal.userId]);
}

export async function saveSafeZone(principal: PlatformPrincipal, input: { format?: unknown; rect?: unknown }) {
  requireVisualBuilderCapability(principal, "configure");
  if (!isFormat(input.format) || !isValidRect(input.rect)) throw new VisualBuilderInputError("Die sichere Zone ist ungültig.");
  const { x_pct, y_pct, w_pct, h_pct } = input.rect;
  await tenantQuery(ctx(principal),
    `insert into public.visual_builder_safe_zones (tenant_id, format, rect, updated_by, updated_at)
     values ($1,$2,$3::jsonb,$4,now())
     on conflict (tenant_id, format) do update set rect = excluded.rect, updated_by = excluded.updated_by, updated_at = now()`,
    [principal.tenantId, input.format, JSON.stringify({ x_pct, y_pct, w_pct, h_pct }), principal.userId]);
}

export async function saveSettings(principal: PlatformPrincipal, input: { defaultFont?: unknown; brand?: unknown }) {
  requireVisualBuilderCapability(principal, "configure");
  if (input.brand !== undefined) {
    const brand = normalizeBrand(input.brand);
    await tenantQuery(ctx(principal),
      `insert into public.visual_builder_settings (tenant_id, default_font, brand, updated_by, updated_at) values ($1,$2,$3::jsonb,$4,now())
       on conflict (tenant_id) do update set brand = excluded.brand,
         default_font = coalesce(excluded.default_font, visual_builder_settings.default_font),
         updated_by = excluded.updated_by, updated_at = now()`,
      [principal.tenantId, brand.bodyFont, JSON.stringify(brand), principal.userId]);
    return;
  }
  const font = typeof input.defaultFont === "string" && input.defaultFont.trim() ? input.defaultFont.trim().slice(0, 80) : null;
  await tenantQuery(ctx(principal),
    `insert into public.visual_builder_settings (tenant_id, default_font, updated_by, updated_at) values ($1,$2,$3,now())
     on conflict (tenant_id) do update set default_font = excluded.default_font, updated_by = excluded.updated_by, updated_at = now()`,
    [principal.tenantId, font, principal.userId]);
}

/* ---------- Drive libraries ---------- */

export async function listLibraries(principal: PlatformPrincipal): Promise<Library[]> {
  return tenantQuery<Library>(ctx(principal),
    `select id, label, folder_id as "folderId" from public.visual_builder_libraries
     where tenant_id = $1 order by position, created_at`, [principal.tenantId]);
}

async function libraryById(principal: PlatformPrincipal, id: unknown): Promise<Library> {
  const libraries = await listLibraries(principal);
  const library = libraries.find((entry) => entry.id === id) ?? (id ? undefined : libraries[0]);
  if (!library) throw new VisualBuilderInputError("Die Bildbibliothek wurde nicht gefunden.", 404);
  return library;
}

export async function addLibrary(principal: PlatformPrincipal, input: { label?: unknown; folder?: unknown }) {
  requireVisualBuilderCapability(principal, "configure");
  const folderId = parseFolderId(input.folder);
  const name = await driveFolderName(folderId);
  const label = String(input.label ?? "").trim().slice(0, 80) || name.slice(0, 80);
  await tenantQuery(ctx(principal),
    `insert into public.visual_builder_libraries (tenant_id, label, folder_id, position, created_by)
     values ($1,$2,$3,(select coalesce(max(position),0)+1 from public.visual_builder_libraries where tenant_id = $1),$4)
     on conflict (tenant_id, folder_id) do update set label = excluded.label`,
    [principal.tenantId, label, folderId, principal.userId]);
  return { name };
}

/** Creates a fresh folder for this tenant below the configured shared-drive parent. */
export async function createLibraryFolder(principal: PlatformPrincipal, input: { label?: unknown }) {
  requireVisualBuilderCapability(principal, "configure");
  const parent = driveParentFolderId();
  if (!parent) throw new VisualBuilderInputError("Für neue Ordner fehlt der übergeordnete Drive-Ordner in der Serverkonfiguration.", 409);
  const label = String(input.label ?? "").trim().slice(0, 80) || "Motive";
  const tenant = await tenantQuery<{ name: string }>(ctx(principal), `select name from public.tenants where id = $1`, [principal.tenantId]);
  const folderId = await createDriveFolder(`${tenant[0]?.name ?? principal.tenantSlug} – ${label}`, parent);
  await tenantQuery(ctx(principal),
    `insert into public.visual_builder_libraries (tenant_id, label, folder_id, position, created_by)
     values ($1,$2,$3,(select coalesce(max(position),0)+1 from public.visual_builder_libraries where tenant_id = $1),$4)`,
    [principal.tenantId, label, folderId, principal.userId]);
  return { folderId };
}

export async function removeLibrary(principal: PlatformPrincipal, id: unknown) {
  requireVisualBuilderCapability(principal, "configure");
  await tenantQuery(ctx(principal), `delete from public.visual_builder_libraries where tenant_id = $1 and id = $2`,
    [principal.tenantId, requireUuid(id, "Die Bibliothek ist ungültig.")]);
}

export async function testLibrary(principal: PlatformPrincipal, id: unknown) {
  requireVisualBuilderCapability(principal, "configure");
  const library = await libraryById(principal, requireUuid(id, "Die Bibliothek ist ungültig."));
  return { name: await driveFolderName(library.folderId) };
}

export async function listLibraryImages(principal: PlatformPrincipal, libraryId: unknown): Promise<DriveListing> {
  if (!isDriveConfigured()) return { configured: false, images: [], error: null };
  const libraries = await listLibraries(principal);
  if (!libraries.length) return { configured: false, images: [], error: null };
  const library = libraries.find((entry) => entry.id === libraryId) ?? libraries[0];
  const [listing, overrides] = await Promise.all([
    listDriveImages(library.folderId),
    tenantQuery<{ file_id: string; format: Fmt }>(ctx(principal),
      `select file_id, format from public.visual_builder_image_formats where tenant_id = $1`, [principal.tenantId]),
  ]);
  const map = new Map(overrides.map((row) => [row.file_id, row.format]));
  return {
    configured: true,
    images: listing.images.map((image) => ({ ...image, override: map.get(image.id) ?? null })),
    error: listing.error,
  };
}

export async function setImageFormat(principal: PlatformPrincipal, input: { fileId?: unknown; format?: unknown }) {
  requireVisualBuilderCapability(principal, "create");
  const fileId = String(input.fileId ?? "");
  if (!DRIVE_ID_PATTERN.test(fileId)) throw new VisualBuilderInputError("Die Datei ist ungültig.");
  if (input.format === null) {
    await tenantQuery(ctx(principal), `delete from public.visual_builder_image_formats where tenant_id = $1 and file_id = $2`, [principal.tenantId, fileId]);
    return;
  }
  if (!isFormat(input.format)) throw new VisualBuilderInputError("Das Format ist ungültig.");
  await tenantQuery(ctx(principal),
    `insert into public.visual_builder_image_formats (tenant_id, file_id, format, updated_by, updated_at) values ($1,$2,$3,$4,now())
     on conflict (tenant_id, file_id) do update set format = excluded.format, updated_by = excluded.updated_by, updated_at = now()`,
    [principal.tenantId, fileId, input.format, principal.userId]);
}

export async function streamLibraryImage(principal: PlatformPrincipal, fileId: string): Promise<Response> {
  const libraries = await listLibraries(principal);
  const meta = await assertInsideFolders(fileId, new Set(libraries.map((library) => library.folderId)));
  if (!meta.mimeType.startsWith("image/") || meta.mimeType === "image/svg+xml") throw new VisualBuilderInputError("Keine Bilddatei.");
  const upstream = await driveImageStream(fileId);
  return new Response(upstream.body, {
    headers: {
      "Content-Type": meta.mimeType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

const UPLOAD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadToLibrary(principal: PlatformPrincipal, form: FormData) {
  requireVisualBuilderCapability(principal, "upload");
  const library = await libraryById(principal, form.get("library") || null);
  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) throw new VisualBuilderInputError("Bitte ein Bild wählen.");
  if (!UPLOAD_TYPES.has(file.type)) throw new VisualBuilderInputError("Bitte JPG, PNG oder WebP hochladen.");
  if (file.size > MAX_ASSET_BYTES) throw new VisualBuilderInputError("Das Bild ist zu groß (max. 4 MB).");
  const name = String(form.get("name") ?? file.name).normalize("NFKC").replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 180) || "motiv.jpg";
  const result = await uploadDriveImage({ folderId: library.folderId, name, contentType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
  return { id: result.id, name: result.name };
}

/* ---------- Archive ---------- */

type CreativeRow = {
  id: string;
  source_text: string;
  language_code: string | null;
  guideline_status: GuidelineStatus;
  has_state: boolean;
  created_at: string;
  zip_file_id: string | null;
  thumb_1x1_file_id: string | null;
  thumb_191x1_file_id: string | null;
  thumb_1x191_file_id: string | null;
};

export async function listCreatives(principal: PlatformPrincipal): Promise<ArchiveEntry[]> {
  const rows = await tenantQuery<CreativeRow>(ctx(principal),
    `select id, source_text, language_code, guideline_status, state is not null as has_state, created_at,
            zip_file_id, thumb_1x1_file_id, thumb_191x1_file_id, thumb_1x191_file_id
     from public.visual_builder_creatives where tenant_id = $1 order by created_at desc limit 200`,
    [principal.tenantId]);
  return rows.map((row) => {
    const thumbs: Partial<Record<Fmt, string>> = {};
    if (row.thumb_1x1_file_id) thumbs["1x1"] = creativeFileUrl(row.id, "thumb_1x1");
    if (row.thumb_191x1_file_id) thumbs["191x1"] = creativeFileUrl(row.id, "thumb_191x1");
    if (row.thumb_1x191_file_id) thumbs["1x191"] = creativeFileUrl(row.id, "thumb_1x191");
    return {
      id: row.id,
      sourceText: row.source_text,
      languageCode: row.language_code,
      guidelineStatus: row.guideline_status,
      hasState: row.has_state,
      createdAt: new Date(row.created_at).toISOString(),
      thumbs,
      zipUrl: row.zip_file_id && canDownloadArchivedCreative(row.guideline_status) ? creativeFileUrl(row.id, "zip") : null,
    };
  });
}

export async function loadCreativeState(principal: PlatformPrincipal, id: unknown): Promise<unknown> {
  const rows = await tenantQuery<{ state: unknown }>(ctx(principal),
    `select state from public.visual_builder_creatives where tenant_id = $1 and id = $2`,
    [principal.tenantId, requireUuid(id, "Der Archiv-Eintrag ist ungültig.")]);
  if (!rows[0]) throw new VisualBuilderInputError("Archiv-Eintrag nicht gefunden.", 404);
  return rows[0].state;
}

export const CREATIVE_PARTS = ["zip", "thumb_1x1", "thumb_191x1", "thumb_1x191"] as const;
export type CreativePart = (typeof CREATIVE_PARTS)[number];

export async function creativeFileId(principal: PlatformPrincipal, id: string, part: CreativePart): Promise<string> {
  const rows = await tenantQuery<CreativeRow>(ctx(principal),
    `select id, guideline_status, zip_file_id, thumb_1x1_file_id, thumb_191x1_file_id, thumb_1x191_file_id
     from public.visual_builder_creatives where tenant_id = $1 and id = $2`,
    [principal.tenantId, requireUuid(id, "Der Archiv-Eintrag ist ungültig.")]);
  const row = rows[0];
  if (!row) throw new VisualBuilderInputError("Archiv-Eintrag nicht gefunden.", 404);
  if (part === "zip" && !canDownloadArchivedCreative(row.guideline_status)) {
    throw new VisualBuilderInputError("Der Download ist erst nach der CI-Prüfung möglich.", 403);
  }
  const fileId = row[`${part}_file_id` as const];
  if (!fileId) throw new VisualBuilderInputError("Datei nicht gefunden.", 404);
  return fileId;
}

function decodeThumb(value: unknown): Uint8Array | null {
  if (typeof value !== "string" || !value) return null;
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new VisualBuilderInputError("Die Vorschau ist ungültig.");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.byteLength > 600_000) throw new VisualBuilderInputError("Die Vorschau ist zu groß.");
  return new Uint8Array(bytes);
}

export type SaveCreativeInput = {
  upload?: { id?: unknown; parts?: unknown; byteSize?: unknown; sha256?: unknown };
  thumbs?: Partial<Record<Fmt, unknown>>;
  sourceText?: unknown;
  languageCode?: unknown;
  state?: unknown;
  guidelineCheckId?: unknown;
  fileLabel?: unknown;
};

export async function saveCreative(principal: PlatformPrincipal, input: SaveCreativeInput) {
  requireVisualBuilderCapability(principal, "create");
  const sourceText = typeof input.sourceText === "string" ? input.sourceText : "";
  if (sourceText.length > 5000) throw new VisualBuilderInputError("Der Text ist zu lang (max. 5.000 Zeichen).");
  const languageCode = typeof input.languageCode === "string" && input.languageCode.trim() ? input.languageCode.trim().slice(0, 20) : null;
  if (!input.state || typeof input.state !== "object" || Array.isArray(input.state)) throw new VisualBuilderInputError("Die Editor-Daten fehlen.");
  const state = JSON.stringify(input.state);
  if (state.length > 400_000) throw new VisualBuilderInputError("Die Editor-Daten sind zu groß.");
  const checkId = typeof input.guidelineCheckId === "string" && input.guidelineCheckId ? requireUuid(input.guidelineCheckId, "Die Prüfung ist ungültig.") : null;
  const uploadId = requireUuid(input.upload?.id, "Der Upload fehlt.");
  const sha256 = String(input.upload?.sha256 ?? "");
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new VisualBuilderInputError("Der Upload ist ungültig.");
  const label = String(input.fileLabel ?? "visual-builder").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60) || "visual-builder";

  const created: string[] = [];
  try {
    const zip = await assembleUpload(principal, {
      uploadId,
      parts: Number(input.upload?.parts),
      byteSize: Number(input.upload?.byteSize),
      sha256,
    });
    const zipId = await storeModuleFile(principal, { area: "archive", filename: `${label}.zip`, contentType: "application/zip", bytes: zip });
    created.push(zipId);
    const thumbIds: Partial<Record<Fmt, string>> = {};
    for (const format of FORMAT_IDS) {
      const bytes = decodeThumb(input.thumbs?.[format]);
      if (!bytes) continue;
      thumbIds[format] = await storeModuleFile(principal, { area: "archive", filename: `thumb_${format}.jpg`, contentType: "image/jpeg", bytes });
      created.push(thumbIds[format]!);
    }
    const rows = await tenantQuery<{ id: string; guideline_status: GuidelineStatus }>(ctx(principal),
      `insert into public.visual_builder_creatives
         (tenant_id, created_by, source_text, language_code, state, guideline_check_id,
          zip_file_id, thumb_1x1_file_id, thumb_191x1_file_id, thumb_1x191_file_id)
       values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10)
       returning id, guideline_status`,
      [principal.tenantId, principal.userId, sourceText, languageCode, state, checkId,
        zipId, thumbIds["1x1"] ?? null, thumbIds["191x1"] ?? null, thumbIds["1x191"] ?? null]);
    return { id: rows[0]!.id, guidelineStatus: rows[0]!.guideline_status };
  } catch (error) {
    await retireModuleFiles(principal, created).catch(() => undefined);
    throw error;
  } finally {
    await clearStaging(principal, uploadId);
  }
}

/** Idempotent: a second request for an already deleted entry succeeds. */
export async function deleteCreative(principal: PlatformPrincipal, id: unknown) {
  requireVisualBuilderCapability(principal, "delete");
  const rows = await tenantQuery<{ zip_file_id: string | null; thumb_1x1_file_id: string | null; thumb_191x1_file_id: string | null; thumb_1x191_file_id: string | null }>(
    ctx(principal),
    `delete from public.visual_builder_creatives where tenant_id = $1 and id = $2
     returning zip_file_id, thumb_1x1_file_id, thumb_191x1_file_id, thumb_1x191_file_id`,
    [principal.tenantId, requireUuid(id, "Der Archiv-Eintrag ist ungültig.")]);
  const row = rows[0];
  if (row) await retireModuleFiles(principal, [row.zip_file_id, row.thumb_1x1_file_id, row.thumb_191x1_file_id, row.thumb_1x191_file_id]);
  return { deleted: Boolean(row) };
}

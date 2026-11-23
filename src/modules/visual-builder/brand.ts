/** Pure helpers for the brand setup and badge templates, shared by editor, settings, server and tests. */
import type { BadgeColors, BadgeItem, BadgeLine, BadgeShape, BadgeSize, Brand, CtaShape, PaletteColor, StickerItem, TextFrame } from "./types";

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (value: unknown): value is string => typeof value === "string" && HEX.test(value);

export const EMPTY_BRAND: Brand = { headlineFont: null, bodyFont: null, headlineColor: null, bodyColor: null, palette: [] };
export const MAX_PALETTE = 16;

const fontName = (value: unknown) => (typeof value === "string" && value.trim() && !/["\\;{}]/.test(value) ? value.trim().slice(0, 80) : null);

export function normalizeBrand(raw: unknown): Brand {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const palette: PaletteColor[] = [];
  for (const entry of Array.isArray(value.palette) ? value.palette : []) {
    const item = (entry ?? {}) as Record<string, unknown>;
    if (!isHex(item.hex) || palette.some((color) => color.hex === String(item.hex).toLowerCase())) continue;
    palette.push({ name: typeof item.name === "string" ? item.name.trim().slice(0, 40) : "", hex: String(item.hex).toLowerCase() });
    if (palette.length >= MAX_PALETTE) break;
  }
  return {
    headlineFont: fontName(value.headlineFont),
    bodyFont: fontName(value.bodyFont),
    headlineColor: isHex(value.headlineColor) ? value.headlineColor.toLowerCase() : null,
    bodyColor: isHex(value.bodyColor) ? value.bodyColor.toLowerCase() : null,
    palette,
  };
}

/** Palette colours first, then black and white if the palette lacks them. */
export function brandColors(brand: Brand): PaletteColor[] {
  const colors = [...brand.palette];
  for (const [hex, name] of [["#000000", "Schwarz"], ["#ffffff", "Weiß"]] as const) {
    if (!colors.some((color) => color.hex === hex)) colors.push({ name, hex });
  }
  return colors;
}

export const CTA_SHAPES: readonly CtaShape[] = ["tag", "arrow", "pill", "outline"];
export const isCtaShape = (value: unknown): value is CtaShape => CTA_SHAPES.includes(value as CtaShape);

/* ---------- Badges ---------- */

export const BADGE_SHAPES: readonly BadgeShape[] = ["price-box", "diamond", "burst", "circle", "box"];
export const isBadgeShape = (value: unknown): value is BadgeShape => BADGE_SHAPES.includes(value as BadgeShape);
export const MAX_BADGE_LINES = 6;
export const BADGE_SIZES: readonly BadgeSize[] = ["xl", "l", "m", "s"];
const isBadgeSize = (value: unknown): value is BadgeSize => BADGE_SIZES.includes(value as BadgeSize);
/** Large lines are bold unless switched off; small lines are regular unless switched on. */
export const lineBold = (line: BadgeLine) => line.bold ?? line.size !== "s";

export const DEFAULT_BADGE_COLORS: BadgeColors = { bg: "#ffffff", fg: "#000000", accentBg: "#000000", accentFg: "#ffffff", border: "#ffffff" };

/** Starting text per shape; the template in the settings may replace it. */
export const DEFAULT_BADGE_LINES: Record<BadgeShape, BadgeLine[]> = {
  "price-box": [
    { text: "125 GB", size: "l", strike: false },
    { text: "100 GB", size: "s", strike: true },
    { text: "24,99 €", size: "l", strike: false },
    { text: "pro Monat", size: "s", strike: false },
  ],
  diamond: [
    { text: "Nur", size: "s", strike: false },
    { text: "29,99 €", size: "l", strike: false },
    { text: "monatlich¹", size: "s", strike: false },
  ],
  burst: [
    { text: "Dauerhaft", size: "s", strike: false },
    { text: "MEHR", size: "l", strike: false },
    { text: "DATEN", size: "l", strike: false },
  ],
  circle: [
    { text: "Nur bis", size: "s", strike: false },
    { text: "1.9.’25", size: "l", strike: false },
  ],
  box: [
    { text: "100 €", size: "l", strike: false },
    { text: "Startbonus", size: "s", strike: false },
  ],
};

/** Compact storage of badge lines: one line per row, size (`xl:`, `l:`, `m:`, `s:`), `~` for struck through, `*`/`-` for bold on/off. */
export function encodeBadgeLines(lines: readonly BadgeLine[]): string {
  return lines.slice(0, MAX_BADGE_LINES).map((line) =>
    `${line.size}${line.strike ? "~" : ""}${line.bold === undefined ? "" : line.bold ? "*" : "-"}:${line.text.replace(/\n/g, " ")}`).join("\n");
}

export function decodeBadgeLines(value: string | null | undefined): BadgeLine[] {
  const lines: BadgeLine[] = [];
  for (const row of (value ?? "").split("\n")) {
    const match = /^(xl|[lms])(~?)([*-]?):(.*)$/.exec(row);
    if (!match) continue;
    const line: BadgeLine = { size: match[1] as BadgeSize, strike: match[2] === "~", text: match[4].slice(0, 60) };
    if (match[3]) line.bold = match[3] === "*";
    lines.push(line);
    if (lines.length >= MAX_BADGE_LINES) break;
  }
  return lines;
}

export function normalizeBadgeLine(raw: unknown, maxText = 60): BadgeLine | null {
  const line = (raw ?? {}) as Record<string, unknown>;
  if (typeof line.text !== "string") return null;
  const result: BadgeLine = { text: line.text.replace(/\n/g, " ").slice(0, maxText), size: isBadgeSize(line.size) ? line.size : "s", strike: line.strike === true };
  if (typeof line.bold === "boolean") result.bold = line.bold;
  return result;
}

export type BadgeSegment = { text: string; bold: boolean; small: boolean };

/** Splits `**bold**` and `~~small struck~~` markers; unmatched markers stay text. */
export function badgeSegments(text: string, bold: boolean): BadgeSegment[] {
  const segments: BadgeSegment[] = [];
  const pattern = /\*\*(.+?)\*\*|~~(.+?)~~/g;
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), bold, small: false });
    segments.push(match[1] !== undefined ? { text: match[1], bold: true, small: false } : { text: match[2], bold, small: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold, small: false });
  return segments.filter((segment) => segment.text);
}

/** Badge text as read, for the guideline check and translation hints. */
/** Badge rows as plain text for the guideline check; crossed-out parts (e.g. an old price) stay marked as such. */
export const badgePlain = (lines: readonly BadgeLine[]) =>
  lines.map((line) => {
    const text = line.text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/~~(.+?)~~/g, "[struck: $1]").trim();
    return line.strike && text ? `[struck: ${text}]` : text;
  }).filter(Boolean).join("\n");

export function normalizeBadgeColors(raw: unknown): BadgeColors {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = (key: keyof BadgeColors, alias: string) => {
    const candidate = value[key] ?? value[alias];
    return isHex(candidate) ? candidate.toLowerCase() : DEFAULT_BADGE_COLORS[key];
  };
  return { bg: pick("bg", "bg_color"), fg: pick("fg", "text_color"), accentBg: pick("accentBg", "accent_bg"), accentFg: pick("accentFg", "accent_fg"), border: pick("border", "border_color") };
}

const clampNumber = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function normalizeBadgeItem(raw: unknown): BadgeItem | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (!isBadgeShape(value.shape) || typeof value.uid !== "string") return null;
  const pos = (value.pos && typeof value.pos === "object" ? value.pos : {}) as Record<string, unknown>;
  const lines = (Array.isArray(value.lines) ? value.lines : []).slice(0, MAX_BADGE_LINES)
    .map((entry) => normalizeBadgeLine(entry)).filter((line): line is BadgeLine => line !== null);
  return {
    uid: value.uid.slice(0, 40),
    name: typeof value.name === "string" ? value.name.slice(0, 120) : "",
    shape: value.shape,
    colors: normalizeBadgeColors(value.colors),
    lines,
    pos: { x_pct: clampNumber(pos.x_pct, 5, 0, 100), y_pct: clampNumber(pos.y_pct, 30, 0, 100) },
    scale: clampNumber(value.scale, 30, 8, 80),
  };
}

/* ---------- Badge geometry (shared by drawing and the movable frame) ---------- */

const PRICE_BOX_SIZE = { xl: 0.26, l: 0.2, m: 0.13, s: 0.085 } as const;
const ROUND_SIZE = { xl: 0.22, l: 0.17, m: 0.12, s: 0.085 } as const;
export const BADGE_LINE_HEIGHT = 1.12;

/** Font size of a line in px for a badge of width `w` (before shrinking to fit). */
export function badgeFontSize(shape: BadgeShape, size: BadgeLine["size"], w: number): number {
  return (shape === "price-box" ? PRICE_BOX_SIZE[size] : ROUND_SIZE[size]) * w;
}

/** The price box puts lines 1–2 in the upper field and the rest in the lower field. */
export function priceBoxSections(lines: readonly BadgeLine[]) {
  const visible = lines.filter((line) => line.text.trim());
  return { top: visible.slice(0, 2), bottom: visible.slice(2) };
}

export function priceBoxLayout(lines: readonly BadgeLine[], w: number) {
  const { top, bottom } = priceBoxSections(lines);
  const pad = w * 0.07;
  const sectionHeight = (section: BadgeLine[]) => section.length
    ? section.reduce((sum, line) => sum + badgeFontSize("price-box", line.size, w) * BADGE_LINE_HEIGHT, 0) + pad * 2
    : 0;
  const topH = sectionHeight(top);
  const bottomH = sectionHeight(bottom);
  return { top, bottom, pad, topH, bottomH, h: Math.max(w * 0.3, topH + bottomH) };
}

/** Height of a badge with width `w`. */
export function badgeHeight(shape: BadgeShape, lines: readonly BadgeLine[], w: number): number {
  return shape === "price-box" ? priceBoxLayout(lines, w).h : w;
}

/* ---------- Text frames and stickers ---------- */

export function normalizeFrame(raw: unknown): TextFrame | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (!isHex(value.border)) return null;
  return { border: value.border.toLowerCase(), fill: isHex(value.fill) ? value.fill.toLowerCase() : null };
}

export function normalizeStickerItem(raw: unknown): StickerItem | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.uid !== "string" || typeof value.assetId !== "string") return null;
  return {
    uid: value.uid.slice(0, 40),
    assetId: value.assetId.slice(0, 40),
    name: typeof value.name === "string" ? value.name.slice(0, 120) : "",
    x_pct: clampNumber(value.x_pct, 50, -50, 150),
    y_pct: clampNumber(value.y_pct, 50, -50, 150),
    scale: clampNumber(value.scale, 40, 3, 300),
    rotate: clampNumber(value.rotate, 0, -180, 180),
    flip: value.flip === true,
    behind: value.behind !== false,
  };
}

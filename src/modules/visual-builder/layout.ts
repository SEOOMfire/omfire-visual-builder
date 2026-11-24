import type { Crop, CtaPlacement, FigureBox, Fmt, LogoPlacement, PerFormat, Rect, TextBlock } from "./types";

export const FORMATS: ReadonlyArray<{ id: Fmt; label: string; w: number; h: number; ratio: number }> = [
  { id: "1x1", label: "1:1", w: 1080, h: 1080, ratio: 1 },
  { id: "191x1", label: "1.91:1", w: 1200, h: 628, ratio: 1200 / 628 },
  { id: "1x191", label: "1:1.91", w: 1080, h: 1920, ratio: 1080 / 1920 },
];

export const FORMAT_IDS: readonly Fmt[] = FORMATS.map((format) => format.id);

export function isFormat(value: unknown): value is Fmt {
  return value === "1x1" || value === "191x1" || value === "1x191";
}

export function formatOf(id: Fmt) {
  return FORMATS.find((format) => format.id === id)!;
}

export function perFormat<T>(make: (id: Fmt) => T): PerFormat<T> {
  return { "1x1": make("1x1"), "191x1": make("191x1"), "1x191": make("1x191") };
}

/** Most likely target format: the smallest logarithmic distance of the aspect ratio. */
export function closestFormat(ratio: number): Fmt {
  let best: Fmt = "1x1";
  let distance = Infinity;
  for (const format of FORMATS) {
    const candidate = Math.abs(Math.log(ratio / format.ratio));
    if (candidate < distance) {
      distance = candidate;
      best = format.id;
    }
  }
  return best;
}

export const DEFAULT_CROP: Crop = { x: 0.5, y: 0.5, zoom: 1 };

/** A figure stands on the bottom edge, right of centre, like a person in a campaign layout. */
export const DEFAULT_FIGURE: FigureBox = { x_pct: 68, bottom_pct: 100, h_pct: 85, flip: false };

export function normalizeFigure(value: unknown): FigureBox {
  const box = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof FigureBox, unknown>>;
  const number = (raw: unknown, fallback: number, min: number, max: number) =>
    typeof raw === "number" && Number.isFinite(raw) ? clamp(raw, min, max) : fallback;
  return {
    x_pct: number(box.x_pct, DEFAULT_FIGURE.x_pct, -50, 150),
    bottom_pct: number(box.bottom_pct, DEFAULT_FIGURE.bottom_pct, 10, 200),
    h_pct: number(box.h_pct, DEFAULT_FIGURE.h_pct, 5, 250),
    flip: box.flip === true,
    rotate: number(box.rotate, 0, -180, 180),
  };
}

/** Figure position in canvas pixels; it may reach beyond the canvas, the edges cut it off. */
export function figureRect(box: FigureBox, aspect: number, W: number, H: number) {
  const h = (box.h_pct / 100) * H;
  const w = h * aspect;
  return { x: (box.x_pct / 100) * W - w / 2, y: (box.bottom_pct / 100) * H - h, w, h };
}

/** File name without path, extension and format marker, to find the same motif in the other formats. */
export function fileBaseName(path: string): string {
  let file = path.split("/").pop() || path;
  file = file.replace(/^\d{10,}-/, "");
  file = file.replace(/(\.(jpg|jpeg|png|webp|gif|avif))+$/i, "");
  file = file.replace(/[_-](1x1|1\.91x1|1x1\.91|191x1|1x191)$/i, "");
  file = file.replace(/(^|[_-])(?<!\d[_-])\d{1,2}-\d{1,2}(?=([_-]|$))(?!-\d)/g, "$1");
  return file.replace(/[_-]{2,}/g, "_").replace(/^[_-]+|[_-]+$/g, "").toLowerCase();
}

export const DEFAULT_ZONE: Rect = { x_pct: 5, y_pct: 5, w_pct: 90, h_pct: 90 };
export const DEFAULT_ZONES: PerFormat<Rect> = perFormat(() => ({ ...DEFAULT_ZONE }));

export const DEFAULT_HEADLINE = { de: "Deine Werbebotschaft hier", en: "Your advertising message here" } as const;

export function blockDefaults(zone: Rect, index: 0 | 1, headline: string = DEFAULT_HEADLINE.de): TextBlock {
  const half = zone.h_pct / 2 - 2;
  return {
    html: index === 0 ? headline : "",
    rect: {
      x_pct: zone.x_pct,
      y_pct: index === 0 ? zone.y_pct : zone.y_pct + zone.h_pct / 2 + 2,
      w_pct: zone.w_pct,
      h_pct: Math.max(10, half),
    },
    align: "center",
    color: "#ffffff",
    sizePct: index === 0 ? 8 : 5,
    lineHeight: 1.25,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Moves and shrinks a box until it lies completely inside the safe zone. */
export function fitRectToZone(rect: Rect, zone: Rect): Rect {
  const w = Math.min(rect.w_pct, zone.w_pct);
  const h = Math.min(rect.h_pct, zone.h_pct);
  return {
    w_pct: w,
    h_pct: h,
    x_pct: clamp(rect.x_pct, zone.x_pct, zone.x_pct + zone.w_pct - w),
    y_pct: clamp(rect.y_pct, zone.y_pct, zone.y_pct + zone.h_pct - h),
  };
}

export function isValidRect(value: unknown): value is Rect {
  if (!value || typeof value !== "object") return false;
  const rect = value as Record<string, unknown>;
  return (["x_pct", "y_pct", "w_pct", "h_pct"] as const).every((key) => {
    const number = rect[key];
    return typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= 100;
  }) && (rect.x_pct as number) + (rect.w_pct as number) <= 100.0001 && (rect.y_pct as number) + (rect.h_pct as number) <= 100.0001
    && (rect.w_pct as number) > 0 && (rect.h_pct as number) > 0;
}

/** Safe zone in pixels. */
export function zoneBox(zone: Rect, W: number, H: number) {
  return { x: (zone.x_pct / 100) * W, y: (zone.y_pct / 100) * H, w: (zone.w_pct / 100) * W, h: (zone.h_pct / 100) * H };
}

/** Keeps an element (w×h) completely inside the safe zone. */
export function clampToZone(x: number, y: number, w: number, h: number, zone: Rect, W: number, H: number) {
  const z = zoneBox(zone, W, H);
  return {
    x: clamp(x, z.x, Math.max(z.x, z.x + z.w - w)),
    y: clamp(y, z.y, Math.max(z.y, z.y + z.h - h)),
  };
}

/** Width comes from `scalePct` of the shorter side. Height follows the image aspect. Position is the top-left. */
export function graphicBounds(
  scalePct: number,
  widthOverHeight: number,
  pos: { x_pct: number; y_pct: number } | null,
  placement: LogoPlacement | CtaPlacement,
  zone: Rect,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const shorter = Math.min(width, height);
  const w = (scalePct / 100) * shorter;
  const h = widthOverHeight > 0 ? w / widthOverHeight : w;
  const pad = shorter * 0.03;
  const raw = pos
    ? { x: (pos.x_pct / 100) * width, y: (pos.y_pct / 100) * height }
    : placeInZone(placement, w, h, zone, width, height, pad);
  const clamped = clampToZone(raw.x, raw.y, w, h, zone, width, height);
  return { x: clamped.x, y: clamped.y, w, h };
}

/** Preset position relative to the safe zone instead of the image edge. */
export function placeInZone(
  placement: LogoPlacement | CtaPlacement,
  w: number, h: number, zone: Rect, W: number, H: number, pad: number,
): { x: number; y: number } {
  const z = zoneBox(zone, W, H);
  const p = Math.max(0, Math.min(pad, (z.w - w) / 2, (z.h - h) / 2));
  const left = z.x + p;
  const right = z.x + z.w - w - p;
  const top = z.y + p;
  const bottom = z.y + z.h - h - p;
  const cx = z.x + (z.w - w) / 2;
  const cy = z.y + (z.h - h) / 2;
  let pos: { x: number; y: number };
  switch (placement) {
    case "top-left": pos = { x: left, y: top }; break;
    case "top-right": pos = { x: right, y: top }; break;
    case "top-center": pos = { x: cx, y: top }; break;
    case "bottom-left": pos = { x: left, y: bottom }; break;
    case "bottom-right": pos = { x: right, y: bottom }; break;
    case "bottom-center": pos = { x: cx, y: bottom }; break;
    case "center": pos = { x: cx, y: cy }; break;
    default: pos = { x: left, y: top };
  }
  return clampToZone(pos.x, pos.y, w, h, zone, W, H);
}

/** Language suffix for export file names, e.g. `_fr` for `fr-FR`. */
export function languageSuffix(code: string | null | undefined): string {
  const short = (code || "").trim().toLowerCase().split(/[-_]/)[0];
  return short ? `_${short}` : "";
}

export const LOGO_PLACEMENTS: readonly LogoPlacement[] = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];
export const CTA_PLACEMENTS: readonly CtaPlacement[] = ["none", "top-left", "top-right", "bottom-left", "bottom-right", "center"];

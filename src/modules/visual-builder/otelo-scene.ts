import { headInside, placeCutout, type Cutout } from "./server/cutout";

export const LIME = "#D7EB00";
export const ORANGE = "#FA5A14";
export const BLACK = "#000000";
export const WHITE = "#FFFFFF";

export const DEFAULT_PFLICHTTEXT =
  "Alle Preise inklusive MwSt. · otelo – eine Marke der Vodafone GmbH · Ferdinand-Braun-Platz 1 · 40549 Düsseldorf · otelo.de";

/**
 * Stichprobe aus Werbemittel/ (PMax 1200×1200 und 1200×628, Meta 1:1, TikTok 9:16):
 * keines der Motive trägt den langen Rechtssatz. Der Pflichttext ist deshalb überall optional.
 */
export const PFLICHTTEXT_IN_MOTIV: Record<string, boolean> = {
  "pmax-1200x1200": false,
  "pmax-1200x628": false,
  "pmax-960x1200": false,
  "meta-1x1": false,
  "meta-9x16": false,
  "tiktok-9x16": false,
};

export type OrangeSide = "links" | "rechts";
export type HeadlineVariant = "direkt" | "box";
export type StoererTyp = "tarif" | "product" | "bonus" | "stern" | "kreis" | "ohne_preis";
export type VorlageName = "tarif" | "product" | "product_person" | "young" | "kachel_person" | "kachel_geraet" | "kachel_geraet_person";
export type DekoName = "bw_wellen" | "fruehling_blaetter" | "keine";

export type Box = { x: number; y: number; w: number; h: number };
export type Pt = [number, number];

export type SceneCopy = {
  headline: string;
  subline: string;
  button: string;
  stoererTyp: StoererTyp;
  preis: string;
  preisZusatz: string;
  einmalpreis: string;
  aktionText: string;
  pflichttext: string;
  headlineVariante: HeadlineVariant;
  orange: OrangeSide;
  produktname: string;
  datenmenge?: string;
  datenmengeAlt?: string;
  einmalpreisZusatz?: string;
  preisAlt?: string;
  preisMonatAlt?: string;
  sternText?: string;
  deko?: DekoName;
  geraetName?: string;
  kampagne?: string;
  sublineColor?: string;
  sternColor?: string;
  headlineColor?: string;
  ctaColor?: string;
};

export type OteloScene = {
  id: string;
  width: number;
  height: number;
  orange: Pt[];
  angle: number;
  orangeRatio: number;
  orangeSide: OrangeSide;
  figure?: Box;
  figureFlip?: boolean;
  figureKey?: string;
  /** Opaque region of the source image, as fractions of that image. */
  figureSource?: { x: number; y: number; w: number; h: number };
  headBox?: Box;
  product?: Box;
  productTilt?: number;
  /** Drawn phone. The paint uses this frame, so the alpha box matches the overlap check. */
  productPaint?: ProductPaint;
  productKey?: string;
  energy?: Box;
  energyKey?: string;
  logoKey?: string;
  dekoKey?: string;
  productName?: { text: string; box: Box };
  headline: { lines: string[]; variant: HeadlineVariant; box: Box; step: number };
  subline: { lines: Array<{ text: string; bold: boolean; color: string }>; box: Box };
  stoerer: { typ: StoererTyp; box: Box; preis: string; zusatz: string; einmal: string; aktion: string };
  cta: { box: Box; text: string };
  logo: { box: Box; side: "left" | "right" };
  pflichttext?: { text: string; box: Box };
  style?: "schraege" | "kachel";
  kachel?: { box: Box; datenmenge: string; alt: string; einmal: string; einmalZusatz: string };
  pill?: { box: Box; preis: string; zusatz: string };
  preisAlt?: string;
  preisMonatAlt?: string;
  stern?: { box: Box; text: string };
  sternColor?: string;
  headlineColor?: string;
  ctaColor?: string;
  /** User scale that the picture actually reached, in percent of the template size. */
  renderedGroesse?: Partial<Record<"stern" | "geraet" | "figur", number>>;
  sizeGrund?: Partial<Record<"geraet" | "figur", string>>;
  offers?: { datenmenge?: Box; datenmengeAlt?: Box; preis?: Box; preisAlt?: Box; einmalpreis?: Box };
  deko?: { name: DekoName; box: Box; strength?: number };
  headlinePfeile?: boolean;
  deviceLabel?: { text: string; box: Box };
  textScale?: { preisAlt: number; alt: number; zusatz: number; geraetName: number; einmalig: number };
  hints: string[];
};

const TEMPLATE_ANGLE = {
  tarif: { landscape: 36, portrait: 16 },
  young: { landscape: 32, portrait: 14 },
  product: { landscape: 28, portrait: 14 },
  product_person: { landscape: 28, portrait: 14 },
} as const;

export function normalizeVorlage(value: string): VorlageName {
  if (value === "tarif" || value === "standard") return "tarif";
  if (value === "product" || value === "hardware") return "product";
  if (value === "product_person") return "product_person";
  if (value === "kachel_person" || value === "kachel_geraet" || value === "kachel_geraet_person") return value;
  return "young";
}

/** Accepts the short names the tools already send. */
export function normalizeDeko(value: string | undefined): DekoName | undefined {
  if (!value) return undefined;
  const text = value.trim().toLowerCase();
  if (text === "bw_wellen" || text === "wellen") return "bw_wellen";
  if (text === "fruehling_blaetter" || text === "blaetter" || text === "blätter" || text === "blatter") return "fruehling_blaetter";
  if (text === "keine") return "keine";
  return undefined;
}

export function dekoFor(copy: Pick<SceneCopy, "deko" | "kampagne">): DekoName {
  if (copy.deko === "bw_wellen" || copy.deko === "fruehling_blaetter" || copy.deko === "keine") return copy.deko;
  const name = (copy.kampagne ?? "").toLowerCase();
  if (name.includes("fruehling") || name.includes("sommer")) return "fruehling_blaetter";
  if (name.includes("weihnacht") || name.includes("winter") || name.includes("dezember") || name.includes("januar")) return "keine";
  if (name === "bw" || name.includes("black")) return "bw_wellen";
  return "keine";
}

export function defaultOrange(name: VorlageName): OrangeSide {
  return name === "product" || name === "product_person" ? "links" : "rechts";
}

export function defaultHeadline(name: VorlageName): HeadlineVariant {
  return name === "product" || name === "product_person" ? "box" : "direkt";
}

export function defaultStoerer(name: VorlageName): StoererTyp {
  return name === "product" || name === "product_person" ? "product" : "tarif";
}

export function rasterOrangeRatio(polygon: readonly Pt[], width: number, height: number): number {
  if (polygon.length < 3 || width < 1 || height < 1) return 0;
  const step = Math.max(2, Math.round(Math.min(width, height) / 80));
  let seen = 0;
  let orange = 0;
  for (let y = step / 2; y < height; y += step) {
    for (let x = step / 2; x < width; x += step) {
      seen += 1;
      if (pointInPolygon(x, y, polygon)) orange += 1;
    }
  }
  return seen ? orange / seen : 0;
}

function edgeRises(polygon: readonly Pt[], width: number, height: number): boolean {
  let span = 0;
  let leftY = 0;
  let rightY = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const axis = Math.abs(start[0] - end[0]) < 2 || Math.abs(start[1] - end[1]) < 2;
    const border = [start, end].every((point) => point[0] < 2 || point[1] < 2 || point[0] > width - 2 || point[1] > height - 2);
    if (axis && border) continue;
    const left = start[0] <= end[0] ? start : end;
    const right = start[0] <= end[0] ? end : start;
    const length = Math.hypot(right[0] - left[0], right[1] - left[1]);
    if (length > span) {
      span = length;
      leftY = left[1];
      rightY = right[1];
    }
  }
  return span > 0 && leftY > rightY + 2;
}

export function polygonArea(points: readonly Pt[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    sum += points[index][0] * next[1] - next[0] * points[index][1];
  }
  return Math.abs(sum) / 2;
}

function wedge(width: number, height: number, angle: number, ratio: number, above: boolean): { polygon: Pt[]; yLeft: number; yRight: number } | null {
  const rise = Math.tan((angle * Math.PI) / 180) * width;
  const span = above ? height * ratio * 2 : height * (1 - ratio) * 2;
  let yLeft = above ? (span + rise) / 2 : (span + rise) / 2;
  let yRight = yLeft - rise;
  if (!above) {
    const target = height * (1 - ratio) * 2;
    yLeft = (target + rise) / 2;
    yRight = (target - rise) / 2;
  }
  if (yLeft > height - 2) {
    const shift = yLeft - (height - 2);
    yLeft -= shift;
    yRight -= shift;
  }
  if (yRight < 2) {
    const shift = 2 - yRight;
    yLeft += shift;
    yRight += shift;
  }
  if (yLeft <= yRight + 4 || yLeft > height || yRight < 0) return null;
  const polygon: Pt[] = above
    ? [[0, 0], [width, 0], [width, yRight], [0, yLeft]]
    : [[0, yLeft], [width, yRight], [width, height], [0, height]];
  return { polygon, yLeft, yRight };
}

/** One straight rising edge. Orange stays near one third and never over half. `links` is the area above the line. */
export function splitOrange(width: number, height: number, angleDeg: number, side: OrangeSide, ratio = 1 / 3): { polygon: Pt[]; ratio: number; angle: number } {
  const portrait = height > width;
  const min = portrait ? 11 : 18;
  const max = 45;
  const above = side === "links";
  let best = {
    polygon: (above
      ? [[0, 0], [width, 0], [width, height * 0.2], [0, height * 0.55]]
      : [[0, height * 0.67], [width, height * 0.5], [width, height], [0, height]]) as Pt[],
    ratio: 0.4,
    angle: min,
  };
  let bestGap = Infinity;
  for (let angle = min; angle <= max; angle += 1) {
    const built = wedge(width, height, angle, ratio, above);
    if (!built || !edgeRises(built.polygon, width, height)) continue;
    const area = rasterOrangeRatio(built.polygon, width, height);
    if (area > 0.5 || area < 0.2) continue;
    const footInside = above ? pointInPolygon(width * 0.22, Math.min(height - 2, built.yLeft - 8), built.polygon) : pointInPolygon(width * 0.78, height - 4, built.polygon);
    const gap = Math.abs(area - ratio) + (footInside ? 0 : 0.2) + Math.abs(angle - angleDeg) * 0.0005;
    if (gap < bestGap) {
      bestGap = gap;
      best = { polygon: built.polygon, ratio: area, angle };
    }
  }
  return best;
}

function box(x: number, y: number, w: number, h: number): Box {
  return { x, y, w, h };
}

function headlineLines(raw: string): string[] {
  const given = raw.split(/\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.toUpperCase());
  if (given.length !== 1) return given.slice(0, 3);
  const words = given[0].split(/\s+/);
  if (words.length < 2) return given;
  const cut = words.length === 3 ? 1 : Math.ceil(words.length / 2);
  return [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
}

function corners(target: Box): Pt[] {
  return [[target.x, target.y], [target.x + target.w, target.y], [target.x, target.y + target.h], [target.x + target.w, target.y + target.h]];
}

function insetBox(rect: Box, pad = 0.2): Box {
  return { x: rect.x + rect.w * pad, y: rect.y + rect.h * pad, w: rect.w * (1 - pad * 2), h: rect.h * (1 - pad * 2) };
}

/** A corner seat whose top never rises into the text above the anchor. */
function cornerStar(anchor: Box, size: number, which: "tr" | "tl", ceiling: number): Box {
  const x = which === "tr" ? anchor.x + anchor.w - size * 0.28 : anchor.x - size * 0.72;
  const y = Math.max(ceiling, anchor.y - size * 0.18);
  return { x, y, w: size, h: size };
}

function rotatedAabb(rect: Box, cx: number, cy: number, radians: number): Box {
  const points = [
    [rect.x, rect.y],
    [rect.x + rect.w, rect.y],
    [rect.x, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h],
  ].map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    return [cx + dx * c - dy * s, cy + dx * s + dy * c] as const;
  });
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export type ProductPaint = { cx: number; cy: number; w: number; h: number; opaque: Box };

/**
 * The phone as it is drawn: height follows the layout box, the opaque alpha
 * box is the visible device. `minOpaqueX` parks that alpha box to the right of
 * a caption and shrinks the phone until the whole device stays on the canvas.
 * Without it, a tall format still keeps the image from running more than 15
 * percent past the right edge.
 */
export function paintedProduct(box: Box, cutout: Cutout, canvasW: number, tall: boolean, tilt = -0.1, avoid?: Box, minOpaqueX = 0): ProductPaint {
  const aspect = cutout.imageW / Math.max(1, cutout.imageH);
  const fracX = cutout.opaque.x / Math.max(1, cutout.imageW);
  const fracW = cutout.opaque.w / Math.max(1, cutout.imageW);
  const fracY = cutout.opaque.y / Math.max(1, cutout.imageH);
  const fracH = cutout.opaque.h / Math.max(1, cutout.imageH);
  let height = box.h;
  if (minOpaqueX > 0) {
    const maxOpaqueW = Math.max(canvasW * 0.12, canvasW - minOpaqueX - canvasW * 0.015);
    height = Math.min(height, maxOpaqueW / Math.max(0.05, fracW) / aspect);
  }
  let width = height * aspect;
  const centerFor = (nextWidth: number) => (minOpaqueX > 0 ? minOpaqueX + nextWidth * 0.5 - nextWidth * fracX : box.x + box.w * 0.5);
  let centerX = centerFor(width);
  const centerYFor = (nextHeight: number) => (tall ? box.y + nextHeight * (0.5 - fracY) : box.y + nextHeight * 0.5);
  for (let step = 0; step < 8; step += 1) {
    const centerY = centerYFor(height);
    const opaqueTop = centerY - height * 0.5 + fracY * height;
    const opaqueLeft = centerX - width * 0.5 + fracX * width;
    if (!tall || !avoid || avoid.w < 2) break;
    const hits = opaqueLeft < avoid.x + avoid.w && opaqueLeft + fracW * width > avoid.x && opaqueTop < avoid.y + avoid.h && opaqueTop + fracH * height > avoid.y;
    if (!hits) break;
    height *= 0.9;
    width = height * aspect;
    centerX = centerFor(width);
  }
  if (minOpaqueX === 0 && tall) {
    const limit = canvasW + width * 0.15;
    if (centerX + width * 0.5 > limit) centerX = limit - width * 0.5;
  }
  const centerY = centerYFor(height);
  const opaqueAt = (cx: number) => {
    const left = cx - width / 2;
    const top = centerY - height / 2;
    return rotatedAabb({
      x: left + fracX * width,
      y: top + fracY * height,
      w: fracW * width,
      h: fracH * height,
    }, cx, centerY, tilt);
  };
  let opaque = opaqueAt(centerX);
  if (minOpaqueX > 0 && opaque.x < minOpaqueX - 0.5) {
    centerX += minOpaqueX - opaque.x;
    opaque = opaqueAt(centerX);
  }
  return { cx: centerX, cy: centerY, w: width, h: height, opaque };
}

/** Share of the opaque device that lies inside the format, and whether the right edge is cut off. */
export function deviceInside(opaque: Box, canvasW: number, canvasH: number): { share: number; rightCrop: boolean } {
  const right = opaque.x + opaque.w;
  const bottom = opaque.y + opaque.h;
  const width = Math.max(0, Math.min(right, canvasW) - Math.max(opaque.x, 0));
  const height = Math.max(0, Math.min(bottom, canvasH) - Math.max(opaque.y, 0));
  return {
    share: (width * height) / Math.max(1, opaque.w * opaque.h),
    rightCrop: right > canvasW + 1,
  };
}

/** The phone's opaque pixels inside the layout box, after the same fit and tilt as the paint. */
export function visibleProductBox(box: Box, cutout: Cutout, tall: boolean, tilt = -0.1): Box {
  const aspect = cutout.imageW / Math.max(1, cutout.imageH);
  const height = box.h;
  const width = height * aspect;
  const centerX = box.x + box.w * 0.5;
  const topFrac = cutout.opaque.y / Math.max(1, cutout.imageH);
  const centerY = tall ? box.y + height * (0.5 - topFrac) : box.y + height * 0.5;
  const left = centerX - width / 2;
  const top = centerY - height / 2;
  const opaque = {
    x: left + (cutout.opaque.x / cutout.imageW) * width,
    y: top + (cutout.opaque.y / cutout.imageH) * height,
    w: (cutout.opaque.w / cutout.imageW) * width,
    h: (cutout.opaque.h / cutout.imageH) * height,
  };
  return rotatedAabb(opaque, centerX, centerY, tilt);
}

function glyphWidth(text: string, fontSize: number): number {
  return Math.max(1, text.length) * fontSize * 0.56;
}

function lineBox(centerX: number, centerY: number, text: string, fontSize: number): Box {
  const width = glyphWidth(text, fontSize);
  const height = fontSize * 1.2;
  return { x: centerX - width / 2, y: centerY - height / 2, w: width, h: height };
}

function deviceGlyphs(tile: Box, pill: Box, copy: SceneCopy): Array<[string, Box]> {
  const once = copy.einmalpreis || "1 €";
  const priceSize = Math.min(tile.h * 0.34, (tile.w * 0.82) / Math.max(1, once.length * 0.56));
  const items: Array<[string, Box]> = [
    ["Einmalig", lineBox(tile.x + tile.w / 2, tile.y + tile.h * 0.18, "Einmalig", tile.h * 0.13)],
    ["Einmalpreis", lineBox(tile.x + tile.w / 2, tile.y + tile.h * (copy.preisAlt ? 0.46 : 0.52), once, priceSize)],
  ];
  if (copy.einmalpreisZusatz) items.push(["Zusatz", lineBox(tile.x + tile.w / 2, tile.y + tile.h * 0.7, copy.einmalpreisZusatz, tile.h * 0.12)]);
  if (copy.preisAlt) {
    const stattSize = Math.max(priceSize * 0.35, priceSize * 0.45);
    items.push(["statt-Preis", lineBox(tile.x + tile.w / 2, tile.y + tile.h * 0.86, `statt ${copy.preisAlt}`, stattSize)]);
  }
  const pillPrice = `+ ${copy.preis || "19,99 €"}`;
  const pillExtra = copy.preisZusatz || "pro Monat";
  items.push(["Pillentext", lineBox(pill.x + pill.w / 2, pill.y + pill.h * 0.38, pillPrice, Math.min(pill.h * 0.34, (pill.w * 0.82) / Math.max(1, pillPrice.length * 0.56)))]);
  items.push(["Pillentext", lineBox(pill.x + pill.w / 2, pill.y + pill.h * 0.72, pillExtra, Math.min(pill.h * 0.22, (pill.w * 0.82) / Math.max(1, pillExtra.length * 0.56)))]);
  return items;
}

function devicePill(tile: Box, price: string, extra: string): { box: Box; text: Box } {
  const height = tile.h * 0.52;
  const priceSize = height * 0.34;
  const extraSize = height * 0.22;
  const textW = Math.max(glyphWidth(`+ ${price || "19,99 €"}`, priceSize), glyphWidth(extra || "pro Monat", extraSize));
  const pad = Math.max(height * 0.4, textW * 0.18);
  const width = textW + pad * 2;
  const box = {
    x: tile.x + tile.w - width * 0.1,
    y: tile.y + (tile.h - height) / 2,
    w: width,
    h: height,
  };
  return { box, text: { x: box.x + pad, y: box.y + height * 0.14, w: textW, h: height * 0.72 } };
}

function overlapShare(left: Box, right: Box): number {
  const w = Math.max(0, Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x));
  const h = Math.max(0, Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y));
  return (w * h) / Math.max(1, left.w * left.h);
}

export type SquareFollow = { element: string; targets: string[]; rel: { x: number; y: number; w: number; h: number } };

export function priceGroupBox(tile: Box | undefined, pill: Box | undefined): Box | undefined {
  if (!tile || tile.w < 2) return undefined;
  if (!pill || pill.w < 2) return tile;
  const x = Math.min(tile.x, pill.x);
  const y = Math.min(tile.y, pill.y);
  return { x, y, w: Math.max(tile.x + tile.w, pill.x + pill.w) - x, h: Math.max(tile.y + tile.h, pill.y + pill.h) - y };
}

function overlaps(left: Box, right: Box): boolean {
  return left.x < right.x + right.w && right.x < left.x + left.w && left.y < right.y + right.h && right.y < left.y + left.h;
}

/** Clear space between two boxes. Zero when they overlap. */
function boxGap(left: Box, right: Box): number {
  const dx = left.x > right.x + right.w ? left.x - (right.x + right.w) : right.x > left.x + left.w ? right.x - (left.x + left.w) : 0;
  const dy = left.y > right.y + right.h ? left.y - (right.y + right.h) : right.y > left.y + left.h ? right.y - (left.y + left.h) : 0;
  if (dx === 0 && dy === 0) return 0;
  if (dx > 0 && dy > 0) return Math.hypot(dx, dy);
  return dx + dy;
}

export const WAVE_STROKE = 0.024;

/**
 * Parallel sine curves. The rise follows the format height and the run the
 * width, so a tall 9x16 keeps the bundle on the canvas behind the figure
 * instead of shooting off the right edge. The paint fades the strokes from
 * black at the upper left to orange at the lower right.
 */
export function wavePaths(width: number, height: number): Array<Array<{ x: number; y: number }>> {
  const count = 11;
  const spacing = width * 0.036;
  const amplitude = width * 0.016;
  const rise = height * 0.78;
  const run = width * 0.46;
  const length = Math.hypot(run, rise) || 1;
  const dx = run / length;
  const dy = -rise / length;
  const nx = rise / length;
  const ny = run / length;
  return Array.from({ length: count }, (_, index) => {
    const x0 = width * 0.58 + index * spacing * 0.85;
    const y0 = height * 1.02;
    const points: Array<{ x: number; y: number }> = [];
    for (let step = 0; step <= 72; step += 1) {
      const u = step / 72;
      const along = u * length;
      const wave = Math.sin(u * Math.PI * 2 * 3.4) * amplitude;
      points.push({ x: x0 + dx * along + nx * wave, y: y0 + dy * along + ny * wave });
    }
    return points;
  });
}

function pointSegmentDistance(x: number, y: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = dx * dx + dy * dy;
  const u = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
  return Math.hypot(x - (x1 + u * dx), y - (y1 + u * dy));
}

/** Share of the format covered by the wave strokes, without a person on top. */
export function wavePaintShare(width: number, height: number): number {
  const half = (width * WAVE_STROKE) / 2;
  const segments: Array<[number, number, number, number]> = [];
  for (const path of wavePaths(width, height)) {
    for (let index = 1; index < path.length; index += 1) {
      const from = path[index - 1];
      const to = path[index];
      if (from && to) segments.push([from.x, from.y, to.x, to.y]);
    }
  }
  const step = 8;
  let hit = 0;
  let total = 0;
  for (let y = step / 2; y < height; y += step) {
    for (let x = step / 2; x < width; x += step) {
      total += 1;
      if (segments.some(([x1, y1, x2, y2]) => pointSegmentDistance(x, y, x1, y1, x2, y2) <= half)) hit += 1;
    }
  }
  return total ? hit / total : 0;
}

/** Right edge of `count` chevrons. `scale` narrows them before the headline gives way. */
export function chevronReach(textEnd: number, fontSize: number, count = 3, scale = 1): number {
  const tip = fontSize * (58.568 / 73.924) * scale;
  const step = fontSize * (41.08 / 73.924) * scale;
  return textEnd + fontSize * 0.06 + Math.max(0, count - 1) * step + tip;
}

/**
 * Three chevrons have to fit. The arrows narrow first, but not below 70 percent.
 * The headline then shrinks. Only if it is already at the floor do the arrows go narrower.
 */
export function fitHeadlineForChevrons(textWidth: number, fontSize: number, canvasRight: number, origin = 0): { textWidth: number; fontSize: number; arrowScale: number } {
  let scale = 1;
  while (scale > 0.7 + 0.001 && chevronReach(origin + textWidth, fontSize, 3, scale) > canvasRight) scale = Math.max(0.7, scale - 0.02);
  let width = textWidth;
  let size = fontSize;
  const hold = fontSize * 0.9;
  while (size > hold && chevronReach(origin + width, size, 3, scale) > canvasRight) {
    size *= 0.97;
    width *= 0.97;
  }
  while (size > 8 && chevronReach(origin + width, size, 3, scale) > canvasRight) {
    size *= 0.97;
    width *= 0.97;
  }
  while (scale > 0.45 && chevronReach(origin + width, size, 3, scale) > canvasRight) scale = Math.max(0.45, scale - 0.02);
  return { textWidth: width, fontSize: size, arrowScale: scale };
}

/** A hint when the chevrons had to go below 70 percent of their normal width. */
export function chevronWidthHint(scale: number, label: string): string | undefined {
  if (scale >= 0.7 - 0.001) return undefined;
  return `Hinweis: Die Pfeile sind schmaler als 70 Prozent im ${label}.`;
}

/** Both 9x16 formats share the pixel size, so the channel stays in every message. */
export function sceneFormatLabel(format: { id: string; w: number; h: number }): string {
  if (format.id === "meta-9x16") return "1080x1920 Meta";
  if (format.id === "tiktok-9x16") return "1080x1920 Tiktok";
  return `${format.w}x${format.h}`;
}

/** Eyes, nose and mouth. The upper part of the measured head is hair and may be covered. */
export function faceCore(head: Box): Box {
  const hair = head.h * 0.42;
  return { x: head.x + head.w * 0.06, y: head.y + hair, w: Math.max(1, head.w * 0.88), h: Math.max(1, head.h - hair) };
}

/** Same sentence repeated per format becomes one line naming every format. */
export function dedupeHints(hints: readonly string[]): string[] {
  const order: string[] = [];
  const formats = new Map<string, string[]>();
  for (const hint of hints) {
    const match = hint.match(/^(.*?)\s+im\s+(\d+x\d+(?:\s+[A-Za-z]+)?)(\s+\([^)]*\))?\.?$/);
    const tail = (match?.[3] ?? "").trim();
    const key = match ? `${match[1].trim()}|${tail}` : hint.trim();
    if (!formats.has(key)) {
      formats.set(key, []);
      order.push(key);
    }
    const label = match?.[2];
    const bucket = formats.get(key);
    if (label && bucket && !bucket.includes(label)) bucket.push(label);
  }
  return order.map((key) => {
    const labels = formats.get(key) ?? [];
    if (!labels.length) return key;
    const split = key.indexOf("|");
    const text = key.slice(0, split);
    const tail = key.slice(split + 1).replace(/^\./, "").trim();
    const list = `(${labels.join(", ")})`;
    return tail ? `${text} ${list} ${tail}`.replace(/\s+\./g, ".").trim() : `${text} ${list}.`;
  });
}

/** Two lines of similar width. A single word stays on one line. */
export function splitBalanced(text: string, widthOf: (line: string) => number): [string, string] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [words[0] ?? "", ""];
  let best = 1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const score = Math.abs(widthOf(words.slice(0, index).join(" ")) - widthOf(words.slice(index).join(" ")));
    if (score < bestScore) {
      bestScore = score;
      best = index;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

/**
 * One line only when the text still fits at 42 percent of the rendered headline
 * size, so the painted cap height stays above the 35 percent floor. A line that
 * only just fits at 35 percent wraps instead. Wrapped lines never drop below 35 percent.
 * `headlineSize` is the font size after the headline has been fitted, not the box height.
 * `shorten` means even two lines do not fit.
 */
export function fitSublineText(
  text: string,
  headlineSize: number,
  maxWidth: number,
  widthOf: (sample: string, size: number) => number,
): { lines: string[]; size: number; shorten: boolean } {
  const minSize = Math.max(1, headlineSize * 0.35);
  const oneLineSize = Math.max(minSize, headlineSize * 0.42);
  const preferred = Math.max(oneLineSize, headlineSize * 0.5);
  const fits = (sample: string, size: number) => widthOf(sample, size) <= maxWidth + 1;
  if (fits(text, oneLineSize)) {
    let size = preferred;
    while (size > oneLineSize + 0.2 && !fits(text, size)) size *= 0.96;
    return { lines: [text], size: Math.max(oneLineSize, size), shorten: false };
  }
  let size = preferred;
  const pair = (sampleSize: number) => {
    const [left, right] = splitBalanced(text, (line) => widthOf(line, sampleSize));
    return { left, right, ok: Boolean(right) && fits(left, sampleSize) && fits(right, sampleSize) };
  };
  while (size > minSize + 0.2 && !pair(size).ok) size *= 0.96;
  const chosen = pair(Math.max(minSize, size));
  return {
    lines: [chosen.left, chosen.right].filter(Boolean),
    size: Math.max(minSize, size),
    shorten: !chosen.ok,
  };
}

/** At most two lines. Three words become “NUR BIS” / “SONNTAG”. */
export function starLines(text: string): string[] {
  const explicit = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  if (explicit.length >= 2) return explicit.slice(0, 2);
  const words = (explicit[0] ?? "").split(/\s+/).filter(Boolean);
  if (words.length <= 2) return words;
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

/** “50 GB” stays one line so the painted size can meet the minimum. “YOUNG DEAL” stays two. */
export function starDisplayLines(text: string): string[] {
  const lines = starLines(text);
  if (lines.length === 2 && `${lines[0] ?? ""}${lines[1] ?? ""}`.replace(/\s/g, "").length <= 6) return [`${lines[0]} ${lines[1]}`.trim()];
  return lines;
}

/** Painted burst diameter. The spike radius is 0.48 of the layout box. */
export function renderedStarDiameter(boxWidth: number): number {
  return boxWidth * 0.96;
}

/** Painted star text, using the same factors as the device burst. */
export function renderedStarTextSize(boxWidth: number, text: string): number {
  const lines = starDisplayLines(text);
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const lineSize = boxWidth * (lines.length >= 2 ? 0.28 : 0.42);
  return Math.min(lineSize, (boxWidth * 0.78) / (longest * 0.56));
}

/** Smallest star box whose painted text still reaches 2 percent of the format height. */
export function minimumStarBox(text: string, formatHeight: number): number {
  const minFont = Math.max(8, formatHeight * 0.02);
  const lines = starDisplayLines(text);
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const heightFactor = lines.length >= 2 ? 0.28 : 0.42;
  return Math.max(minFont / heightFactor, (minFont * longest * 0.56) / 0.7);
}

export function arrowSpan(start: number, fontSize: number, maxX: number, scale = 1): { end: number; count: number } {
  const height = fontSize;
  const tip = height * (58.568 / 73.924) * scale;
  const step = height * (41.08 / 73.924) * scale;
  let cursor = start + fontSize * 0.06;
  let count = 0;
  let end = start;
  for (let index = 0; index < 3 && cursor + tip <= maxX; index += 1) {
    end = cursor + tip;
    count += 1;
    cursor += step;
  }
  return { end, count };
}

function starBox(tile: Box, radius: number, extra: Box[]): Box {
  const size = radius / 0.48;
  let cx = tile.x + tile.w + size * 0.06;
  const cy = tile.y - size * 0.06;
  const blocked = [...tileInk(tile), ...extra];
  for (let step = 0; step < 6 && blocked.some((rect) => circleHits(cx, cy, size * 0.4, rect)); step += 1) cx += size * 0.08;
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size };
}

function circleHits(cx: number, cy: number, radius: number, rect: Box): boolean {
  if (rect.w < 2 || rect.h < 2) return false;
  const x = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const y = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - x;
  const dy = cy - y;
  return dx * dx + dy * dy < radius * radius;
}

function tileInk(tile: Box): Box[] {
  const limeH = tile.h * 0.52;
  const amountH = limeH * 0.4;
  const amountW = tile.w * 0.64;
  const altH = amountH * 0.5;
  const altW = tile.w * 0.38;
  return [
    { x: tile.x + (tile.w - amountW) / 2, y: tile.y + limeH * 0.38 - amountH / 2, w: amountW, h: amountH },
    { x: tile.x + (tile.w - altW) / 2, y: tile.y + limeH * 0.74 - altH / 2, w: altW, h: altH },
    { x: tile.x + tile.w * 0.16, y: tile.y + limeH + (tile.h - limeH) * 0.22, w: tile.w * 0.68, h: (tile.h - limeH) * 0.46 },
  ];
}

export function priceNeedsLegal(copy: Pick<SceneCopy, "preis" | "preisZusatz" | "einmalpreis" | "pflichttext">): boolean {
  const priced = `${copy.preis} ${copy.preisZusatz} ${copy.einmalpreis}`;
  return /[¹*]/.test(priced) && !copy.pflichttext.trim();
}

type Shift = { dx?: number; dy?: number; scale?: number; flip?: boolean; hidden?: boolean; color?: string };

export function shiftBox(
  target: Box,
  shift: Shift | undefined,
  width: number,
  height: number,
  anchor: "top-left" | "bottom-center",
  limits: { left: number; top: number; right: number; bottom: number },
): { box: Box | undefined; capped: boolean } {
  if (shift?.hidden) return { box: undefined, capped: false };
  if (!shift) return { box: target, capped: false };
  const wanted = shift.scale && shift.scale > 0 ? shift.scale : 1;
  const dx = ((shift.dx ?? 0) / 100) * width;
  const dy = ((shift.dy ?? 0) / 100) * height;
  const place = (scale: number): Box => {
    const w = target.w * scale;
    const h = target.h * scale;
    if (anchor === "bottom-center") {
      const cx = target.x + target.w / 2 + dx;
      const bottom = target.y + target.h + dy;
      return { x: cx - w / 2, y: bottom - h, w, h };
    }
    return { x: target.x + dx, y: target.y + dy, w, h };
  };
  let scale = wanted;
  let box = place(scale);
  const availableW = Math.max(8, limits.right - Math.max(limits.left, anchor === "top-left" ? target.x + dx : limits.left));
  const availableH = Math.max(8, limits.bottom - Math.max(limits.top, anchor === "top-left" ? target.y + dy : limits.top));
  if (box.w > availableW || box.h > availableH || box.x < limits.left || box.y < limits.top || box.x + box.w > limits.right || box.y + box.h > limits.bottom) {
    scale = Math.min(scale, availableW / Math.max(1, target.w), availableH / Math.max(1, target.h));
    box = place(Math.max(0.2, scale));
    if (anchor === "top-left") {
      box = { ...box, x: Math.max(limits.left, box.x), y: Math.max(limits.top, box.y) };
      if (box.x + box.w > limits.right) box = { ...box, w: limits.right - box.x };
      if (box.y + box.h > limits.bottom) box = { ...box, h: limits.bottom - box.y };
    }
  }
  return { box, capped: wanted > 1 && box.w < target.w * wanted - 1 };
}

function pointInPolygon(x: number, y: number, points: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function mirrorBox(target: Box, width: number, flip: boolean): Box {
  if (!flip) return target;
  return { x: width - target.x - target.w, y: target.y, w: target.w, h: target.h };
}

function keepInside(target: Box, width: number, height: number, right: number, bottom: number): Box {
  const x = Math.max(width * 0.05, Math.min(target.x, width * right - target.w));
  const w = Math.min(target.w, width * right - x);
  const y = Math.max(height * 0.05, Math.min(target.y, height * bottom - 4));
  const h = Math.min(target.h, height * bottom - y);
  return { x, y, w: Math.max(8, w), h: Math.max(8, h) };
}

function slideBox(target: Box, shift: Shift | undefined, width: number, height: number): Box {
  const dx = ((shift?.dx ?? 0) / 100) * width;
  const dy = ((shift?.dy ?? 0) / 100) * height;
  if (!dx && !dy) return target;
  return { ...target, x: target.x + dx, y: target.y + dy };
}

function applyShift(target: Box, shift: Shift | undefined, width: number, height: number, anchor: "top-left" | "bottom-center", limits: { left: number; top: number; right: number; bottom: number }, caps: string[], name: string): Box | undefined {
  const placed = shiftBox(target, shift, width, height, anchor, limits);
  if (placed.capped) caps.push(`${name} auf das Maximum vergrößert`);
  return placed.box;
}

const NAME_EM = 0.55;

function captionNameHeight(width: number, height: number, tall: boolean): number {
  if (tall) return height * 0.03;
  if (width / height > 1.5) return Math.max(height * 0.05, width * 0.03);
  return height * 0.03;
}

function captionPair(width: number, height: number, tall: boolean, name: string, nameHeight = 0): { name: Box; badge: Box } {
  const nameH = nameHeight > 0 ? nameHeight : captionNameHeight(width, height, tall);
  const nameW = Math.max(width * 0.12, Math.max(1, name.length) * nameH * NAME_EM);
  const badgeH = Math.max(nameH * 1.5, height * 0.03);
  const badgeW = badgeH * (91.15 / 50.12);
  const gap = width * (tall ? 0.016 : 0.012);
  if (!tall) {
    const badge = { x: width - badgeW - width * 0.02, y: height * 0.955 - badgeH, w: badgeW, h: badgeH };
    return { badge, name: { x: badge.x - gap - nameW, y: badge.y + (badge.h - nameH) / 2, w: nameW, h: nameH } };
  }
  const left = width * 0.055;
  const badge = { x: left + nameW + gap, y: height - badgeH - height * 0.018, w: badgeW, h: badgeH };
  return { badge, name: { x: left, y: badge.y + (badge.h - nameH) / 2, w: nameW, h: nameH } };
}

function energyFrame(width: number, height: number, tall: boolean, product: Box, visible?: Box, name = "", nameHeight = 0): Box {
  if (tall && name.trim() && visible) return captionPair(width, height, true, name.trim(), nameHeight).badge;
  const nameH = captionNameHeight(width, height, tall);
  const badgeH = Math.max(nameH * 1.5, height * 0.03);
  const badgeW = badgeH * (91.15 / 50.12);
  if (!tall) return { x: width - badgeW - width * 0.02, y: height * 0.955 - badgeH, w: badgeW, h: badgeH };
  const y = Math.min(product.y + product.h - badgeH * 0.15, height - badgeH - height * 0.012);
  const x = Math.min(width - badgeW - width * 0.02, Math.max(width * 0.62, product.x + product.w - badgeW - width * 0.02));
  return { x, y, w: badgeW, h: badgeH };
}

function deviceNameBox(width: number, height: number, tall: boolean, product: Box, visible: Box | undefined, name: string, nameHeight = 0): Box {
  if (name.trim() && (!tall || visible)) return captionPair(width, height, tall, name.trim(), nameHeight).name;
  const badge = energyFrame(width, height, tall, product, visible, name);
  const nameH = captionNameHeight(width, height, tall);
  const right = badge.x - width * 0.012;
  const left = tall ? Math.max(width * 0.28, right - width * 0.42) : width * 0.36;
  return { x: left, y: badge.y + (badge.h - nameH) / 2, w: Math.max(8, right - left), h: nameH };
}

/**
 * Shrinks and shifts the layout box until the painted alpha of the phone
 * starts at `need` and the device still fits on the canvas.
 */
function clearPhoneForCaption(product: Box, cutout: Cutout, need: number, canvasW: number, canvasH: number, avoid?: Box): void {
  const bottom = Math.min(product.y + product.h, canvasH);
  let aim = need;
  let frame = paintedProduct(product, cutout, canvasW, true, -0.1, avoid, aim);
  for (let step = 0; step < 4 && frame.opaque.x < need - 1; step += 1) {
    aim += need - frame.opaque.x;
    frame = paintedProduct(product, cutout, canvasW, true, -0.1, avoid, aim);
  }
  product.h = frame.h;
  product.y = bottom - product.h;
  product.x = frame.cx - product.w / 2;
}

function buildKachel(
  format: { id: string; w: number; h: number },
  name: VorlageName,
  copy: SceneCopy,
  shifts: Partial<Record<"headline" | "subline" | "stoerer" | "person" | "geraet" | "cta" | "logo" | "pflichttext" | "energielabel" | "schraege" | "deko" | "kachel" | "pfeile" | "stattpreis" | "altwert" | "zusatz" | "einmalig" | "geraetename", Shift>>,
  cutout?: Cutout,
  follows?: readonly SquareFollow[],
  productCutout?: Cutout,
): OteloScene {
  const { w, h } = format;
  const wide = w / h > 1.5;
  const tall = format.id.endsWith("9x16");
  const mid = !wide && !tall && h > w;
  const tiktok = format.id === "tiktok-9x16";
  const flip = copy.orange === "links";
  const deviceMode = name === "kachel_geraet" || name === "kachel_geraet_person";
  const left = w * 0.06;
  const headW = wide ? w * 0.55 : tall ? w * (tiktok ? 0.78 : 0.83) : w * 0.83;
  const headH = tall ? h * 0.062 : wide ? h * 0.12 : h * 0.11;
  const headY = tall ? h * 0.134 : h * 0.055;
  const headline = {
    lines: [/[a-zäöü]/.test(copy.headline) ? copy.headline.replace(/\s+/g, " ").trim() : (copy.headline.replace(/\s+/g, " ").trim().toUpperCase() || "BLACK WEEK")],
    variant: "direkt" as const,
    box: mirrorBox(box(left, headY, headW, headH), w, flip),
    step: 0,
  };
  const subline = {
    lines: copy.subline.split(/\n/).map((line) => line.trim()).filter(Boolean).slice(0, 2).map((text) => ({ text: /[a-zäöü]/.test(text) ? text : text.toUpperCase(), bold: true, color: shifts.subline?.color || copy.sublineColor || ORANGE })),
    box: mirrorBox(box(left, headline.box.y + headline.box.h + (wide ? headH * 0.16 : h * 0.012), headline.box.w, headH * 0.62), w, flip),
  };
  const sublineText = subline.lines.map((line) => line.text).join(" ");
  if (sublineText) {
    const reserved = fitSublineText(sublineText, headH, Math.max(8, subline.box.w), (sample, size) => Math.max(1, sample.length) * size * 0.7);
    if (reserved.lines.length > 1) subline.box.h = Math.max(subline.box.h, reserved.size * 2.2);
  }
  const tileRaw = deviceMode
    ? box(left, tall ? h * 0.26 : subline.box.y + subline.box.h + h * 0.04, wide ? w * 0.2 : tall ? w * 0.42 : w * 0.26, wide ? h * 0.36 : tall ? h * 0.12 : h * 0.22)
    : wide
      ? box(left, subline.box.y + subline.box.h + h * 0.035, w * 0.22, h * 0.42)
      : box(left, tall ? h * 0.28 : h * 0.3, w * (tall ? 0.5 : 0.45), tall ? h * 0.28 : h * 0.4);
  if (tileRaw.y < subline.box.y + subline.box.h + h * 0.012) tileRaw.y = subline.box.y + subline.box.h + h * 0.012;
  const pillBuilt = deviceMode ? devicePill(tileRaw, copy.preis, copy.preisZusatz) : undefined;
  const pillRaw = pillBuilt?.box;
  const pillTextRaw = pillBuilt?.text;
  const tile = mirrorBox(tileRaw, w, flip);
  const logoW = w * 0.25;
  const logoTop = h * 0.94 - logoW / 5.58;
  let ctaH = Math.max(wide ? h * 0.14 : tall ? h * 0.05 : h * 0.082, h * ((format.id.startsWith("pmax") ? 0.03 : tall ? 0.022 : 0.025) / 0.48));
  let ctaRaw = (!deviceMode && wide)
    ? box(tileRaw.x + tileRaw.w + w * 0.02, tileRaw.y + tileRaw.h - ctaH, w * 0.26, ctaH)
    : box(left, tall ? h * 0.66 : h * 0.74, w * (tall ? 0.55 : wide ? 0.46 : 0.58), ctaH);
  if (deviceMode && wide) {
    const below = Math.max(tileRaw.y + tileRaw.h, pillRaw ? pillRaw.y + pillRaw.h : 0) + h * 0.02;
    ctaRaw = box(left, below, Math.max(w * 0.26, w * 0.42), ctaH);
  } else if (deviceMode && tall) {
    ctaH = Math.max(h * 0.05, h * (0.022 / 0.48));
    const stack = tileRaw.y + tileRaw.h + h * 0.012;
    ctaRaw = box(left, stack, w * 0.55, ctaH);
  }
  const cta = {
    box: mirrorBox(ctaRaw, w, flip),
    text: copy.button.trim() || (deviceMode ? "Jetzt sichern" : ""),
  };
  const showLogo = !tall;
  const logo = {
    box: showLogo ? box(w * 0.05, logoTop, logoW, logoW / 5.58) : box(0, 0, 0, 0),
    side: "left" as const,
  };
  let figure = name === "kachel_geraet" ? undefined : mirrorBox(wide
    ? box(w * 0.52, h * 0.06, w * 0.5, h * 0.96)
    : tall
      ? box(w * 0.28, h * 0.4, w * 0.78, h * 0.62)
      : mid
        ? box(w * 0.34, h * 0.35, w * 0.7, h * 0.7)
        : box(w * 0.4, h * 0.3, w * 0.64, h * 0.74), w, flip);
  const deviceH = h * (deviceMode ? (tall ? 0.5 : 0.6) : tall ? 0.42 : wide ? 0.72 : 0.58);
  const deviceTop = deviceMode && tall ? ctaRaw.y + ctaRaw.h + h * 0.006 : h * 0.18;
  const device = name === "kachel_person" ? undefined : mirrorBox(deviceMode
    ? tall ? box(w * 0.08, deviceTop, w * 1.05, Math.max(deviceH, h * 1.05 - deviceTop)) : box(wide ? w * 0.62 : w * 0.5, wide ? subline.box.y : Math.max(subline.box.y + subline.box.h + h * 0.02, h * 0.28), wide ? w * 0.4 : w * 0.48, deviceH)
    : box(w * 0.52, h * 0.22, Math.min(w * 0.42, deviceH * 0.7), deviceH), w, flip);
  const sternRadius = tileRaw.w * (wide ? 0.22 : 0.2125);
  const deviceStar = copy.sternText?.trim() || copy.datenmenge?.trim() || "";
  const starWords = (deviceStar || copy.sternText || "").trim().split(/\s+/).filter(Boolean).length;
  const starSize = Math.min(w * 0.24, h * 0.22) * (starWords >= 3 ? 1.15 : 1);
  const groupRaw = pillRaw
    ? { x: Math.min(tileRaw.x, pillRaw.x), y: Math.min(tileRaw.y, pillRaw.y), w: Math.max(tileRaw.x + tileRaw.w, pillRaw.x + pillRaw.w) - Math.min(tileRaw.x, pillRaw.x), h: Math.max(tileRaw.y + tileRaw.h, pillRaw.y + pillRaw.h) - Math.min(tileRaw.y, pillRaw.y) }
    : tileRaw;
  const stern = deviceMode
    ? (deviceStar ? { box: mirrorBox(cornerStar(groupRaw, starSize, "tr", 0), w, flip), text: deviceStar } : undefined)
    : copy.sternText?.trim()
      ? { box: mirrorBox(starBox(tileRaw, sternRadius, [headline.box, subline.box]), w, flip), text: copy.sternText.trim() }
      : undefined;
  let headBox: Box | undefined;
  let motifShort = false;
  if (cutout && figure && name !== "kachel_geraet") {
    const topFraction = wide ? 0.15 : tall ? 0.45 : 0.35;
    const personTop = h * topFraction;
    const inTheWay = [headline.box, subline.box, tile].filter((item) => item.y + item.h > personTop + 4 && item.w > 2);
    const blockRight = inTheWay.length ? Math.max(...inTheWay.map((item) => item.x + item.w)) : w * 0.42;
    const blockLeft = inTheWay.length ? Math.min(...inTheWay.map((item) => item.x)) : w * 0.5;
    const onRight = blockLeft < w * 0.35;
    const placedPerson = placeCutout({
      canvasW: w,
      canvasH: h,
      cutout,
      left: onRight ? blockRight + w * 0.012 : w * 0.02,
      topFraction,
      pin: tall ? "edge" : wide ? "past" : undefined,
      topMin: tall ? 0.35 : undefined,
    });
    if (!onRight && placedPerson.figure.x + placedPerson.figure.w > blockLeft - w * 0.01) {
      const overflow = placedPerson.figure.x + placedPerson.figure.w - (blockLeft - w * 0.01);
      placedPerson.figure.x -= overflow;
      placedPerson.head.x -= overflow;
    }
    figure = placedPerson.figure;
    headBox = placedPerson.head;
    motifShort = placedPerson.short;
  }
  const dekoName = dekoFor(copy);
  const deko = shifts.deko?.hidden || dekoName === "keine"
    ? undefined
    : { name: dekoName, box: mirrorBox(box(w * 0.45, h * 0.15, w * 0.55, h * 0.85), w, flip), strength: shifts.deko?.scale ?? 1 };
  const fit = (target: Box) => tiktok ? keepInside(target, w, h, 0.84, 0.78) : target;
  headline.box = fit(headline.box);
  subline.box = fit(subline.box);
  const fittedTile = shifts.kachel?.hidden ? box(0, 0, 0, 0) : (applyShift(fit(tile), shifts.kachel, w, h, "top-left", { left: w * 0.04, top: h * 0.04, right: w * 0.96, bottom: h * 0.96 }, [], "Kachel") ?? fit(tile));
  const fittedPill = pillRaw ? fit(mirrorBox(pillRaw, w, flip)) : undefined;
  cta.box = fit(cta.box);
  if (stern) stern.box = fit(stern.box);
  const caps: string[] = [];
  const textLimits = { left: w * 0.04, top: h * (tall ? 0.1 : 0.04), right: w * (tiktok ? 0.84 : 0.955), bottom: h * (tiktok ? 0.78 : 0.955) };
  const figureLimits = { left: -w * 0.6, top: -h * 0.02, right: w * 3, bottom: h * 1.2 };
  const placed = {
    figure: figure ? applyShift(figure, shifts.person, w, h, "top-left", figureLimits, caps, "Frau") : undefined,
    product: device ? applyShift(device, shifts.geraet, w, h, "bottom-center", figureLimits, caps, "Gerät") : undefined,
    headline: applyShift(headline.box, shifts.headline, w, h, "top-left", textLimits, caps, "Headline") ?? headline.box,
    subline: applyShift(subline.box, shifts.subline, w, h, "top-left", textLimits, caps, "Unterzeile") ?? subline.box,
    cta: applyShift(cta.box, shifts.cta, w, h, "top-left", textLimits, caps, "Leiste") ?? cta.box,
    pill: fittedPill,
    logo: applyShift(logo.box, shifts.logo, w, h, "top-left", textLimits, caps, "Logo"),
    stern: stern ? applyShift(stern.box, shifts.stoerer ? { ...shifts.stoerer, scale: 1, dx: 0, dy: 0 } : undefined, w, h, "top-left", { ...textLimits, right: w * 1.02, top: 0 }, caps, "Stern") : undefined,
  };
  const deviceScaledH = placed.product?.h;
  if (fittedPill) {
    fittedPill.x += fittedTile.x - tile.x;
    fittedPill.y += fittedTile.y - tile.y;
  }
  if (placed.stern) placed.stern.y += fittedTile.y - tile.y;
  if (deviceMode && wide && placed.product) {
    const textRight = Math.max(placed.headline.x + placed.headline.w, placed.subline.x + placed.subline.w, placed.cta.x + placed.cta.w);
    const minX = textRight + w * 0.025;
    if (placed.product.x < minX) {
      placed.product.x = minX;
      if (placed.product.x + placed.product.w > w * 1.02) placed.product.w = Math.max(w * 0.2, w * 1.02 - placed.product.x);
    }
  }
  if (placed.figure && headBox && figure) {
    headBox = {
      x: headBox.x + (placed.figure.x - figure.x),
      y: headBox.y + (placed.figure.y - figure.y),
      w: headBox.w * (figure.w ? placed.figure.w / figure.w : 1),
      h: headBox.h * (figure.h ? placed.figure.h / figure.h : 1),
    };
  }
  if (placed.figure && headBox && headBox.w > 2) {
    const faceTexts = [placed.headline, placed.subline, placed.cta, ...(deviceMode ? [] : tileInk(fittedTile))].filter((item) => item.w > 2 && item.h > 2);
    const faceScore = () => {
      if (!headBox) return 0;
      let score = 0;
      for (const item of faceTexts) if (overlaps(headBox, item)) score += 5000;
      if (fittedTile.w > 2) {
        const gap = boxGap(headBox, fittedTile);
        const overlapY = Math.min(headBox.y + headBox.h, fittedTile.y + fittedTile.h) - Math.max(headBox.y, fittedTile.y);
        if (gap < w * 0.05 - 1) score += w * 0.05 - gap + (overlaps(headBox, fittedTile) ? 1000 : 0) + Math.max(0, overlapY);
      }
      return score;
    };
    const nudge = (dx: number, dy: number) => {
      if (!placed.figure || !headBox) return false;
      const before = faceScore();
      placed.figure.x += dx;
      placed.figure.y += dy;
      headBox.x += dx;
      headBox.y += dy;
      if (!headInside(headBox, w, h) || faceScore() >= before - 0.5) {
        placed.figure.x -= dx;
        placed.figure.y -= dy;
        headBox.x -= dx;
        headBox.y -= dy;
        return false;
      }
      return true;
    };
    const stepAside = () => {
      for (let step = 0; step < 80 && faceScore() > 0; step += 1) {
        if (!nudge(w * 0.02, 0) && !nudge(Math.max(2, w * 0.004), 0) && !nudge(0, h * 0.02) && !nudge(0, Math.max(2, h * 0.004))) break;
      }
    };
    stepAside();
    if (faceScore() > 0 && placed.figure && headBox) {
      const previousFigure = { ...placed.figure };
      const previousHead = { ...headBox };
      const bottom = placed.figure.y + placed.figure.h;
      const centerX = placed.figure.x + placed.figure.w / 2;
      const relX = (headBox.x - placed.figure.x) / Math.max(1, placed.figure.w);
      const relY = (headBox.y - placed.figure.y) / Math.max(1, placed.figure.h);
      const relW = headBox.w / Math.max(1, placed.figure.w);
      const relH = headBox.h / Math.max(1, placed.figure.h);
      placed.figure.w *= 0.9;
      placed.figure.h *= 0.9;
      placed.figure.x = centerX - placed.figure.w / 2;
      placed.figure.y = bottom - placed.figure.h;
      if (tall) {
        const pin = h - (placed.figure.y + placed.figure.h);
        if (pin > 1) placed.figure.y += pin;
      }
      headBox = {
        x: placed.figure.x + relX * placed.figure.w,
        y: placed.figure.y + relY * placed.figure.h,
        w: relW * placed.figure.w,
        h: relH * placed.figure.h,
      };
      if (!headInside(headBox, w, h)) {
        placed.figure.x = previousFigure.x;
        placed.figure.y = previousFigure.y;
        placed.figure.w = previousFigure.w;
        placed.figure.h = previousFigure.h;
        headBox = previousHead;
      }
    }
    stepAside();
  }
  const settleStar = () => {
    if (!placed.stern || placed.stern.w < 2) return;
    const anchor = deviceMode ? (priceGroupBox(fittedTile, placed.pill) ?? fittedTile) : fittedTile;
    const ceiling = Math.max(placed.headline.y + placed.headline.h, placed.subline.y + placed.subline.h);
    const bounds = { left: w * 0.04, top: Math.max(h * (tall ? 0.1 : 0.04), ceiling), right: w * (tiktok ? 0.85 : 0.96), bottom: h * (tiktok ? 0.8 : 0.96) };
    const offerInk = [
      { x: fittedTile.x + fittedTile.w * 0.14, y: fittedTile.y + fittedTile.h * 0.08, w: fittedTile.w * 0.72, h: fittedTile.h * 0.14 },
      { x: fittedTile.x + fittedTile.w * 0.2, y: fittedTile.y + fittedTile.h * 0.32, w: fittedTile.w * 0.6, h: fittedTile.h * 0.22 },
      { x: fittedTile.x + fittedTile.w * 0.18, y: fittedTile.y + fittedTile.h * 0.76, w: fittedTile.w * 0.64, h: fittedTile.h * 0.14 },
    ];
    const texts = [
      placed.headline,
      placed.subline,
      placed.cta,
      ...(placed.logo && placed.logo.w > 2 ? [placed.logo] : []),
      ...(deviceMode ? offerInk : tileInk(fittedTile)),
      ...(placed.pill && placed.pill.w > 2 ? [placed.pill] : []),
    ];
    const offCanvas = (spot: Box) => spot.y < ceiling - 1
      || spot.x < bounds.left - 1
      || spot.y < h * (tall ? 0.1 : 0.04) - 1
      || spot.x + spot.w > bounds.right + 1
      || spot.y + spot.h > bounds.bottom + 1;
    const hitsCopy = (spot: Box) => texts.some((item) => item.w > 2 && item.h > 2 && overlaps(spot, item))
      || Boolean(headBox && headBox.w > 2 && overlaps(spot, faceCore(headBox)));
    const deviceShare = (spot: Box) => placed.product ? overlapShare(spot, placed.product) : 0;
    const start = placed.stern.w;
    const minSize = start * 0.8;
    let closest: { spot: Box; share: number } | undefined;
    const slide = (size: number, which: "tr" | "tl"): Box | undefined => {
      const xs: number[] = [];
      if (which === "tr") {
        for (let x = anchor.x + anchor.w - size * 0.22; x >= anchor.x - size * 0.15; x -= Math.max(8, size * 0.1)) xs.push(x);
      } else {
        for (let x = anchor.x - size * 0.78; x <= anchor.x + anchor.w - size * 0.7; x += Math.max(8, size * 0.1)) xs.push(x);
      }
      const y0 = Math.max(ceiling, anchor.y - size * 0.18);
      const yMax = Math.min(bounds.bottom - size, anchor.y + (tall && !deviceMode ? anchor.h * 0.42 : anchor.h) - size * 0.15);
      for (const x of xs) {
        for (let y = y0; y <= yMax + 0.5; y += Math.max(6, size * 0.07)) {
          const spot = {
            x: Math.max(bounds.left, Math.min(x, bounds.right - size)),
            y: Math.max(ceiling, y),
            w: size,
            h: size,
          };
          if (offCanvas(spot) || hitsCopy(spot)) continue;
          const share = deviceShare(spot);
          if (share <= 0.05) return spot;
          if (!closest || share < closest.share) closest = { spot, share };
        }
      }
      return undefined;
    };
    for (const which of ["tr", "tl"] as const) {
      let size = start;
      const found = slide(size, which);
      if (found) {
        placed.stern.x = found.x;
        placed.stern.y = found.y;
        placed.stern.w = found.w;
        placed.stern.h = found.h;
        return;
      }
      while (size > minSize + 0.5) {
        size = Math.max(minSize, size * 0.95);
        const smaller = slide(size, which);
        if (smaller) {
          placed.stern.x = smaller.x;
          placed.stern.y = smaller.y;
          placed.stern.w = smaller.w;
          placed.stern.h = smaller.h;
          return;
        }
        if (size <= minSize + 0.01) break;
      }
    }
    const reserve = closest?.spot;
    if (reserve) {
      placed.stern.x = reserve.x;
      placed.stern.y = reserve.y;
      placed.stern.w = reserve.w;
      placed.stern.h = reserve.h;
    }
  };
  if (!deviceMode) settleStar();
  const settledStar = placed.stern ? { x: placed.stern.x, y: placed.stern.y, w: placed.stern.w, h: placed.stern.h } : undefined;
  for (const follow of follows ?? []) {
    const wanted = follow.targets.some((token) => token === format.id || token === `${w}x${h}` || format.id.endsWith(token) || (token === "9x16" && format.id.endsWith("9x16")) || (token === "1x1" && format.id.endsWith("1x1")));
    if (!wanted || format.id === "pmax-1200x1200") continue;
    const group = priceGroupBox(fittedTile, placed.pill);
    if (!group) continue;
    const moved = {
      x: group.x + follow.rel.x * group.w,
      y: group.y + follow.rel.y * group.h,
      w: follow.rel.w * group.w,
      h: follow.element === "stoerer" ? follow.rel.w * group.w : follow.rel.h * group.h,
    };
    const target = follow.element === "stoerer" ? placed.stern : follow.element === "headline" ? placed.headline : follow.element === "subline" ? placed.subline : follow.element === "cta" ? placed.cta : undefined;
    if (!target) continue;
    target.x = moved.x;
    target.y = moved.y;
    target.w = moved.w;
    target.h = moved.h;
  }
  if (!deviceMode) settleStar();
  if (!deviceMode && placed.stern && settledStar && (placed.stern.y < Math.max(placed.headline.y + placed.headline.h, placed.subline.y + placed.subline.h) - 1 || overlaps(placed.stern, placed.cta) || (placed.pill && overlaps(placed.stern, placed.pill)) || (placed.product && overlapShare(placed.stern, placed.product) > 0.05))) {
    placed.stern.x = settledStar.x;
    placed.stern.y = settledStar.y;
    placed.stern.w = settledStar.w;
    placed.stern.h = settledStar.h;
  }
  let captionNameH = 0;
  let captionNeed = 0;
  if (tall && deviceMode && placed.product && productCutout && copy.geraetName?.trim()) {
    captionNameH = h * 0.03;
    const pair = captionPair(w, h, true, copy.geraetName.trim(), captionNameH);
    captionNeed = pair.badge.x + pair.badge.w + w * 0.016;
    clearPhoneForCaption(placed.product, productCutout, captionNeed, w, h, placed.cta);
  }
  if (deviceMode && !tall && placed.stern && fittedTile.w > 2 && fittedPill && fittedPill.w > 2) {
    const glyphs = deviceGlyphs(fittedTile, fittedPill, copy).map((item) => item[1]);
    const ceiling = placed.subline.y + placed.subline.h;
    const hitsInk = (box: Box) => glyphs.some((item) => item.w > 2 && overlaps(box, item))
      || overlaps(box, placed.headline)
      || overlaps(box, placed.subline)
      || (placed.cta.w > 2 && overlaps(box, placed.cta));
    const floor = Math.max(fittedTile.w * 0.45 / 0.96, minimumStarBox(stern?.text ?? "", h));
    const squareLike = !wide && !tall;
    const full = squareLike
      ? Math.max(floor, fittedTile.w * 0.5 / 0.96)
      : Math.max(floor, Math.min(fittedTile.w * 0.9, h * 0.36));
    const starLimit = w * 0.98;
    const pillAir = Math.max(8, w * 0.012);
    const gapToPill = (star: Box) => {
      const dx = star.x > fittedPill.x + fittedPill.w ? star.x - (fittedPill.x + fittedPill.w) : fittedPill.x > star.x + star.w ? fittedPill.x - (star.x + star.w) : 0;
      const dy = star.y > fittedPill.y + fittedPill.h ? star.y - (fittedPill.y + fittedPill.h) : fittedPill.y > star.y + star.h ? fittedPill.y - (star.y + star.h) : 0;
      if (dx === 0 && dy === 0) return 0;
      if (dx > 0 && dy > 0) return Math.hypot(dx, dy);
      return dx + dy;
    };
    let chosen: Box | undefined;
    let clear: Box | undefined;
    for (let size = full; size >= floor - 0.5; size = Math.max(floor, size * 0.94)) {
      const step = Math.max(8, size * 0.07);
      const top = Math.max(ceiling + 1, fittedTile.y - size * 0.45);
      for (let y = top; !chosen && y + size / 2 <= fittedTile.y + fittedTile.h * 0.55; y += step) {
        for (let x = fittedTile.x + fittedTile.w - size * 0.7; x + size <= starLimit; x += step) {
          const candidate = { x, y, w: size, h: size };
          const meets = overlaps(candidate, fittedTile) || overlaps(candidate, fittedPill);
          if (!meets || hitsInk(candidate)) continue;
          if (!clear) clear = candidate;
          if (gapToPill(candidate) >= pillAir) {
            chosen = candidate;
            break;
          }
        }
      }
      if (chosen || size <= floor + 0.5) break;
    }
    if (!chosen) chosen = clear;
    if (chosen && w === h && gapToPill(chosen) < pillAir) {
      const overlapX = Math.min(chosen.x + chosen.w, fittedPill.x + fittedPill.w) - Math.max(chosen.x, fittedPill.x);
      if (overlapX > 0 && overlapX < chosen.w * 0.45) {
        const shifted = { ...chosen, x: chosen.x + overlapX + pillAir };
        if (shifted.x + shifted.w <= starLimit && !hitsInk(shifted)) chosen = shifted;
      }
    }
    if (!chosen) {
      const size = floor;
      chosen = {
        x: Math.min(fittedTile.x + fittedTile.w - size * 0.35, starLimit - size),
        y: Math.max(ceiling + 1, fittedTile.y - size * 0.35),
        w: size,
        h: size,
      };
    }
    placed.stern.x = chosen.x;
    placed.stern.y = chosen.y;
    placed.stern.w = chosen.w;
    placed.stern.h = chosen.h;
  }
  if (tall && deviceMode && placed.stern && fittedPill && fittedPill.w > 2 && fittedTile.w > 2) {
    const full = Math.max(fittedTile.w * 0.47 / 0.96, fittedTile.w * 0.2125 / 0.48, h * 0.105, Math.min(w, h) * 0.15, minimumStarBox(stern?.text ?? "", h));
    const floor = Math.max(fittedTile.w * 0.47 / 0.96, h * 0.105, minimumStarBox(stern?.text ?? "", h));
    const junction = fittedTile.x + fittedTile.w;
    const shelf = Math.min(fittedPill.y + fittedPill.h, fittedTile.y + fittedTile.h);
    const glyphs = deviceGlyphs(fittedTile, fittedPill, copy);
    const seen = productCutout && placed.product ? visibleProductBox(placed.product, productCutout, tall, -0.1) : undefined;
    const safeRight = w * (tiktok ? 0.84 : 0.96);
    let best: { x: number; y: number; size: number; score: number } | undefined;
    for (let size = full; size >= floor - 0.5; size = Math.max(floor, size * 0.94)) {
      const corner = { x: junction - size * 0.22, y: shelf - size * 0.18, w: size * 0.5, h: size * 0.28 };
      for (let row = 0; row <= 18; row += 1) {
        for (let col = 0; col <= 16; col += 1) {
          const x = junction - size * 0.72 + col * size * 0.06;
          const y = shelf - size * 0.28 + row * size * 0.045;
          const candidate = { x, y, w: size, h: size };
          if (x < w * 0.03 || x + size > safeRight) continue;
          const cx = x + size / 2;
          const cy = y + size / 2;
          const inside = (shape: Box) => cx > shape.x && cx < shape.x + shape.w && cy > shape.y && cy < shape.y + shape.h;
          if (inside(fittedPill) || inside(fittedTile)) continue;
          if (!overlaps(candidate, fittedPill) && !overlaps(candidate, fittedTile)) continue;
          if (!overlaps(candidate, corner)) continue;
          if (glyphs.some((item) => overlaps(candidate, item[1]))) continue;
          if (overlaps(candidate, placed.headline) || overlaps(candidate, placed.subline) || (placed.cta.w > 2 && overlaps(candidate, placed.cta))) continue;
          if (seen && overlapShare(candidate, seen) > 0.05) continue;
          const onPill = overlaps(candidate, fittedPill) ? 0 : 12;
          const score = (full - size) * 4 + row + Math.abs(col - 8) * 0.5 + onPill;
          if (!best || score < best.score) best = { x, y, size, score };
        }
      }
      if (best || size <= floor + 0.5) break;
    }
    const size = best?.size ?? full;
    placed.stern.w = size;
    placed.stern.h = size;
    placed.stern.x = best?.x ?? junction - size * 0.2;
    placed.stern.y = best?.y ?? shelf + h * 0.01;
    if (placed.cta.w > 2 && overlaps(placed.stern, placed.cta)) {
      const logoTop = placed.logo && placed.logo.w > 2 ? placed.logo.y : h;
      const need = placed.stern.y + placed.stern.h + h * 0.012;
      const maxTop = logoTop - placed.cta.h - h * 0.016;
      if (need <= maxTop) placed.cta.y = Math.max(placed.cta.y, need);
    }
    if (tall && placed.product && placed.cta.w > 2) {
      const under = placed.cta.y + placed.cta.h + h * 0.006;
      if (placed.product.y < under) placed.product.y = under;
      const seen = productCutout ? visibleProductBox(placed.product, productCutout, true, -0.1) : placed.product;
      if (overlapShare(placed.stern, seen) > 0.05) placed.product.y += placed.stern.y + placed.stern.h + h * 0.008 - seen.y;
    }
  }
  if (!deviceMode && (format.id === "pmax-960x1200" || format.id.endsWith("9x16")) && placed.stern && fittedTile.w > 2) {
    const ceiling = placed.subline.y + placed.subline.h;
    const ink = tileInk(fittedTile);
    const textFloor = minimumStarBox(stern?.text ?? "", h);
    const portrait = format.id.endsWith("9x16");
    let size = Math.max(fittedTile.w * (portrait ? 0.72 : 0.2125 / 0.48), textFloor);
    const minSize = Math.max(fittedTile.w * (portrait ? 0.47 : 0.22), textFloor);
    const faceNow = () => (headBox && headBox.w > 2 ? faceCore(headBox) : undefined);
    const onFace = (star: Box) => {
      const face = faceNow();
      return Boolean(face && overlaps(star, face));
    };
    const onCta = (star: Box) => placed.cta.w > 2 && overlaps(star, placed.cta);
    const blocked = () => onFace(placed.stern!) || onCta(placed.stern!) || ink.some((item) => item.w > 2 && overlaps(placed.stern!, item)) || overlaps(placed.stern!, placed.headline) || overlaps(placed.stern!, placed.subline);
    const seat = (next: number) => {
      placed.stern!.w = next;
      placed.stern!.h = next;
      placed.stern!.y = Math.max(ceiling + 1, fittedTile.y - next * 0.72);
      placed.stern!.x = fittedTile.x + fittedTile.w - next * 0.35;
    };
    const keepHigh = () => {
      const star = placed.stern;
      if (!star) return;
      const lid = fittedTile.y + fittedTile.h * 0.42;
      if (star.y + star.h > lid) star.y = Math.max(ceiling + 1, lid - star.h);
      if (onCta(star)) star.y = Math.max(ceiling + 1, Math.min(star.y, placed.cta.y - star.h - 2));
    };
    seat(size);
    const slideOffHead = () => {
      const star = placed.stern;
      const area = () => {
        const face = faceNow();
        if (!star || !face) return 0;
        const width = Math.max(0, Math.min(star.x + star.w, face.x + face.w) - Math.max(star.x, face.x));
        const height = Math.max(0, Math.min(star.y + star.h, face.y + face.h) - Math.max(star.y, face.y));
        return width * height;
      };
      for (let step = 0; step < 36 && star && area() > 0; step += 1) {
        const hop = Math.max(4, size * 0.05);
        const options = [[-hop, 0], [-hop, -hop], [0, -hop]] as const;
        let best = { x: star.x, y: star.y, area: area() };
        for (const [dx, dy] of options) {
          const previous = { x: star.x, y: star.y };
          star.x += dx;
          star.y += dy;
          const hitsType = ink.some((item) => item.w > 2 && overlaps(star, item)) || overlaps(star, placed.headline) || overlaps(star, placed.subline) || onCta(star) || star.x < w * 0.03 || star.y < ceiling || star.x + star.w > w * (tiktok ? 0.84 : 0.98) || star.y + star.h > fittedTile.y + fittedTile.h * 0.42;
          const next = hitsType ? best.area : area();
          if (!hitsType && next < best.area) best = { x: star.x, y: star.y, area: next };
          star.x = previous.x;
          star.y = previous.y;
        }
        if (best.area >= area()) break;
        star.x = best.x;
        star.y = best.y;
      }
      keepHigh();
    };
    const nudgePerson = () => {
      if (!portrait || !placed.figure || !headBox) return false;
      const dx = w * 0.025;
      const dy = h * 0.016;
      const nextHead = { x: headBox.x + dx, y: headBox.y + dy, w: headBox.w, h: headBox.h };
      if (!headInside(nextHead, w, h)) return false;
      placed.figure.x += dx;
      placed.figure.y += dy;
      headBox.x += dx;
      headBox.y += dy;
      return true;
    };
    slideOffHead();
    while (blocked() && size > minSize + 0.5) {
      size = Math.max(minSize, size * 0.94);
      seat(size);
      slideOffHead();
    }
    for (let step = 0; step < 4 && placed.stern && onFace(placed.stern); step += 1) {
      if (!nudgePerson()) break;
      seat(size);
      slideOffHead();
    }
    keepHigh();
  }
  const gap = h * 0.015;
  const floor = h * (tiktok ? 0.78 : 0.955);
  if (fittedTile.w > 2 && placed.cta.w > 2 && fittedTile.y + fittedTile.h + gap > placed.cta.y && overlaps(fittedTile, { ...placed.cta, y: placed.cta.y - gap, h: placed.cta.h + gap })) {
    const needed = fittedTile.y + fittedTile.h + gap - placed.cta.y;
    const logoH = placed.logo && placed.logo.w > 2 ? placed.logo.h : 0;
    const nextLogo = placed.logo && placed.logo.w > 2 ? Math.max(placed.logo.y, placed.cta.y + needed + placed.cta.h + gap) : 0;
    if (placed.cta.y + needed + placed.cta.h <= floor && nextLogo + logoH <= floor + 1) {
      placed.cta.y += needed;
      if (placed.logo && placed.logo.w > 2 && placed.logo.y < placed.cta.y + placed.cta.h + gap) placed.logo.y = placed.cta.y + placed.cta.h + gap;
    } else {
      fittedTile.h = Math.max(h * 0.08, placed.cta.y - gap - fittedTile.y);
    }
  }
  let starLimit: "groß" | "klein" | undefined;
  let starGrund: string | undefined;
  const starBlockReason = (star: Box): string => {
    if (star.x < w * 0.02 || star.y < h * (tall ? 0.08 : 0.03) || star.x + star.w > w * (tiktok ? 0.84 : 0.98) || star.y + star.h > h * (tiktok ? 0.78 : 0.97)) return "außerhalb des sicheren Bereichs";
    if (headBox && headBox.w > 2 && overlaps(star, faceCore(headBox))) return "würde Gesicht verdecken";
    if (overlaps(star, placed.headline) || overlaps(star, placed.subline) || (placed.cta.w > 2 && overlaps(star, placed.cta))) return "würde Text verdecken";
    if (deviceMode && fittedPill && fittedPill.w > 2) {
      const air = Math.max(8, w * 0.012);
      if (overlaps(star, { x: fittedPill.x - air, y: fittedPill.y - air, w: fittedPill.w + air * 2, h: fittedPill.h + air * 2 })) return "Überlappung Pille";
    }
    return "Überlappung Kachel";
  };
  const askedScale = shifts.stoerer?.scale && shifts.stoerer.scale > 0 ? shifts.stoerer.scale : 1;
  let starBeforeScale: Box | undefined;
  let growStar: ((factor: number) => Box | undefined) | undefined;
  if (placed.stern && placed.stern.w > 2) {
    const blockedStar = (star: Box) => {
      if (star.x < w * 0.02 || star.y < h * (tall ? 0.08 : 0.03) || star.x + star.w > w * (tiktok ? 0.84 : 0.98) || star.y + star.h > h * (tiktok ? 0.78 : 0.97)) return true;
      if (overlaps(star, placed.headline) || overlaps(star, placed.subline) || (placed.cta.w > 2 && overlaps(star, placed.cta))) return true;
      if (headBox && headBox.w > 2 && overlaps(star, faceCore(headBox))) return true;
      if (deviceMode && fittedPill && fittedPill.w > 2) {
        const air = Math.max(8, w * 0.012);
        const padded = { x: fittedPill.x - air, y: fittedPill.y - air, w: fittedPill.w + air * 2, h: fittedPill.h + air * 2 };
        if (overlaps(star, padded)) return true;
      }
      const glyphs = deviceMode && fittedPill ? deviceGlyphs(fittedTile, fittedPill, copy).map((item) => item[1]) : tileInk(fittedTile);
      return glyphs.some((item) => item.w > 2 && overlaps(star, item));
    };
    const grown = (star: Box, factor: number) => {
      const width = star.w * factor;
      const height = star.h * factor;
      const anchors = [
        { x: star.x, y: star.y, w: width, h: height },
        { x: star.x, y: star.y + star.h - height, w: width, h: height },
        { x: star.x + star.w - width, y: star.y, w: width, h: height },
        { x: star.x + star.w - width, y: star.y + star.h - height, w: width, h: height },
        { x: star.x + (star.w - width) / 2, y: star.y + (star.h - height) / 2, w: width, h: height },
      ];
      return anchors.find((box) => !blockedStar(box)) ?? anchors[0];
    };
    if (deviceMode && (format.id === "pmax-960x1200" || format.id === "meta-1x1") && fittedTile.w > 2) {
      for (const ratio of [0.58, 0.56, 0.54]) {
        const target = fittedTile.w * ratio / 0.96;
        if (target <= placed.stern.w * 1.04) break;
        const next = grown(placed.stern, target / placed.stern.w);
        if (!blockedStar(next)) {
          placed.stern.x = next.x;
          placed.stern.y = next.y;
          placed.stern.w = next.w;
          placed.stern.h = next.h;
          break;
        }
      }
    }
    starBeforeScale = { ...placed.stern };
    growStar = (factor: number) => {
      const baseStar = starBeforeScale;
      if (!baseStar) return undefined;
      if (factor <= 1.02) return { ...baseStar };
      const next = grown(baseStar, factor);
      if (blockedStar(next) || next.w + 0.5 < baseStar.w) return undefined;
      return next;
    };
    if (askedScale < 0.98 && placed.stern) {
      const next = grown(placed.stern, askedScale);
      if (!blockedStar(next) && next.w > 2) {
        placed.stern.x = next.x;
        placed.stern.y = next.y;
        placed.stern.w = next.w;
        placed.stern.h = next.h;
      } else starLimit = "klein";
    }
  }
  const productHome = placed.product ? { x: placed.product.x, y: placed.product.y, w: placed.product.w, h: placed.product.h } : undefined;
  const fitDevice = () => {
    if (!deviceMode || !placed.product || !productCutout || !productHome) return 0;
    placed.product.x = productHome.x;
    placed.product.y = productHome.y;
    placed.product.w = productHome.w;
    placed.product.h = productHome.h;
    const starEdge = !tall && placed.stern ? placed.stern.x + placed.stern.w + w * 0.012 : 0;
    const phoneNow = visibleProductBox(placed.product, productCutout, tall, -0.1);
    const starBlocksPhone = Boolean(placed.stern && phoneNow.x < starEdge && phoneNow.x + phoneNow.w > placed.stern.x && phoneNow.y < placed.stern.y + placed.stern.h && placed.stern.y < phoneNow.y + phoneNow.h);
    const reserve = captionNeed > 0 ? captionNeed : (starBlocksPhone ? starEdge : 0);
    const bottom = Math.min(productHome.y + productHome.h, h);
    for (let step = 0; step < 16; step += 1) {
      const frame = paintedProduct(placed.product, productCutout, w, tall, -0.1, tall ? placed.cta : undefined, reserve);
      const view = deviceInside(frame.opaque, w, h);
      const leftOk = reserve <= 0 || frame.opaque.x + 1 >= reserve;
      if (!view.rightCrop && view.share >= 0.85 && leftOk) {
        placed.product.h = frame.h;
        placed.product.y = bottom - placed.product.h;
        if (reserve > 0) placed.product.x = frame.cx - placed.product.w / 2;
        return reserve;
      }
      placed.product.h *= 0.92;
      placed.product.y = bottom - placed.product.h;
    }
    return reserve;
  };
  let deviceReserve = fitDevice();
  if (!tall && deviceMode && placed.product && productCutout && placed.stern && fittedTile.w > 2 && fittedPill) {
    const product = placed.product;
    const phoneFloor = h * (wide ? 0.4 : 0.55);
    const glyphs = deviceGlyphs(fittedTile, fittedPill, copy).map((item) => item[1]);
    const starHits = (star: Box) => glyphs.some((item) => item.w > 2 && overlaps(star, item)) || overlaps(star, placed.headline) || overlaps(star, placed.subline) || (placed.cta.w > 2 && overlaps(star, placed.cta));
    const pullStarForPhone = () => {
      const star = placed.stern;
      if (!star) return;
      for (let step = 0; step < 8; step += 1) {
        const frame = paintedProduct(product, productCutout, w, false, -0.1, undefined, deviceReserve);
        if (frame.opaque.h >= phoneFloor - 1) break;
        const next = { x: star.x - Math.max(8, w * 0.012), y: star.y, w: star.w, h: star.h };
        if (next.x < w * 0.03 || starHits(next)) break;
        star.x = next.x;
        deviceReserve = fitDevice();
      }
    };
    pullStarForPhone();
    if (placed.stern) starBeforeScale = { ...placed.stern };
  }
  if (askedScale > 1.02 && growStar && starBeforeScale && placed.stern) {
    const phoneOk = () => {
      if (!deviceMode || tall || !productCutout || !placed.product) return true;
      const frame = paintedProduct(placed.product, productCutout, w, false, -0.1, undefined, deviceReserve);
      return frame.opaque.h >= h * (wide ? 0.4 : 0.55) - 1;
    };
    let best = { ...starBeforeScale };
    let low = 1;
    let high = askedScale;
    for (let step = 0; step < 7; step += 1) {
      const mid = (low + high) / 2;
      const candidate = growStar(mid);
      if (!candidate) {
        high = mid;
        continue;
      }
      placed.stern.x = candidate.x;
      placed.stern.y = candidate.y;
      placed.stern.w = candidate.w;
      placed.stern.h = candidate.h;
      if (deviceMode && productCutout) deviceReserve = fitDevice();
      if (phoneOk() && placed.stern.w + 0.5 >= starBeforeScale.w) {
        best = { ...placed.stern };
        low = mid;
      } else high = mid;
    }
    placed.stern.x = best.x;
    placed.stern.y = best.y;
    placed.stern.w = best.w;
    placed.stern.h = best.h;
    if (deviceMode && productCutout) deviceReserve = fitDevice();
    if (best.w <= starBeforeScale.w + Math.max(1.5, starBeforeScale.w * 0.04)) {
      starLimit = "groß";
      const over = growStar(askedScale);
      starGrund = over ? starBlockReason(over) : "Überlappung Kachel";
    }
  }
  if (placed.stern && shifts.stoerer && ((shifts.stoerer.dx ?? 0) !== 0 || (shifts.stoerer.dy ?? 0) !== 0)) {
    const dx = ((shifts.stoerer.dx ?? 0) / 100) * w;
    const dy = ((shifts.stoerer.dy ?? 0) / 100) * h;
    const moved = { ...placed.stern, x: placed.stern.x + dx, y: placed.stern.y + dy };
    const outside = moved.x < w * 0.02 || moved.y < h * 0.02 || moved.x + moved.w > w * (tiktok ? 0.84 : 0.98) || moved.y + moved.h > h * (tiktok ? 0.78 : 0.97);
    const face = headBox && headBox.w > 2 && overlaps(moved, faceCore(headBox));
    if (outside || face) starGrund = face ? "würde Gesicht verdecken" : "außerhalb des sicheren Bereichs";
    placed.stern.x = moved.x;
    placed.stern.y = moved.y;
  }
  const hints: string[] = [];
  const label = sceneFormatLabel(format);
  const safeRight = tiktok ? 0.85 : 0.96;
  const safeBottom = tiktok ? 0.8 : 0.96;
  for (const [title, item] of [["Headline", placed.headline], ["Subline", placed.subline], ["Kachel", fittedTile], ["CTA", placed.cta], ["Logo", placed.logo], ["Stern", placed.stern]] as Array<[string, Box | undefined]>) {
    if (!item || item.w < 2) continue;
    if (item.x < w * 0.04 - 1 || item.y < (tall ? h * 0.1 : h * 0.04) - 1 || item.x + item.w > w * safeRight + 1 || item.y + item.h > h * safeBottom + 1) {
      hints.push(`${title} liegt außerhalb der sicheren Zone im ${label}${tiktok ? " (TikTok-Schutzzone)" : ""}.`);
    }
  }
  if (placed.figure && headBox) {
    if (!headInside(headBox, w, h)) hints.push(`Der Kopf ist nicht vollständig sichtbar im ${label}.`);
    const top = placed.figure.y / h;
    const band = wide ? [0.1, 0.2] : tall ? [0.35, 0.5] : [0.3, 0.4];
    if (top < band[0] - 0.005 || top > band[1] + 0.005) hints.push(`Hinweis: Der Kopf liegt bei ${Math.round(top * 100)} Prozent von oben im ${label}.`);
    const bottom = (placed.figure.y + placed.figure.h) / h;
    if (tall && (motifShort || bottom < 0.995)) hints.push(`nicht bestanden: Motiv für 9x16 zu kurz.`);
  }
  if (placed.figure && headBox && headBox.w > 2) {
    const faceTexts = [
      ["Headline", placed.headline],
      ["Unterzeile", placed.subline],
      ["CTA", placed.cta],
      ["Kachel", fittedTile],
      ...(deviceMode ? [] : [["Datenmenge", tileInk(fittedTile)[0] ?? box(0, 0, 0, 0)], ["Preis", tileInk(fittedTile)[2] ?? box(0, 0, 0, 0)]] as Array<[string, Box]>),
    ] as Array<[string, Box]>;
    const hit = faceTexts.filter((item) => item[1].w > 2 && (item[0] === "Kachel" ? boxGap(headBox, item[1]) < w * 0.05 - 1 : overlaps(headBox, item[1])));
    if (hit.length) hints.push(`nicht bestanden: Das Gesicht überlappt ${[...new Set(hit.map((item) => item[0]))].join(" und ")} im ${label}.`);
  }
  const ink = deviceMode ? [] : tileInk(fittedTile);
  const texts: Array<[string, Box]> = [
    ["Headline", placed.headline],
    ["Unterzeile", placed.subline],
    ["Datenmenge", ink[0] ?? box(0, 0, 0, 0)],
    ["Altwert", ink[1] ?? box(0, 0, 0, 0)],
    ["Preis", ink[2] ?? box(0, 0, 0, 0)],
  ];
  if (deviceMode) texts.push(["Einmalpreis", fittedTile]);
  if (placed.pill && placed.pill.w > 2) texts.push(["Monatspreis", placed.pill]);
  if (cta.text.trim()) texts.push(["CTA", placed.cta]);
  for (let leftIndex = 0; leftIndex < texts.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < texts.length; rightIndex += 1) {
      const leftItem = texts[leftIndex];
      const rightItem = texts[rightIndex];
      if (!leftItem || !rightItem || leftItem[1].w < 2 || rightItem[1].w < 2) continue;
      if (leftItem[0] === "Einmalpreis" && rightItem[0] === "Monatspreis") continue;
      if (overlaps(leftItem[1], rightItem[1])) hints.push(`${leftItem[0]} überlappt ${rightItem[0]} im ${label}.`);
    }
  }
  if (wide && placed.subline.y < placed.headline.y + placed.headline.h + placed.headline.h * 0.1) {
    hints.push(`Headline überlappt Unterzeile im ${label}.`);
  }
  if (deviceMode && placed.stern && fittedTile.w > 2 && renderedStarDiameter(placed.stern.w) < fittedTile.w * 0.45) {
    hints.push(`Der Stern ist zu klein im ${label}.`);
  }
  if (placed.stern && placed.stern.h > 2 && renderedStarTextSize(placed.stern.w, stern?.text ?? "") < h * 0.02) {
    hints.push(`Der Stern-Text ist zu klein im ${label}.`);
  }
  if (!cta.text.trim() || placed.cta.h < 2 || placed.cta.w < 2) hints.push(`Der CTA fehlt im ${label}.`);
  if (placed.cta.h * 0.5 < h * (format.id.endsWith("9x16") ? 0.022 : format.id.startsWith("pmax") ? 0.03 : 0.025)) {
    hints.push(`Der CTA-Text ist zu klein im ${label}.`);
  }
  if (deviceMode && placed.product && !productCutout && placed.product.h < h * (tall ? 0.42 : 0.55)) hints.push(`Das Gerät ist zu klein im ${label}.`);
  if (placed.stern && headBox && headBox.w > 2 && overlaps(placed.stern, faceCore(headBox))) hints.push(`Der Stern überdeckt das Gesicht im ${label}.`);
  if (tall && deviceMode && placed.product && placed.cta.w > 2 && productCutout) {
    const air = h * 0.02;
    const floorTop = placed.cta.y + placed.cta.h + air;
    for (let step = 0; step < 8; step += 1) {
      const frame = paintedProduct(placed.product, productCutout, w, true, -0.1, placed.cta, deviceReserve);
      if (frame.opaque.y >= floorTop - 1) break;
      placed.product.y += floorTop - frame.opaque.y;
      const next = paintedProduct(placed.product, productCutout, w, true, -0.1, placed.cta, deviceReserve);
      const view = deviceInside(next.opaque, w, h);
      if (view.share < 0.85 || view.rightCrop) placed.product.h *= 0.94;
    }
  }
  const productPaint = productCutout && placed.product ? paintedProduct(placed.product, productCutout, w, tall, -0.1, tall ? placed.cta : undefined, deviceReserve) : undefined;
  const opaqueDevice = productPaint?.opaque;
  if (deviceMode && opaqueDevice && !tall && opaqueDevice.h < h * (wide ? 0.4 : 0.55) - 1) hints.push(`nicht bestanden: Das Gerät ist zu klein im ${label}.`);
  if (starLimit && placed.stern && starBeforeScale && starBeforeScale.w > 2) {
    const reached = Math.round((placed.stern.w / starBeforeScale.w) * 100);
    const why = starGrund ?? (starLimit === "groß" ? "Überlappung Kachel" : "Mindestgröße");
    hints.push(`Stern schon ${starLimit === "groß" ? "maximal groß" : "minimal klein"} im ${label}.`);
    hints.push(`Korrektur: Stern auf ${reached} % begrenzt, ${why} im ${label}.`);
  } else if (starLimit) hints.push(`Stern schon ${starLimit === "groß" ? "maximal groß" : "minimal klein"} im ${label}.`);
  if (productPaint) {
    const view = deviceInside(productPaint.opaque, w, h);
    if (view.rightCrop) hints.push(`nicht bestanden: Das Gerät ist rechts angeschnitten im ${label}.`);
    if (view.share < 0.85) hints.push(`nicht bestanden: Der sichtbare Geräteanteil liegt unter 85 Prozent im ${label}.`);
  }
  if (deviceMode && placed.stern && opaqueDevice && overlapShare(placed.stern, opaqueDevice) > 0.05) hints.push(`Der Stern überdeckt das Gerät im ${label}.`);
  if (deviceMode && opaqueDevice && copy.geraetName?.trim()) {
    const name = deviceNameBox(w, h, tall, placed.product ?? box(w * 0.5, h * 0.5, w * 0.4, h * 0.4), opaqueDevice, copy.geraetName, captionNameH);
    const badge = energyFrame(w, h, tall, placed.product ?? box(w * 0.5, h * 0.5, w * 0.4, h * 0.4), opaqueDevice, copy.geraetName, captionNameH);
    if (overlaps(name, badge)) hints.push(`nicht bestanden: Der Gerätename überlappt das Energielabel im ${label}.`);
    if (overlaps(name, opaqueDevice) || overlaps(badge, opaqueDevice)) hints.push(`nicht bestanden: Der Gerätename überlappt das Gerät im ${label}.`);
  }
  if (placed.stern && placed.logo && placed.logo.w > 2 && overlaps(placed.stern, placed.logo)) hints.push(`Der Stern überdeckt das Logo im ${label}.`);
  if (fittedTile.w > 2 && placed.cta.w > 2 && overlaps(fittedTile, placed.cta)) hints.push(`Die Kachel überlappt die CTA im ${label}.`);
  if (placed.stern && placed.stern.w > 2) {
    const ink = tileInk(fittedTile);
    const covered: Array<[string, Box]> = [
      ["Headline", placed.headline],
      ["Unterzeile", placed.subline],
      ["CTA", placed.cta],
      ...(deviceMode && placed.pill && placed.pill.w > 2 ? deviceGlyphs(fittedTile, placed.pill, copy) : [["Datenmenge", ink[0] ?? box(0, 0, 0, 0)], ["Altwert", ink[1] ?? box(0, 0, 0, 0)], ["Preis", ink[2] ?? box(0, 0, 0, 0)]] as Array<[string, Box]>),
    ];
    const hit = covered.filter((item) => item[1].w > 2 && item[1].h > 2 && overlaps(placed.stern!, item[1]));
    if (hit.length) hints.push(`nicht bestanden: Der Stern überdeckt ${[...new Set(hit.map((item) => item[0]))].join(" und ")} im ${label}.`);
  }
  if (deviceMode && placed.product) {
    for (const [nameOf, text] of [["Unterzeile", placed.subline], ["Headline", placed.headline]] as Array<[string, Box]>) {
      const vertical = text.y < placed.product.y + placed.product.h && placed.product.y < text.y + text.h;
      if (!vertical) continue;
      const gap = text.x + text.w <= placed.product.x ? placed.product.x - (text.x + text.w) : placed.product.x + placed.product.w <= text.x ? text.x - (placed.product.x + placed.product.w) : 0;
      if (gap < w * 0.02) hints.push(`Der Abstand zwischen Gerät und ${nameOf} ist zu klein im ${label}.`);
    }
  }
  if (placed.logo && placed.logo.w > 2 && placed.cta.w > 2 && overlaps(placed.cta, placed.logo)) hints.push(`Das Logo überlappt die CTA im ${label}.`);
  if (tall && deviceMode && opaqueDevice && placed.cta.w > 2 && opaqueDevice.y < placed.cta.y + placed.cta.h + h * 0.02 - 1) {
    hints.push(`nicht bestanden: Das Gerät überlappt die CTA im ${label}.`);
  }
  if (deviceMode && placed.pill && placed.pill.w > 2) {
    const textW = Math.max(glyphWidth(`+ ${copy.preis || "19,99 €"}`, placed.pill.h * 0.34), glyphWidth(copy.preisZusatz || "pro Monat", placed.pill.h * 0.22));
    const pad = Math.max(0, (placed.pill.w - textW) / 2);
    const pillText = { x: placed.pill.x + pad, y: placed.pill.y + placed.pill.h * 0.14, w: textW, h: placed.pill.h * 0.72 };
    const inside = pillText.x >= placed.pill.x - 1 && pillText.y >= placed.pill.y - 1 && pillText.x + pillText.w <= placed.pill.x + placed.pill.w + 1 && pillText.y + pillText.h <= placed.pill.y + placed.pill.h + 1;
    if (!inside) hints.push(`nicht bestanden: Der Pillentext liegt nicht in der Pille im ${label}.`);
    if (overlaps(pillText, fittedTile)) hints.push(`nicht bestanden: Die Lime-Box überdeckt den Pillentext im ${label}.`);
    const shared = Math.max(0, Math.min(placed.pill.x + placed.pill.w, fittedTile.x + fittedTile.w) - Math.max(placed.pill.x, fittedTile.x));
    if (shared > placed.pill.w * 0.1 + 2) hints.push(`nicht bestanden: Die Pille ragt zu weit in die Lime-Box im ${label}.`);
  }
  if (deko?.name === "bw_wellen") {
    const pad = w * 0.012;
    const texts = [placed.headline, placed.subline, fittedTile, placed.cta].filter((rect) => rect.w > 2);
    const hits = wavePaths(w, h).some((path) => path.some((point) => texts.some((rect) => point.x >= rect.x - pad && point.x <= rect.x + rect.w + pad && point.y >= rect.y - pad && point.y <= rect.y + rect.h + pad)));
    if (hits) hints.push(`Wellen überlagern die Textfläche im ${label}.`);
  }
  const headlineBand = wide ? [0.48, 0.62] : [0.7, 0.96];
  if (placed.headline.w < w * headlineBand[0] || placed.headline.w > w * headlineBand[1]) hints.push(`Hinweis: Die Headline-Breite weicht vom Bestand ab im ${label}.`);
  const tileBand = wide ? [0.18, 0.28] : [0.35, 0.6];
  if (!deviceMode && (tile.w < w * tileBand[0] || tile.w > w * tileBand[1])) hints.push(`Hinweis: Die Kachel-Breite weicht vom Bestand ab im ${label}.`);
  const minCtaH = tall ? 0.038 : 0.07;
  if (placed.cta.h > 2 && placed.cta.h < h * minCtaH) hints.push(`Hinweis: Die CTA-Leiste ist niedriger als im Bestand im ${label}.`);
  if (cutout?.orangeCloth && placed.stern && placed.figure && headBox && fittedTile.w > 2) {
    const body = { x: placed.figure.x, y: headBox.y + headBox.h, w: placed.figure.w, h: Math.max(0, placed.figure.y + placed.figure.h - (headBox.y + headBox.h)) };
    const onBody = overlapShare(placed.stern, body);
    const onTile = overlapShare(placed.stern, fittedTile);
    if (onBody > 0.2 && onBody > onTile) hints.push(`Hinweis: Der Stern liegt auf orangem Motiv im ${label}.`);
  }
  if (cutout?.orangeCloth && (deko?.name === "fruehling_blaetter" || deko?.name === "bw_wellen")) {
    hints.push(`Hinweis: Deko kaum sichtbar vor dem Motiv – Wellen oder keine Deko? im ${label}.`);
  }
  if (!shifts.pfeile?.hidden) {
    const headlineWords = headline.lines[0] ?? "";
    const fullWidth = glyphWidth(headlineWords, headH);
    const natural = fullWidth > headW ? headH * (headW / Math.max(1, fullWidth)) : headH;
    const arrows = fitHeadlineForChevrons(glyphWidth(headlineWords, natural), natural, w * (tiktok ? 0.84 : 0.96), headline.box.x);
    const arrowHint = chevronWidthHint(arrows.arrowScale, label);
    if (arrowHint) hints.push(arrowHint);
  }
  for (const note of [...new Set(caps)]) hints.push(`Hinweis: ${note}.`);
  if (deko?.box) deko.box = slideBox(deko.box, shifts.deko, w, h);
  const offers: NonNullable<OteloScene["offers"]> = {};
  if (!deviceMode && fittedTile.w > 2) {
    const ink = tileInk(fittedTile);
    if (copy.datenmenge?.trim() && ink[0]) offers.datenmenge = ink[0];
    if (copy.datenmengeAlt?.trim() && ink[1]) offers.datenmengeAlt = ink[1];
    if (copy.preis?.trim() && ink[2]) offers.preis = ink[2];
  }
  if (deviceMode && fittedTile.w > 2 && placed.pill && placed.pill.w > 2) {
    for (const [glyph, box] of deviceGlyphs(fittedTile, placed.pill, copy)) {
      if (glyph === "Einmalpreis" && copy.einmalpreis?.trim()) offers.einmalpreis = box;
      if (glyph === "statt-Preis" && copy.preisAlt?.trim()) offers.preisAlt = box;
      if (glyph === "Pillentext" && copy.preis?.trim() && !offers.preis) offers.preis = box;
    }
  }
  const sizeGrund: NonNullable<OteloScene["sizeGrund"]> = {};
  const reachedOf = (base: Box | undefined, placedBox: Box | undefined, asked: number, kind: "geraet" | "figur", scaledH?: number) => {
    if (!base || !placedBox || base.h < 2) return undefined;
    const reached = Math.round((placedBox.h / base.h) * 1000) / 10;
    const clamped = scaledH !== undefined && placedBox.h < scaledH - 1;
    if (clamped) {
      const right = placedBox.x + placedBox.w;
      sizeGrund[kind] = asked < 1 ? "Gerät hat Mindesthöhe erreicht" : right > w * 0.9 ? "Rand rechts" : fittedTile.w > 2 && overlaps(placedBox, fittedTile) ? "Kachel" : "sicherer Bereich";
    }
    return reached;
  };
  const geraetAsked = shifts.geraet?.scale && shifts.geraet.scale > 0 ? shifts.geraet.scale : 1;
  const geraetReached = reachedOf(device, placed.product, geraetAsked, "geraet", deviceScaledH);
  const figurReached = reachedOf(figure, placed.figure, shifts.person?.scale && shifts.person.scale > 0 ? shifts.person.scale : 1, "figur");
  let geraetMeasured = deviceMode ? 100 : geraetReached;
  if (deviceMode && Math.abs(geraetAsked - 1) > 0.001) {
    const resting = buildScene(format, name, copy, { ...shifts, geraet: { ...shifts.geraet, scale: 1 } }, cutout, follows, productCutout);
    const now = productPaint?.opaque.h ?? placed.product?.h ?? 0;
    const rest = resting.productPaint?.opaque.h ?? resting.product?.h ?? 0;
    geraetMeasured = rest > 2 ? Math.round((now / rest) * 1000) / 10 : 100;
  }
  return {
    id: format.id,
    width: w,
    height: h,
    orange: name === "kachel_person" || deviceMode ? [] : [[w * 0.62, h * 0.78], [w, h * 0.62], [w, h], [w * 0.45, h]],
    angle: 28,
    orangeRatio: name === "kachel_person" || deviceMode ? 0 : 0.12,
    orangeSide: copy.orange,
    style: "kachel",
    figure: placed.figure,
    figureFlip: Boolean(shifts.person?.flip),
    figureSource: cutout ? { x: cutout.opaque.x / cutout.imageW, y: cutout.opaque.y / cutout.imageH, w: cutout.opaque.w / cutout.imageW, h: cutout.opaque.h / cutout.imageH } : undefined,
    headBox,
    product: placed.product,
    productTilt: deviceMode ? -0.1 : undefined,
    productPaint,
    energy: deviceMode ? slideBox(energyFrame(w, h, tall, placed.product ?? box(w * 0.5, h * 0.5, w * 0.4, h * 0.4), opaqueDevice, copy.geraetName ?? "", captionNameH), shifts.energielabel, w, h) : undefined,
    headline: { ...headline, box: placed.headline },
    subline: { ...subline, box: placed.subline },
    stoerer: { typ: "stern", box: placed.stern ?? box(0, 0, 0, 0), preis: copy.preis, zusatz: copy.preisZusatz, einmal: copy.einmalpreis, aktion: copy.sternText ?? "" },
    kachel: {
      box: fittedTile,
      datenmenge: copy.datenmenge?.trim() || "150 GB",
      alt: copy.datenmengeAlt?.trim() || "",
      einmal: name === "kachel_person" ? "" : copy.einmalpreis.trim(),
      einmalZusatz: copy.einmalpreisZusatz?.trim() || "",
    },
    pill: placed.pill ? { box: placed.pill, preis: `+ ${copy.preis}`, zusatz: copy.preisZusatz || "pro Monat" } : undefined,
    preisAlt: copy.preisAlt?.trim() || "",
    preisMonatAlt: copy.preisMonatAlt?.trim() || "",
    stern: placed.stern && stern ? { box: placed.stern, text: stern.text } : undefined,
    deko,
    headlinePfeile: !shifts.pfeile?.hidden,
    sternColor: shifts.stoerer?.color || copy.sternColor,
    headlineColor: shifts.headline?.color || copy.headlineColor,
    ctaColor: shifts.cta?.color || copy.ctaColor,
    renderedGroesse: {
      ...(placed.stern && starBeforeScale && starBeforeScale.w > 2 ? { stern: Math.round((placed.stern.w / starBeforeScale.w) * 1000) / 10 } : {}),
      ...(geraetMeasured !== undefined ? { geraet: geraetMeasured } : {}),
      ...(figurReached !== undefined ? { figur: figurReached } : {}),
    },
    sizeGrund,
    offers,
    deviceLabel: copy.geraetName?.trim() ? { text: copy.geraetName.trim(), box: slideBox(deviceNameBox(w, h, tall, placed.product ?? box(w * 0.5, h * 0.5, w * 0.4, h * 0.4), opaqueDevice, copy.geraetName, captionNameH), shifts.geraetename, w, h) } : undefined,
    textScale: {
      preisAlt: shifts.stattpreis?.scale && shifts.stattpreis.scale > 0 ? shifts.stattpreis.scale : 1,
      alt: shifts.altwert?.scale && shifts.altwert.scale > 0 ? shifts.altwert.scale : 1,
      zusatz: shifts.zusatz?.scale && shifts.zusatz.scale > 0 ? shifts.zusatz.scale : 1,
      geraetName: shifts.geraetename?.scale && shifts.geraetename.scale > 0 ? shifts.geraetename.scale : 1,
      einmalig: shifts.einmalig?.scale && shifts.einmalig.scale > 0 ? shifts.einmalig.scale : 1,
    },
    cta: { ...cta, box: placed.cta },
    logo: placed.logo && placed.logo.w > 2 ? { ...logo, box: placed.logo } : { ...logo, box: { x: 0, y: 0, w: 0, h: 0 } },
    hints,
  };
}

export function elementRelation(scene: OteloScene, element: string): { x: number; y: number; w: number; h: number } | undefined {
  const group = priceGroupBox(scene.kachel?.box, scene.pill?.box);
  const target = element === "stoerer" ? scene.stern?.box : element === "headline" ? scene.headline.box : element === "subline" ? scene.subline.box : element === "cta" ? scene.cta.box : undefined;
  if (!group || !target || target.w < 2 || group.w < 2 || group.h < 2) return undefined;
  return { x: (target.x - group.x) / group.w, y: (target.y - group.y) / group.h, w: target.w / group.w, h: target.h / group.h };
}

export function buildScene(
  format: { id: string; w: number; h: number },
  name: VorlageName,
  copy: SceneCopy,
  shifts: Partial<Record<"headline" | "subline" | "stoerer" | "person" | "geraet" | "cta" | "logo" | "pflichttext" | "energielabel" | "schraege" | "deko" | "kachel" | "pfeile" | "stattpreis" | "altwert" | "zusatz" | "einmalig" | "geraetename", Shift>> = {},
  cutout?: Cutout,
  follows?: readonly SquareFollow[],
  productCutout?: Cutout,
): OteloScene {
  if (name === "kachel_person" || name === "kachel_geraet" || name === "kachel_geraet_person") return buildKachel(format, name, copy, shifts, cutout, follows, productCutout);
  const { w, h } = format;
  const portrait = h > w;
  const prefer = TEMPLATE_ANGLE[name][portrait ? "portrait" : "landscape"];
  const split = splitOrange(w, h, prefer, copy.orange);
  const blackRight = copy.orange === "links";
  const tiktok = format.id === "tiktok-9x16";
  const rightLimit = w * (tiktok ? 0.84 : 0.945);
  const columnEnd = blackRight ? rightLimit : Math.min(rightLimit, w * 0.58);
  const textX = blackRight ? Math.max(w * 0.4, rightLimit - w * 0.5) : w * 0.055;
  const textW = Math.max(w * 0.28, columnEnd - textX);
  const lines = headlineLines(copy.headline);
  const headlineH = (portrait ? h * 0.055 : h * 0.09) * Math.max(1, Math.min(2, lines.length));
  const headline = {
    lines,
    variant: copy.headlineVariante,
    box: box(textX, h * 0.055, textW, headlineH),
    step: w * 0.03,
  };
  const subLines = copy.subline.split(/\n/).map((line) => line.trim()).filter(Boolean).slice(0, 4);
  const diamond = Math.min(Math.max(headline.box.h * 0.85, Math.min(w, h) * 0.15), (columnEnd - textX) * 0.38);
  const stoererX = columnEnd - diamond * 1.16;
  const subline = {
    lines: subLines.map((text, index) => ({ text, bold: index === 0, color: index === 0 ? ORANGE : WHITE })),
    box: box(textX, headline.box.y + headline.box.h + h * 0.012, Math.max(w * 0.18, stoererX - textX - diamond * 0.2), portrait ? h * 0.09 : h * 0.14),
  };
  const stoerer = {
    typ: copy.stoererTyp,
    box: box(stoererX, subline.box.y, diamond, diamond),
    preis: copy.preis,
    zusatz: copy.preisZusatz,
    einmal: copy.einmalpreis,
    aktion: copy.aktionText,
  };
  const minText = format.id.endsWith("9x16") ? 0.022 : format.id.startsWith("pmax") ? 0.03 : 0.025;
  const ctaH = Math.max(h * (minText / 0.32) + 4, portrait ? h * 0.05 : h * 0.08);
  const onOrange = (target: Box) => corners(target).some(([x, y]) => pointInPolygon(x, y, split.polygon));
  const underStack = box(textX, stoerer.box.y + stoerer.box.h + h * 0.055 + diamond * 0.14, Math.min(w * 0.5, textW), ctaH);
  const besideSubline = box(subline.box.x, subline.box.y + subline.box.h + h * 0.015, subline.box.w, ctaH);
  let ctaBox = !onOrange(underStack) ? underStack : besideSubline;
  for (let step = 0; step < 8 && onOrange(ctaBox); step += 1) ctaBox = { ...ctaBox, w: Math.max(subline.box.w * 0.8, ctaBox.w * 0.9) };
  const cta = {
    box: ctaBox,
    text: copy.button.trim() || "Jetzt sichern auf **otelo.de**",
  };
  const logoW = portrait ? Math.min(w, h) * 0.2 : w * 0.25;
  const logoH = logoW / 5.58;
  const logoY = tiktok ? Math.min(cta.box.y + cta.box.h + h * 0.02, h * 0.72) : cta.box.y + cta.box.h + h * 0.03;
  let logoBox = box(textX, logoY, logoW, logoH);
  for (let step = 0; step < 8 && onOrange(logoBox); step += 1) logoBox = { ...logoBox, y: Math.max(cta.box.y + cta.box.h + 4, logoBox.y - h * 0.02) };
  const logo = {
    box: logoBox,
    side: (blackRight ? "right" : "left") as "left" | "right",
  };
  const figure = name === "product" ? undefined : (() => {
    const personRight = name === "product_person" ? copy.orange !== "rechts" : copy.orange === "rechts";
    if (name === "product_person") {
      const top = logo.box.y + logo.box.h + h * 0.015;
      const fh = Math.max(h * 0.34, h * 1.02 - top);
      const fw = Math.min(textW * 0.48, fh * 0.45);
      const x = personRight ? textX + textW - fw : textX;
      return box(x, h * 1.02 - fh, fw, fh);
    }
    const tall = format.id.endsWith("9x16");
    const fh = tall ? h * 0.58 : h * 0.72;
    const fw = Math.min(w * (tall ? 0.62 : 0.46), Math.max(w * 0.34, w - columnEnd - w * 0.02));
    const x = personRight ? Math.max(columnEnd + w * 0.01, w - fw * 0.9) : -w * 0.03;
    return box(x, h * 1.02 - fh, fw, fh);
  })();
  const product = name === "product" || name === "product_person" ? (() => {
    const onRight = copy.orange === "rechts";
    const room = Math.max(w * 0.16, (onRight ? w - textX - textW : textX) - w * 0.06);
    const pw = Math.min(Math.min(w, h) * 0.24, room);
    const px = onRight ? w - pw - w * 0.045 : w * 0.055;
    return box(px, portrait ? h * 0.42 : h * 0.28, pw, h * (portrait ? 0.28 : 0.42));
  })() : undefined;
  const energy = product ? box(product.x + product.w * 0.15, product.y + product.h + h * 0.012, Math.min(w, h) * 0.06, Math.min(w, h) * 0.075) : undefined;
  const productName = product ? { text: copy.produktname, box: box(product.x, product.y + product.h + h * 0.008, product.w * 1.3, h * 0.025) } : undefined;
  const column = [headline.box, subline.box, stoerer.box, cta.box];
  const lowest = Math.max(...column.map((item) => item.y + item.h));
  const room = Math.max(0, logo.box.y - lowest - h * 0.02);
  let drop = 0;
  while (drop + h * 0.02 <= room && corners(headline.box).some(([x, y]) => pointInPolygon(x, y + drop, split.polygon))) drop += h * 0.02;
  for (const item of column) item.y += drop;
  while (headline.box.h > h * 0.08 && corners(headline.box).some(([x, y]) => pointInPolygon(x, y, split.polygon))) {
    headline.box = { ...headline.box, y: headline.box.y + h * 0.015, h: headline.box.h - h * 0.015 };
  }
  const caps: string[] = [];
  const textLimits = { left: w * 0.03, top: h * 0.03, right: w * (tiktok ? 0.85 : 0.97), bottom: h * (tiktok ? 0.8 : 0.96) };
  const figureLimits = { left: -w * 0.08, top: -h * 0.02, right: w * 1.06, bottom: h * 1.06 };
  const placed = {
    figure: figure ? applyShift(figure, shifts.person, w, h, "bottom-center", figureLimits, caps, "Frau") : undefined,
    product: product ? applyShift(product, shifts.geraet, w, h, "bottom-center", figureLimits, caps, "Gerät") : undefined,
    energy: energy ? applyShift(energy, shifts.energielabel, w, h, "top-left", textLimits, caps, "Energielabel") : undefined,
    headline: applyShift(headline.box, shifts.headline, w, h, "top-left", textLimits, caps, "Headline") ?? headline.box,
    subline: applyShift(subline.box, shifts.subline, w, h, "top-left", textLimits, caps, "Unterzeile") ?? subline.box,
    stoerer: applyShift(stoerer.box, shifts.stoerer, w, h, "top-left", textLimits, caps, "Störer") ?? stoerer.box,
    cta: applyShift(cta.box, shifts.cta, w, h, "top-left", textLimits, caps, "Leiste") ?? cta.box,
    logo: applyShift(logo.box, shifts.logo, w, h, "top-left", textLimits, caps, "Logo"),
  };
  const pflichtBox = copy.pflichttext.trim()
    ? applyShift(box(logo.box.x + logo.box.w + w * 0.015, logo.box.y, Math.max(w * 0.16, columnEnd - logo.box.x - logo.box.w - w * 0.02), Math.max(8, h * 0.016)), shifts.pflichttext, w, h, "top-left", textLimits, caps, "Pflichttext")
    : undefined;
  const pflicht = pflichtBox ? { text: copy.pflichttext.trim(), box: pflichtBox } : undefined;
  const pixels = rasterOrangeRatio(split.polygon, w, h);
  const hints: string[] = [];
  const label = sceneFormatLabel(format);
  if (!edgeRises(split.polygon, w, h) || split.angle < 11 || split.angle > 45) {
    hints.push(`Die Schräge steigt nicht von links unten nach rechts oben im ${label}.`);
  }
  if (pixels > 0.5 || pixels < 0.26) {
    hints.push(`Der Orange-Anteil ist ${Math.round(pixels * 100)} Prozent im ${label}. Erlaubt sind etwa ein Drittel, höchstens die Hälfte.`);
  }
  if (placed.figure) {
    const visible = Math.max(0, Math.min(w, placed.figure.x + placed.figure.w) - Math.max(0, placed.figure.x));
    if (visible < placed.figure.w * 0.6) hints.push(`Die Person ist zu weit aus dem Format geschoben im ${label}.`);
    if (placed.figure.y + placed.figure.h < h - 1) hints.push(`Die Figur berührt den unteren Rand nicht im ${label}.`);
    const minPerson = format.id.endsWith("9x16") ? 0.5 : 0.65;
    if (placed.figure.h < h * minPerson) hints.push(`Die Person ist zu klein im ${label}.`);
    const onOrange = [0.3, 0.5, 0.75].some((down) => [0.3, 0.6].some((across) => pointInPolygon(
      Math.min(w - 2, Math.max(2, placed.figure!.x + placed.figure!.w * across)),
      Math.min(h - 2, placed.figure!.y + placed.figure!.h * down),
      split.polygon,
    )));
    if (!onOrange) hints.push(`Die Figur steht nicht auf Orange im ${label}.`);
  }
  if (headline.lines.length > 2) hints.push(`Die Headline hat mehr als zwei Zeilen im ${label}.`);
  if (subline.lines.length > 3) hints.push(`Die Subline hat mehr als drei Zeilen im ${label}.`);
  if (corners(placed.headline).some(([x, y]) => pointInPolygon(x, y, split.polygon))) {
    hints.push(`Die Headline liegt auf Orange im ${label}.`);
  }
  if (corners(placed.cta).some(([x, y]) => pointInPolygon(x, y, split.polygon))) {
    hints.push(`Die CTA-Leiste liegt auf Orange im ${label}.`);
  }
  if (placed.stoerer.h < placed.headline.h * 0.7) hints.push(`Die Raute ist zu klein im ${label}.`);
  const minCta = format.id.endsWith("9x16") ? 0.022 : format.id.startsWith("pmax") ? 0.03 : 0.025;
  if (placed.cta.h * 0.36 < h * minCta) hints.push(`Der CTA-Text ist zu klein im ${label}.`);
  const safeRight = tiktok ? 0.15 : 0.05;
  const safeBottom = tiktok ? 0.2 : 0.05;
  const safeBoxes: Array<[string, Box | undefined]> = [
    ["Headline", placed.headline],
    ["Subline", placed.subline],
    ["Störer", placed.stoerer],
    ["CTA", placed.cta],
    ["Logo", placed.logo],
  ];
  for (const [nameOf, item] of safeBoxes) {
    if (!item) continue;
    if (item.x < w * 0.05 - 1 || item.y < h * 0.05 - 1 || item.x + item.w > w * (1 - safeRight) + 1 || item.y + item.h > h * (1 - safeBottom) + 1) {
      hints.push(`${nameOf} liegt außerhalb der sicheren Zone im ${label}${tiktok ? " (TikTok-Schutzzone)" : ""}.`);
    }
  }
  if (placed.logo && corners(placed.logo).some(([x, y]) => pointInPolygon(x, y, split.polygon))) {
    hints.push(`Die weiße Wortmarke liegt auf Orange im ${label}.`);
  }
  const pairs: Array<[string, Box | undefined]> = [
    ...safeBoxes,
    ["Figur", placed.figure],
    ["Gerät", placed.product],
    ["Energielabel", placed.energy],
    ["Pflichttext", pflicht?.box],
  ];
  for (let left = 0; left < pairs.length; left += 1) {
    for (let right = left + 1; right < pairs.length; right += 1) {
      const [leftName, leftBox] = pairs[left];
      const [rightName, rightBox] = pairs[right];
      if (!leftBox || !rightBox || leftBox.w <= 0 || rightBox.w <= 0) continue;
      if ((leftName === "Gerät" && rightName === "Energielabel") || (leftName === "Energielabel" && rightName === "Gerät")) continue;
      if (overlaps(leftBox, rightBox)) hints.push(`${leftName} überlappt ${rightName} im ${label}.`);
    }
  }
  if (priceNeedsLegal(copy)) hints.push(`Zum Preis mit Fußnote fehlt der Pflichttext im ${label}.`);
  for (const note of [...new Set(caps)]) hints.push(`Hinweis: ${note}.`);
  return {
    id: format.id,
    width: w,
    height: h,
    orange: split.polygon,
    angle: split.angle,
    orangeRatio: pixels,
    orangeSide: copy.orange,
    figure: placed.figure,
    figureFlip: Boolean(shifts.person?.flip),
    product: placed.product,
    energy: placed.energy,
    productName,
    headline: { ...headline, box: placed.headline },
    subline: { ...subline, box: placed.subline },
    stoerer: { ...stoerer, box: placed.stoerer },
    cta: { ...cta, box: placed.cta },
    logo: placed.logo ? { ...logo, box: placed.logo } : { ...logo, box: { x: 0, y: 0, w: 0, h: 0 } },
    pflichttext: pflicht,
    hints,
  };
}

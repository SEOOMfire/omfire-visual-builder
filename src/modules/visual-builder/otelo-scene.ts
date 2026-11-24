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
  sternText?: string;
  deko?: DekoName;
  geraetName?: string;
  kampagne?: string;
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
  stern?: { box: Box; text: string };
  deko?: { name: DekoName; box: Box; strength?: number };
  headlinePfeile?: boolean;
  deviceLabel?: { text: string; box: Box };
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

export function dekoFor(copy: Pick<SceneCopy, "deko" | "kampagne">): DekoName {
  if (copy.deko === "bw_wellen" || copy.deko === "fruehling_blaetter" || copy.deko === "keine") return copy.deko;
  const name = (copy.kampagne ?? "").toLowerCase();
  if (name.includes("fruehling") || name.includes("sommer")) return "fruehling_blaetter";
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

function overlaps(left: Box, right: Box): boolean {
  return left.x < right.x + right.w && right.x < left.x + left.w && left.y < right.y + right.h && right.y < left.y + left.h;
}

export function priceNeedsLegal(copy: Pick<SceneCopy, "preis" | "preisZusatz" | "einmalpreis" | "pflichttext">): boolean {
  const priced = `${copy.preis} ${copy.preisZusatz} ${copy.einmalpreis}`;
  return /[¹*]/.test(priced) && !copy.pflichttext.trim();
}

type Shift = { dx?: number; dy?: number; scale?: number; flip?: boolean; hidden?: boolean };

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

function applyShift(target: Box, shift: Shift | undefined, width: number, height: number, anchor: "top-left" | "bottom-center", limits: { left: number; top: number; right: number; bottom: number }, caps: string[], name: string): Box | undefined {
  const placed = shiftBox(target, shift, width, height, anchor, limits);
  if (placed.capped) caps.push(`${name} auf das Maximum vergrößert`);
  return placed.box;
}

function buildKachel(
  format: { id: string; w: number; h: number },
  name: VorlageName,
  copy: SceneCopy,
  shifts: Partial<Record<"headline" | "subline" | "stoerer" | "person" | "geraet" | "cta" | "logo" | "pflichttext" | "energielabel" | "schraege" | "deko", Shift>>,
  cutout?: Cutout,
): OteloScene {
  const { w, h } = format;
  const wide = w / h > 1.5;
  const tall = format.id.endsWith("9x16");
  const mid = !wide && !tall && h > w;
  const tiktok = format.id === "tiktok-9x16";
  const flip = copy.orange === "links";
  const left = w * 0.06;
  const headW = wide ? w * 0.58 : tall ? w * (tiktok ? 0.74 : 0.8) : w * 0.86;
  const headH = tall ? h * 0.062 : wide ? h * 0.15 : h * 0.11;
  const headY = tall ? h * 0.134 : h * 0.055;
  const headline = {
    lines: [copy.headline.replace(/\s+/g, " ").trim().toUpperCase() || "BLACK WEEK"],
    variant: "direkt" as const,
    box: mirrorBox(box(left, headY, headW, headH), w, flip),
    step: 0,
  };
  const subline = {
    lines: copy.subline.split(/\n/).map((line) => line.trim()).filter(Boolean).slice(0, 2).map((text) => ({ text: text.toUpperCase(), bold: true, color: ORANGE })),
    box: mirrorBox(box(left, headline.box.y + headline.box.h + h * 0.012, wide ? w * 0.58 : w * 0.9, headH * 0.45), w, flip),
  };
  const tileRaw = wide
    ? box(left, subline.box.y + subline.box.h + h * 0.04, w * 0.3, h * 0.46)
    : box(left, tall ? h * 0.28 : h * 0.3, w * (tall ? 0.5 : 0.45), tall ? h * 0.28 : h * 0.4);
  const tile = mirrorBox(tileRaw, w, flip);
  const ctaH = Math.max(wide ? h * 0.14 : tall ? h * 0.05 : h * 0.082, h * ((format.id.startsWith("pmax") ? 0.03 : tall ? 0.022 : 0.025) / 0.48));
  const ctaRaw = wide
    ? box(tileRaw.x + tileRaw.w + w * 0.02, tileRaw.y + tileRaw.h - ctaH, w * 0.26, ctaH)
    : box(left, tall ? h * 0.66 : h * 0.75, w * (tall ? 0.55 : 0.58), ctaH);
  const cta = {
    box: mirrorBox(ctaRaw, w, flip),
    text: copy.button.trim(),
  };
  const showLogo = !tall;
  const logoW = w * 0.25;
  const logo = {
    box: showLogo ? box(w * 0.05, h * 0.94 - logoW / 5.58, logoW, logoW / 5.58) : box(0, 0, 0, 0),
    side: "left" as const,
  };
  let figure = name === "kachel_geraet" ? undefined : mirrorBox(wide
    ? box(w * 0.52, h * 0.06, w * 0.5, h * 0.96)
    : tall
      ? box(w * 0.28, h * 0.4, w * 0.78, h * 0.62)
      : mid
        ? box(w * 0.34, h * 0.35, w * 0.7, h * 0.7)
        : box(w * 0.4, h * 0.3, w * 0.64, h * 0.74), w, flip);
  const deviceH = h * (tall ? 0.42 : wide ? 0.72 : 0.58);
  const device = name === "kachel_person" ? undefined : mirrorBox(box(w * 0.52, h * 0.22, Math.min(w * 0.42, deviceH * 0.7), deviceH), w, flip);
  const sternSize = tileRaw.w * 0.42;
  const stern = copy.sternText?.trim()
    ? { box: mirrorBox(box(tileRaw.x + tileRaw.w - sternSize * 0.55, tileRaw.y - sternSize * 0.28, sternSize, sternSize), w, flip), text: copy.sternText.trim() }
    : undefined;
  let headBox: Box | undefined;
  if (cutout && figure && name !== "kachel_geraet") {
    const topFraction = tall ? 0.45 : 0.35;
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
      scale: shifts.person?.scale,
    });
    if (!onRight && placedPerson.figure.x + placedPerson.figure.w > blockLeft - w * 0.01) {
      const room = Math.max(8, blockLeft - w * 0.03 - placedPerson.figure.x);
      const shrink = room / placedPerson.figure.w;
      placedPerson.figure.w *= shrink;
      placedPerson.figure.h *= shrink;
      placedPerson.head.w *= shrink;
      placedPerson.head.h *= shrink;
    }
    figure = placedPerson.figure;
    headBox = placedPerson.head;
  }
  const dekoName = dekoFor(copy);
  const deko = shifts.deko?.hidden || dekoName === "keine"
    ? undefined
    : { name: dekoName, box: mirrorBox(box(w * 0.45, h * 0.15, w * 0.55, h * 0.85), w, flip), strength: shifts.deko?.scale ?? 1 };
  const fit = (target: Box) => tiktok ? keepInside(target, w, h, 0.84, 0.78) : target;
  headline.box = fit(headline.box);
  subline.box = fit(subline.box);
  const fittedTile = fit(tile);
  cta.box = fit(cta.box);
  if (stern) stern.box = fit(stern.box);
  const caps: string[] = [];
  const textLimits = { left: w * 0.04, top: h * (tall ? 0.1 : 0.04), right: w * (tiktok ? 0.84 : 0.955), bottom: h * (tiktok ? 0.78 : 0.955) };
  const figureLimits = { left: -w * 0.02, top: 0, right: w * 1.08, bottom: h * 1.08 };
  const placed = {
    figure: figure ? applyShift(figure, shifts.person, w, h, "top-left", figureLimits, caps, "Frau") : undefined,
    product: device ? applyShift(device, shifts.geraet, w, h, "bottom-center", figureLimits, caps, "Gerät") : undefined,
    headline: applyShift(headline.box, shifts.headline, w, h, "top-left", textLimits, caps, "Headline") ?? headline.box,
    subline: applyShift(subline.box, shifts.subline, w, h, "top-left", textLimits, caps, "Unterzeile") ?? subline.box,
    cta: applyShift(cta.box, shifts.cta, w, h, "top-left", textLimits, caps, "Leiste") ?? cta.box,
    logo: applyShift(logo.box, shifts.logo, w, h, "top-left", textLimits, caps, "Logo"),
    stern: stern ? applyShift(stern.box, shifts.stoerer, w, h, "top-left", { ...textLimits, right: w * 1.02, top: 0 }, caps, "Stern") : undefined,
  };
  const hints: string[] = [];
  const label = `${w}x${h}`;
  const safeRight = tiktok ? 0.85 : 0.96;
  const safeBottom = tiktok ? 0.8 : 0.96;
  for (const [title, item] of [["Headline", placed.headline], ["Subline", placed.subline], ["Kachel", fittedTile], ["CTA", placed.cta], ["Logo", placed.logo], ["Stern", placed.stern]] as Array<[string, Box | undefined]>) {
    if (!item || item.w < 2) continue;
    if (item.x < w * 0.04 - 1 || item.y < (tall ? h * 0.1 : h * 0.04) - 1 || item.x + item.w > w * safeRight + 1 || item.y + item.h > h * safeBottom + 1) {
      hints.push(`${title} liegt außerhalb der sicheren Zone im ${label}${tiktok ? " (TikTok-Schutzzone)" : ""}.`);
    }
  }
  if (placed.figure && headBox) {
    const movedHead = {
      x: headBox.x + (placed.figure.x - (figure?.x ?? placed.figure.x)),
      y: headBox.y + (placed.figure.y - (figure?.y ?? placed.figure.y)),
      w: headBox.w * (figure && figure.w ? placed.figure.w / figure.w : 1),
      h: headBox.h * (figure && figure.h ? placed.figure.h / figure.h : 1),
    };
    headBox = movedHead;
    if (!headInside(headBox, w, h)) hints.push(`Der Kopf ist nicht vollständig sichtbar im ${label}.`);
    const top = placed.figure.y / h;
    const band = tall ? top < 0.4 || top > 0.5 : top < 0.3 || top > 0.4;
    if (band) hints.push(`Hinweis: Der Kopf liegt bei ${Math.round(top * 100)} Prozent von oben im ${label}.`);
  }
  for (const [title, item] of [["Headline", placed.headline], ["Subline", placed.subline], ["Kachel", fittedTile]] as Array<[string, Box | undefined]>) {
    if (placed.figure && item && item.w > 2 && overlaps(placed.figure, item)) hints.push(`Figur überlappt ${title} im ${label}.`);
  }
  if (placed.cta.h * 0.5 < h * (format.id.endsWith("9x16") ? 0.022 : format.id.startsWith("pmax") ? 0.03 : 0.025)) {
    hints.push(`Der CTA-Text ist zu klein im ${label}.`);
  }
  if (placed.headline.w < w * 0.7 || placed.headline.w > w * 0.96) hints.push(`Hinweis: Die Headline-Breite weicht vom Bestand ab im ${label}.`);
  if (tile.w < w * 0.35 || tile.w > w * 0.6) hints.push(`Hinweis: Die Kachel-Breite weicht vom Bestand ab im ${label}.`);
  const minCtaH = tall ? 0.038 : 0.07;
  if (placed.cta.h > 2 && placed.cta.h < h * minCtaH) hints.push(`Hinweis: Die CTA-Leiste ist niedriger als im Bestand im ${label}.`);
  for (const note of [...new Set(caps)]) hints.push(`Hinweis: ${note}.`);
  return {
    id: format.id,
    width: w,
    height: h,
    orange: name === "kachel_person" ? [] : [[w * 0.62, h * 0.78], [w, h * 0.62], [w, h], [w * 0.45, h]],
    angle: 28,
    orangeRatio: name === "kachel_person" ? 0 : 0.12,
    orangeSide: copy.orange,
    style: "kachel",
    figure: placed.figure,
    figureFlip: Boolean(shifts.person?.flip),
    figureSource: cutout ? { x: cutout.opaque.x / cutout.imageW, y: cutout.opaque.y / cutout.imageH, w: cutout.opaque.w / cutout.imageW, h: cutout.opaque.h / cutout.imageH } : undefined,
    headBox,
    product: placed.product,
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
    stern: placed.stern && stern ? { box: placed.stern, text: stern.text } : undefined,
    deko,
    headlinePfeile: dekoName === "bw_wellen",
    deviceLabel: copy.geraetName?.trim() ? { text: copy.geraetName.trim(), box: box(w * 0.55, h * 0.9, w * 0.32, h * 0.04) } : undefined,
    cta: { ...cta, box: placed.cta },
    logo: placed.logo && placed.logo.w > 2 ? { ...logo, box: placed.logo } : { ...logo, box: { x: 0, y: 0, w: 0, h: 0 } },
    hints,
  };
}

export function buildScene(
  format: { id: string; w: number; h: number },
  name: VorlageName,
  copy: SceneCopy,
  shifts: Partial<Record<"headline" | "subline" | "stoerer" | "person" | "geraet" | "cta" | "logo" | "pflichttext" | "energielabel" | "schraege" | "deko", Shift>> = {},
  cutout?: Cutout,
): OteloScene {
  if (name === "kachel_person" || name === "kachel_geraet" || name === "kachel_geraet_person") return buildKachel(format, name, copy, shifts, cutout);
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
  const label = `${w}x${h}`;
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

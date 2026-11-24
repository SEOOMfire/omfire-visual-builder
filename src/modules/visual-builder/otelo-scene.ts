export const LIME = "#D7EB00";
export const ORANGE = "#FA5A14";
export const BLACK = "#000000";
export const WHITE = "#FFFFFF";

export const DEFAULT_PFLICHTTEXT =
  "Alle Preise inklusive MwSt. · otelo – eine Marke der Vodafone GmbH · Ferdinand-Braun-Platz 1 · 40549 Düsseldorf · otelo.de";

/** Meta- und TikTok-Stills tragen den langen Rechtssatz nicht im Motiv. Die PMax-Formate folgen den Styleguide-Bannern. */
export const PFLICHTTEXT_IN_MOTIV: Record<string, boolean> = {
  "pmax-1200x1200": true,
  "pmax-1200x628": true,
  "pmax-960x1200": true,
  "meta-1x1": false,
  "meta-9x16": false,
  "tiktok-9x16": false,
};

export type OrangeSide = "links" | "rechts";
export type HeadlineVariant = "direkt" | "box";
export type StoererTyp = "tarif" | "product" | "bonus" | "stern" | "kreis" | "ohne_preis";
export type VorlageName = "tarif" | "product" | "product_person" | "young";

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
  figureKey?: string;
  product?: Box;
  productKey?: string;
  energy?: Box;
  energyKey?: string;
  logoKey?: string;
  productName?: { text: string; box: Box };
  headline: { lines: string[]; variant: HeadlineVariant; box: Box; step: number };
  subline: { lines: Array<{ text: string; bold: boolean; color: string }>; box: Box };
  stoerer: { typ: StoererTyp; box: Box; preis: string; zusatz: string; einmal: string; aktion: string };
  cta: { box: Box; text: string };
  logo: { box: Box; side: "left" | "right" };
  pflichttext?: { text: string; box: Box };
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
  return "young";
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

function slope(angleDeg: number): number {
  return Math.tan((angleDeg * Math.PI) / 180);
}

function clipHalfPlane(width: number, height: number, inside: (x: number, y: number) => boolean): Pt[] {
  const subject: Pt[] = [[0, 0], [width, 0], [width, height], [0, height]];
  const output: Pt[] = [];
  const intersect = (a: Pt, b: Pt): Pt => {
    let lo = 0;
    let hi = 1;
    const startInside = inside(a[0], a[1]);
    for (let step = 0; step < 28; step += 1) {
      const mid = (lo + hi) / 2;
      const x = a[0] + (b[0] - a[0]) * mid;
      const y = a[1] + (b[1] - a[1]) * mid;
      if (inside(x, y) === startInside) lo = mid;
      else hi = mid;
    }
    const t = (lo + hi) / 2;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  let prev = subject[subject.length - 1];
  let prevIn = inside(prev[0], prev[1]);
  for (const cur of subject) {
    const curIn = inside(cur[0], cur[1]);
    if (curIn) {
      if (!prevIn) output.push(intersect(prev, cur));
      output.push(cur);
    } else if (prevIn) output.push(intersect(prev, cur));
    prev = cur;
    prevIn = curIn;
  }
  return output;
}

export function polygonArea(points: readonly Pt[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    sum += points[index][0] * next[1] - next[0] * points[index][1];
  }
  return Math.abs(sum) / 2;
}

/** One straight rising edge. Orange is the side that holds the requested corner, at about one third of the area. */
export function splitOrange(width: number, height: number, angleDeg: number, side: OrangeSide, ratio = 1 / 3): { polygon: Pt[]; ratio: number; angle: number } {
  const portrait = height > width;
  const min = portrait ? 11 : 25;
  const max = 45;
  let best = { polygon: [] as Pt[], ratio: 0, angle: min };
  let bestGap = Infinity;
  for (let angle = min; angle <= max; angle += 1) {
    const rise = slope(angle);
    for (let step = 0; step <= 70; step += 1) {
      const y0 = -height * 0.2 + height * 2.2 * (step / 70);
      const below = (x: number, y: number) => y + rise * x >= y0;
      const inside = (x: number, y: number) => side === "links" ? !below(x, y) : below(x, y);
      const polygon = clipHalfPlane(width, height, inside);
      if (polygon.length < 3) continue;
      const area = polygonArea(polygon) / (width * height);
      const bottomLeft = inside(1, height - 1);
      const bottomRight = inside(width - 1, height - 1);
      const topLeft = inside(1, 1);
      const topRight = inside(width - 1, 1);
      const anchor = side === "rechts" ? bottomRight : bottomLeft;
      if (!anchor) continue;
      const strict = side === "rechts" ? !topLeft : !topRight;
      const near = Math.min(Math.abs(area - ratio), Math.abs(area - 0.5));
      const gap = near + (strict ? 0 : 0.05) + Math.abs(angle - angleDeg) * 0.001;
      if (gap < bestGap) {
        bestGap = gap;
        best = { polygon, ratio: area, angle };
      }
    }
  }
  const inBand = (value: number) => (value >= 0.28 && value <= 0.4) || (value >= 0.45 && value <= 0.55);
  if (inBand(best.ratio)) return best;
  let fallback = best;
  let fallbackGap = Infinity;
  const rise = slope(Math.min(max, Math.max(min, angleDeg)));
  for (let step = 0; step <= 70; step += 1) {
    const y0 = height * 0.15 + height * 0.8 * (step / 70);
    const inside = (x: number, y: number) => y + rise * x >= y0;
    const polygon = clipHalfPlane(width, height, inside);
    if (polygon.length < 3) continue;
    const area = polygonArea(polygon) / (width * height);
    const gap = Math.abs(area - ratio);
    if (gap < fallbackGap) {
      fallbackGap = gap;
      fallback = { polygon, ratio: area, angle: Math.min(max, Math.max(min, angleDeg)) };
    }
  }
  return inBand(fallback.ratio) ? fallback : best;
}

function box(x: number, y: number, w: number, h: number): Box {
  return { x, y, w, h };
}

function overlaps(left: Box, right: Box): boolean {
  return left.x < right.x + right.w && right.x < left.x + left.w && left.y < right.y + right.h && right.y < left.y + left.h;
}

export function priceNeedsLegal(copy: Pick<SceneCopy, "preis" | "preisZusatz" | "einmalpreis" | "pflichttext">): boolean {
  const priced = `${copy.preis} ${copy.preisZusatz} ${copy.einmalpreis}`;
  return /[¹*]/.test(priced) && !copy.pflichttext.trim();
}

export function buildScene(
  format: { id: string; w: number; h: number },
  name: VorlageName,
  copy: SceneCopy,
): OteloScene {
  const { w, h } = format;
  const portrait = h > w;
  const prefer = TEMPLATE_ANGLE[name][portrait ? "portrait" : "landscape"];
  const split = splitOrange(w, h, prefer, copy.orange);
  const figure = name === "product" ? undefined : (() => {
    const fh = h * 0.78;
    const fw = fh * 0.7;
    const onRight = copy.orange === "rechts" || name === "product_person";
    const x = onRight ? Math.max(w * 0.48, w - fw * 0.86) : w * 0.02;
    return box(x, h * 1.05 - fh, fw, fh);
  })();
  const product = name === "product" || name === "product_person"
    ? box(w * 0.045, h * 0.18, Math.min(w, h) * 0.26, h * 0.58)
    : undefined;
  const energy = product ? box(product.x + product.w + w * 0.01, product.y + product.h * 0.35, Math.min(w, h) * 0.08, Math.min(w, h) * 0.1) : undefined;
  const productName = product ? { text: copy.produktname, box: box(product.x, product.y + product.h + h * 0.008, product.w * 1.4, h * 0.028) } : undefined;
  const headlineWidth = portrait ? w * 0.78 : w * 0.46;
  const headline = {
    lines: copy.headline.split(/\n/).map((line) => line.trim()).filter(Boolean).slice(0, 3).map((line) => line.toUpperCase()),
    variant: copy.headlineVariante,
    box: box(w * 0.05, h * 0.045, headlineWidth, portrait ? h * 0.1 : h * 0.145),
    step: w * 0.035,
  };
  const subLines = copy.subline.split(/\n/).map((line) => line.trim()).filter(Boolean).slice(0, 4);
  const subline = {
    lines: subLines.map((text, index) => ({ text, bold: index === 0, color: index === 0 ? ORANGE : WHITE })),
    box: box(headline.box.x, headline.box.y + headline.box.h + h * 0.012, headline.box.w * 0.8, h * 0.1),
  };
  const stoerer = {
    typ: copy.stoererTyp,
    box: box(headline.box.x, subline.box.y + subline.box.h + h * 0.02, Math.min(w, h) * 0.24, Math.min(w, h) * 0.24),
    preis: copy.preis,
    zusatz: copy.preisZusatz,
    einmal: copy.einmalpreis,
    aktion: copy.aktionText,
  };
  const ctaW = w * 0.48;
  const cta = {
    box: box(w * 0.05, h * 0.74, ctaW, Math.max(h * 0.055, 34)),
    text: copy.button.trim() || "Jetzt sichern auf **otelo.de**",
  };
  const logoW = Math.min(w, h) * 0.2;
  const logoH = logoW / 5.58;
  const logo = copy.orange === "rechts"
    ? { box: box(w * 0.05, h * 0.86, logoW, logoH), side: "left" as const }
    : { box: box(w - logoW - w * 0.05, h * 0.86, logoW, logoH), side: "right" as const };
  const pflicht = PFLICHTTEXT_IN_MOTIV[format.id] && copy.pflichttext.trim()
    ? { text: copy.pflichttext.trim(), box: box(w * 0.05, h - Math.max(10, h * 0.018) - 4, w * 0.9, Math.max(8, h * 0.014)) }
    : undefined;
  const hints: string[] = [];
  if (split.angle < (portrait ? 11 : 25) || split.angle > 45 || split.polygon.length < 3) {
    hints.push(`Die Schrägteilung hat ${split.angle} Grad im ${w}x${h}.`);
  }
  const third = split.ratio >= 0.28 && split.ratio <= 0.4;
  const half = split.ratio >= 0.45 && split.ratio <= 0.55;
  if (!third && !half) {
    hints.push(`Der Orange-Anteil ist ${Math.round(split.ratio * 100)} Prozent im ${w}x${h}. Vorgabe ist etwa ein Drittel oder die Hälfte.`);
  }
  if (figure && figure.y + figure.h < h - 1) {
    hints.push(`Die Figur berührt den unteren Rand nicht im ${w}x${h}.`);
  }
  if (headline.lines.length > 2) hints.push(`Die Headline hat mehr als zwei Zeilen im ${w}x${h}.`);
  if (subline.lines.length > 3) hints.push(`Die Subline hat mehr als drei Zeilen im ${w}x${h}.`);
  if (cta.box.w < w * 0.4 || cta.box.w > w * 0.55) hints.push(`Die CTA-Leiste hat nicht 40 bis 55 Prozent der Breite im ${w}x${h}.`);
  if (figure) {
    for (const item of [headline.box, subline.box]) {
      if (overlaps(item, figure)) hints.push(`Text überlappt die Figur im ${w}x${h}.`);
    }
  }
  if (priceNeedsLegal(copy)) hints.push("Zum Preis mit Fußnote fehlt der Pflichttext.");
  return {
    id: format.id,
    width: w,
    height: h,
    orange: split.polygon,
    angle: split.angle,
    orangeRatio: split.ratio,
    orangeSide: copy.orange,
    figure,
    product,
    energy,
    productName,
    headline,
    subline,
    stoerer,
    cta,
    logo,
    pflichttext: pflicht,
    hints,
  };
}

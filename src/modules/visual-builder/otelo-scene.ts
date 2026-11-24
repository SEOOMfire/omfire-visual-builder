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
  figureFlip?: boolean;
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

function headlineLines(raw: string): string[] {
  const given = raw.split(/\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.toUpperCase());
  if (given.length !== 1) return given.slice(0, 3);
  const words = given[0].split(/\s+/);
  if (words.length < 2) return given;
  const cut = words.length === 3 ? 1 : Math.ceil(words.length / 2);
  return [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
}

function overlaps(left: Box, right: Box): boolean {
  return left.x < right.x + right.w && right.x < left.x + left.w && left.y < right.y + right.h && right.y < left.y + left.h;
}

export function priceNeedsLegal(copy: Pick<SceneCopy, "preis" | "preisZusatz" | "einmalpreis" | "pflichttext">): boolean {
  const priced = `${copy.preis} ${copy.preisZusatz} ${copy.einmalpreis}`;
  return /[¹*]/.test(priced) && !copy.pflichttext.trim();
}

type Shift = { dx?: number; dy?: number; scale?: number; flip?: boolean; hidden?: boolean };

function moved(target: Box, shift: Shift | undefined, width: number, height: number): Box | undefined {
  if (shift?.hidden) return undefined;
  if (!shift) return target;
  const scale = shift.scale && shift.scale > 0 ? shift.scale : 1;
  const cx = target.x + target.w / 2 + ((shift.dx ?? 0) / 100) * width;
  const cy = target.y + target.h / 2 + ((shift.dy ?? 0) / 100) * height;
  return { x: cx - (target.w * scale) / 2, y: cy - (target.h * scale) / 2, w: target.w * scale, h: target.h * scale };
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

function outsideSafe(target: Box, width: number, height: number): boolean {
  return target.x < width * 0.05 - 1 || target.y < height * 0.05 - 1 || target.x + target.w > width * 0.95 + 1 || target.y + target.h > height * 0.95 + 1;
}

export function buildScene(
  format: { id: string; w: number; h: number },
  name: VorlageName,
  copy: SceneCopy,
  shifts: Partial<Record<"headline" | "subline" | "stoerer" | "person" | "geraet" | "cta" | "logo" | "pflichttext" | "energielabel" | "schraege", Shift>> = {},
): OteloScene {
  const { w, h } = format;
  const portrait = h > w;
  const prefer = TEMPLATE_ANGLE[name][portrait ? "portrait" : "landscape"];
  const split = splitOrange(w, h, prefer, copy.orange);
  const figure = name === "product" ? undefined : (() => {
    const fh = h * 0.78;
    const fw = fh * 0.7;
    const onRight = copy.orange === "rechts" || name === "product_person";
    const x = onRight ? Math.max(w * 0.56, w - fw * 0.86) : w * 0.02;
    return box(x, h * 1.05 - fh, fw, fh);
  })();
  const product = name === "product" || name === "product_person"
    ? box(w * 0.045, h * 0.18, Math.min(w, h) * 0.26, h * 0.58)
    : undefined;
  const energy = product ? box(product.x + product.w + w * 0.01, product.y + product.h * 0.35, Math.min(w, h) * 0.08, Math.min(w, h) * 0.1) : undefined;
  const productName = product ? { text: copy.produktname, box: box(product.x, product.y + product.h + h * 0.008, product.w * 1.4, h * 0.028) } : undefined;
  const headlineWidth = portrait ? w * 0.48 : w * 0.52;
  const lines = headlineLines(copy.headline);
  const headline = {
    lines,
    variant: copy.headlineVariante,
    box: box(w * 0.055, h * 0.055, headlineWidth, (portrait ? h * 0.065 : h * 0.1) * Math.max(1, Math.min(2, lines.length))),
    step: w * 0.04,
  };
  const subLines = copy.subline.split(/\n/).map((line) => line.trim()).filter(Boolean).slice(0, 4);
  const subline = {
    lines: subLines.map((text, index) => ({ text, bold: index === 0, color: index === 0 ? ORANGE : WHITE })),
    box: box(headline.box.x, headline.box.y + headline.box.h + h * 0.012, Math.min(headline.box.w, w * 0.46), h * 0.09),
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
  let logoBox = copy.orange === "rechts"
    ? box(w * 0.055, h * 0.78, logoW, logoH)
    : box(w - logoW - w * 0.055, h * 0.78, logoW, logoH);
  const corners = (target: Box): Pt[] => [[target.x, target.y], [target.x + target.w, target.y], [target.x, target.y + target.h], [target.x + target.w, target.y + target.h]];
  for (let step = 0; step < 10 && corners(logoBox).some(([x, y]) => pointInPolygon(x, y, split.polygon)); step += 1) {
    logoBox = { ...logoBox, y: logoBox.y - h * 0.025 };
  }
  const logo = { box: logoBox, side: (copy.orange === "rechts" ? "left" : "right") as "left" | "right" };
  const placed = {
    figure: figure ? moved(figure, shifts.person, w, h) : undefined,
    product: product ? moved(product, shifts.geraet, w, h) : undefined,
    energy: energy ? moved(energy, shifts.energielabel, w, h) : undefined,
    headline: moved(headline.box, shifts.headline, w, h) ?? headline.box,
    subline: moved(subline.box, shifts.subline, w, h) ?? subline.box,
    stoerer: moved(stoerer.box, shifts.stoerer, w, h) ?? stoerer.box,
    cta: moved(cta.box, shifts.cta, w, h) ?? cta.box,
    logo: moved(logo.box, shifts.logo, w, h),
  };
  const pflichtBox = copy.pflichttext.trim()
    ? moved(box(w * 0.05, h * 0.9, w * 0.7, Math.max(8, h * 0.016)), shifts.pflichttext, w, h)
    : undefined;
  const pflicht = pflichtBox ? { text: copy.pflichttext.trim(), box: pflichtBox } : undefined;
  const hints: string[] = [];
  if (split.angle < (portrait ? 11 : 25) || split.angle > 45 || split.polygon.length < 3) {
    hints.push(`Die Schrägteilung hat ${split.angle} Grad im ${w}x${h}.`);
  }
  const third = split.ratio >= 0.28 && split.ratio <= 0.4;
  const half = split.ratio >= 0.45 && split.ratio <= 0.55;
  if (!third && !half) {
    hints.push(`Der Orange-Anteil ist ${Math.round(split.ratio * 100)} Prozent im ${w}x${h}. Vorgabe ist etwa ein Drittel oder die Hälfte.`);
  }
  if (placed.figure && placed.figure.y + placed.figure.h < h - 1) {
    hints.push(`Die Figur berührt den unteren Rand nicht im ${w}x${h}.`);
  }
  if (headline.lines.length > 2) hints.push(`Die Headline hat mehr als zwei Zeilen im ${w}x${h}.`);
  if (subline.lines.length > 3) hints.push(`Die Subline hat mehr als drei Zeilen im ${w}x${h}.`);
  if (placed.cta.w < w * 0.4 || placed.cta.w > w * 0.55) hints.push(`Die CTA-Leiste hat nicht 40 bis 55 Prozent der Breite im ${w}x${h}.`);
  if (placed.logo && outsideSafe(placed.logo, w, h)) hints.push(`Das Logo liegt außerhalb der Schutzzone im ${w}x${h}.`);
  if (placed.logo && pointInPolygon(placed.logo.x + placed.logo.w / 2, placed.logo.y + placed.logo.h / 2, split.polygon)) {
    hints.push(`Die weiße Wortmarke liegt auf Orange im ${w}x${h}.`);
  }
  for (const item of [placed.headline, placed.subline, placed.cta]) {
    if (outsideSafe(item, w, h)) hints.push(`Ein Element liegt außerhalb der sicheren Zone im ${w}x${h}.`);
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

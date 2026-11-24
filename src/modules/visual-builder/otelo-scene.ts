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

/** One straight rising edge. Orange stays as close to one third as the angle range allows and never over half. */
export function splitOrange(width: number, height: number, angleDeg: number, _side: OrangeSide, ratio = 1 / 3): { polygon: Pt[]; ratio: number; angle: number } {
  const portrait = height > width;
  const min = portrait ? 11 : 18;
  const max = 45;
  let best = { polygon: [[0, height * 0.67], [width, height * 0.5], [width, height], [0, height]] as Pt[], ratio: 0.4, angle: min };
  let bestGap = Infinity;
  for (let angle = min; angle <= max; angle += 1) {
    const rise = Math.tan((angle * Math.PI) / 180) * width;
    const target = (height * (1 - ratio)) * 2;
    let yLeft = (target + rise) / 2;
    let yRight = (target - rise) / 2;
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
    if (yLeft <= yRight + 4 || yLeft > height || yRight < 0) continue;
    const polygon: Pt[] = [[0, yLeft], [width, yRight], [width, height], [0, height]];
    const area = rasterOrangeRatio(polygon, width, height);
    if (area > 0.5 || area < 0.2 || !edgeRises(polygon, width, height)) continue;
    const gap = Math.abs(area - ratio) + Math.abs(angle - angleDeg) * 0.0005;
    if (gap < bestGap) {
      bestGap = gap;
      best = { polygon, ratio: area, angle };
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
    box: box(textX, headline.box.y + headline.box.h + h * 0.012, Math.max(w * 0.18, stoererX - textX - diamond * 0.2), portrait ? h * 0.07 : h * 0.1),
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
  const logoW = Math.min(w, h) * (portrait ? 0.16 : 0.2);
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
    const top = Math.max(logo.box.y + logo.box.h, cta.box.y + cta.box.h) + h * 0.01;
    const fh = portrait ? h * 1.04 - top : h * 0.92;
    const textRight = columnEnd + w * 0.015;
    const fw = Math.min(w * (portrait ? 0.46 : 0.4), Math.max(w * 0.28, w - textRight));
    const x = personRight ? textRight : Math.max(-w * 0.02, Math.min(w * 0.02, textX - fw));
    const y = portrait ? top : h * 1.04 - fh;
    return box(x, y, fw, fh);
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
    ? moved(box(logo.box.x + logo.box.w + w * 0.015, logo.box.y, Math.max(w * 0.16, columnEnd - logo.box.x - logo.box.w - w * 0.02), Math.max(8, h * 0.016)), shifts.pflichttext, w, h)
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
      hints.push(`${nameOf} liegt außerhalb der sicheren Zone im ${label}.`);
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

import { BADGE_LINE_HEIGHT, badgeFontSize, badgeHeight, badgeSegments, lineBold, priceBoxLayout, type BadgeSegment } from "./brand";
import { DEFAULT_CROP, DEFAULT_FIGURE, clampToZone, figureRect, placeInZone } from "./layout";
import { htmlToRuns, type Run } from "./rich-text";
import type { Align, BadgeItem, BadgeLine, Crop, CtaAsset, CtaPlacement, FigureBox, LogoPlacement, Point, Rect, StickerItem, TextBlock } from "./types";

export type DrawOptions = {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  bg: HTMLImageElement | null;
  crop?: Crop;
  /** Fills the canvas when there is no background image. */
  bgColor?: string | null;
  figure?: HTMLImageElement | null;
  figureBox?: FigureBox;
  blocks: readonly [TextBlock, TextBlock];
  fontFamily: string;
  logo: HTMLImageElement | null;
  logoPlacement: LogoPlacement;
  logoPos?: Point | null;
  logoScale: number;
  cta: CtaAsset | null;
  ctaText?: string;
  ctaImg: HTMLImageElement | null;
  ctaPlacement: CtaPlacement;
  ctaPos?: Point | null;
  ctaScale: number;
  safeZone: Rect;
  emptyLabel: string;
  /** Used by text buttons without their own font. */
  ctaFont: string;
  badges?: readonly BadgeItem[];
  badgeFont?: string;
  /** Placed stickers with their loaded images; missing images are skipped. */
  stickers?: ReadonlyArray<{ item: StickerItem; image: HTMLImageElement | null }>;
  product?: HTMLImageElement | null;
  productBox?: FigureBox;
  productLogo?: HTMLImageElement | null;
  energyLabel?: HTMLImageElement | null;
  energyBox?: { x_pct: number; y_pct: number; h_pct: number };
  /** Orange wedge under the content. The angle is the rise of its top edge. */
  splitAngle?: number;
};

/** Orange below a diagonal of `angleDeg`, kept in the lower part of the canvas so the rise stays the given angle. */
export function drawOrangeSplit(ctx: CanvasRenderingContext2D, width: number, height: number, angleDeg: number) {
  const slope = Math.tan((angleDeg * Math.PI) / 180);
  const rise = Math.min(height * 0.34, Math.max(8, slope * width * 0.45));
  const run = slope > 0 ? rise / slope : width;
  const x1 = Math.max(0, width / 2 - run / 2);
  const x2 = Math.min(width, x1 + run);
  const y2 = height * 0.66;
  const y1 = y2 + rise;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, y1);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(width, y2);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = "#FA5A14";
  ctx.fill();
  ctx.restore();
}

/** Button text as typed; `**…**` marks bold parts (e.g. the domain in an arrow bar). */
export function ctaLabel(cta: CtaAsset, text: string | undefined): string {
  return (text ?? "").trim() || cta.text || cta.name || "";
}

/** Button text without bold markers, for the guideline check. */
export function ctaPlain(label: string): string {
  return label.replace(/\*\*/g, "");
}

type LabelPart = { text: string; bold: boolean };
function labelParts(label: string): LabelPart[] {
  return label.split("**").map((text, index) => ({ text, bold: index % 2 === 1 })).filter((part) => part.text);
}

function ctaWeights(cta: CtaAsset): { normal: number; bold: number } {
  return cta.style.shape === "arrow" ? { normal: 400, bold: 700 } : { normal: 700, bold: 800 };
}

function measureLabel(ctx: CanvasRenderingContext2D, parts: LabelPart[], fontSize: number, family: string, weights: { normal: number; bold: number }) {
  let width = 0;
  for (const part of parts) {
    ctx.font = `${part.bold ? weights.bold : weights.normal} ${fontSize}px "${family}", sans-serif`;
    width += ctx.measureText(part.text).width;
  }
  return width;
}

/** Size of a text CTA in canvas pixels, for drawing and for the movable frame. */
export function textCtaMetrics(ctx: CanvasRenderingContext2D, cta: CtaAsset, label: string, targetW: number, fallbackFont: string) {
  const family = cta.style.font_family || fallbackFont;
  const shape = cta.style.shape ?? "tag";
  const fontSize = targetW * 0.2;
  const textW = measureLabel(ctx, labelParts(label), fontSize, family, ctaWeights(cta));
  if (shape === "arrow") {
    const height = fontSize / 0.63;
    return { fontSize, slant: 0, height, width: height * 2.31 + textW + height * 1.1, textX: height * 2.31 };
  }
  if (shape === "pill" || shape === "outline") {
    const height = fontSize * 1.7;
    return { fontSize, slant: 0, height, width: textW + fontSize * 1.7, textX: fontSize * 0.85 };
  }
  const px = fontSize * 0.85;
  const py = fontSize * 0.55;
  const slant = fontSize * 0.42;
  return { fontSize, slant, width: textW + px * 2 + slant, height: fontSize + py * 2, textX: px + slant / 2 };
}

export function drawCanvas(o: DrawOptions): void {
  const ctx = o.canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, o.w, o.h);

  if (o.bg) {
    const imageRatio = o.bg.width / o.bg.height;
    const canvasRatio = o.w / o.h;
    const crop = o.crop ?? DEFAULT_CROP;
    let sw = o.bg.width;
    let sh = o.bg.height;
    if (imageRatio > canvasRatio) sw = o.bg.height * canvasRatio; else sh = o.bg.width / canvasRatio;
    const zoom = Math.max(1, crop.zoom);
    sw /= zoom;
    sh /= zoom;
    const sx = (o.bg.width - sw) * Math.min(1, Math.max(0, crop.x));
    const sy = (o.bg.height - sh) * Math.min(1, Math.max(0, crop.y));
    ctx.drawImage(o.bg, sx, sy, sw, sh, 0, 0, o.w, o.h);
  } else if (o.bgColor || o.figure) {
    ctx.fillStyle = o.bgColor || "#000000";
    ctx.fillRect(0, 0, o.w, o.h);
    if (o.splitAngle) drawOrangeSplit(ctx, o.w, o.h, o.splitAngle);
  } else {
    ctx.fillStyle = "#e5e5e5";
    ctx.fillRect(0, 0, o.w, o.h);
    ctx.fillStyle = "#a3a3a3";
    ctx.font = `bold ${Math.floor(o.h * 0.03)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(o.emptyLabel, o.w / 2, o.h / 2);
  }

  const stickers = o.stickers ?? [];
  for (const { item, image } of stickers) if (item.behind && image) drawSticker(ctx, item, image, o.w, o.h);

  if (o.figure) {
    const box = o.figureBox ?? DEFAULT_FIGURE;
    const rect = figureRect(box, o.figure.width / o.figure.height, o.w, o.h);
    drawRotated(ctx, o.figure, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, box.rotate ?? 0, box.flip);
  }

  if (o.product) {
    const box = o.productBox ?? { x_pct: 70, bottom_pct: 96, h_pct: 48, flip: false };
    const rect = figureRect(box, o.product.width / o.product.height, o.w, o.h);
    ctx.drawImage(o.product, rect.x, rect.y, rect.w, rect.h);
  }
  if (o.product && o.productLogo) {
    const w = Math.min(o.w, o.h) * 0.28;
    const h = w / (o.productLogo.width / o.productLogo.height);
    ctx.drawImage(o.productLogo, o.w * 0.08, o.h * 0.08, w, h);
  }
  if (o.energyLabel) {
    const box = o.energyBox ?? { x_pct: 8, y_pct: 78, h_pct: 8 };
    const h = (box.h_pct / 100) * o.h;
    const w = h * (o.energyLabel.width / o.energyLabel.height);
    ctx.drawImage(o.energyLabel, (box.x_pct / 100) * o.w, (box.y_pct / 100) * o.h, w, h);
  }

  for (const { item, image } of stickers) if (!item.behind && image) drawSticker(ctx, item, image, o.w, o.h);

  const shorter = Math.min(o.w, o.h);
  for (const block of o.blocks) {
    const runs = htmlToRuns(block.html);
    if (!runs.some((run) => run.text.trim())) continue;
    const zx = (block.rect.x_pct / 100) * o.w;
    const zy = (block.rect.y_pct / 100) * o.h;
    const zw = (block.rect.w_pct / 100) * o.w;
    const zh = (block.rect.h_pct / 100) * o.h;
    const fontSize = (block.sizePct / 100) * o.h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(zx, zy, zw, zh);
    ctx.clip();
    const frame = block.frame;
    if (frame) {
      // The frame hugs the text; the text area shrinks by the padding so frame and outline stay inside the box.
      const line = Math.max(1, shorter * 0.004);
      const padX = shorter * 0.025 + line;
      const padY = shorter * 0.012 + line;
      drawFormattedText(ctx, runs, zx + padX, zy + padY, zw - padX * 2, zh - padY * 2, fontSize, block.font || o.fontFamily, block.color, block.align, block.lineHeight ?? 1.25,
        (bounds) => {
          const fx = bounds.x - padX + line / 2;
          const fy = bounds.y - padY + line / 2;
          roundRectPath(ctx, fx, fy, bounds.w + padX * 2 - line, bounds.h + padY * 2 - line, shorter * 0.018);
          if (frame.fill) { ctx.fillStyle = frame.fill; ctx.fill(); }
          ctx.strokeStyle = frame.border;
          ctx.lineWidth = line;
          ctx.stroke();
        });
    } else {
      drawFormattedText(ctx, runs, zx, zy, zw, zh, fontSize, block.font || o.fontFamily, block.color, block.align, block.lineHeight ?? 1.25);
    }
    ctx.restore();
  }

  for (const badge of o.badges ?? []) drawBadge(ctx, badge, o.w, o.h, o.badgeFont || o.fontFamily);

  if (o.logo) {
    const shorter = Math.min(o.w, o.h);
    const lw = (o.logoScale / 100) * shorter;
    const lh = lw / (o.logo.width / o.logo.height);
    const pad = shorter * 0.03;
    const raw = o.logoPos
      ? { x: (o.logoPos.x_pct / 100) * o.w, y: (o.logoPos.y_pct / 100) * o.h }
      : placeInZone(o.logoPlacement, lw, lh, o.safeZone, o.w, o.h, pad);
    const pos = clampToZone(raw.x, raw.y, lw, lh, o.safeZone, o.w, o.h);
    ctx.drawImage(o.logo, pos.x, pos.y, lw, lh);
  }

  if (o.ctaPlacement !== "none" && o.cta) {
    const shorter = Math.min(o.w, o.h);
    const targetW = (o.ctaScale / 100) * shorter;
    const pad = shorter * 0.03;
    if (o.cta.variant === "graphic" && o.ctaImg) {
      const cw = targetW;
      const ch = targetW / (o.ctaImg.width / o.ctaImg.height);
      const raw = o.ctaPos
        ? { x: (o.ctaPos.x_pct / 100) * o.w, y: (o.ctaPos.y_pct / 100) * o.h }
        : placeInZone(o.ctaPlacement, cw, ch, o.safeZone, o.w, o.h, pad);
      const pos = clampToZone(raw.x, raw.y, cw, ch, o.safeZone, o.w, o.h);
      ctx.drawImage(o.ctaImg, pos.x, pos.y, cw, ch);
    } else if (o.cta.variant === "text") {
      const label = ctaLabel(o.cta, o.ctaText);
      const metrics = textCtaMetrics(ctx, o.cta, label, targetW, o.ctaFont);
      const raw = o.ctaPos
        ? { x: (o.ctaPos.x_pct / 100) * o.w, y: (o.ctaPos.y_pct / 100) * o.h }
        : placeInZone(o.ctaPlacement, metrics.width, metrics.height, o.safeZone, o.w, o.h, pad);
      const pos = clampToZone(raw.x, raw.y, metrics.width, metrics.height, o.safeZone, o.w, o.h);
      const shape = o.cta.style.shape ?? "tag";
      ctx.fillStyle = o.cta.style.bg_color || "#e5001c";
      if (shape === "arrow") {
        arrowBarPaths(ctx, pos.x, pos.y, metrics.width, metrics.height);
      } else if (shape === "pill" || shape === "outline") {
        roundRectPath(ctx, pos.x, pos.y, metrics.width, metrics.height, metrics.fontSize * 0.25);
        ctx.fill();
        if (shape === "outline") {
          ctx.strokeStyle = o.cta.style.border_color || o.cta.style.text_color || "#ffffff";
          ctx.lineWidth = Math.max(1, metrics.fontSize * 0.07);
          ctx.stroke();
        }
      } else {
        ctaTagPath(ctx, pos.x, pos.y, metrics.width, metrics.height, metrics.height * 0.18, metrics.slant);
        ctx.fill();
      }
      ctx.fillStyle = o.cta.style.text_color || "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const family = o.cta.style.font_family || o.ctaFont;
      const weights = ctaWeights(o.cta);
      const parts = labelParts(label);
      let x = shape === "arrow" ? pos.x + metrics.textX : pos.x + (metrics.width - measureLabel(ctx, parts, metrics.fontSize, family, weights)) / 2;
      for (const part of parts) {
        ctx.font = `${part.bold ? weights.bold : weights.normal} ${metrics.fontSize}px "${family}", sans-serif`;
        ctx.fillText(part.text, x, pos.y + metrics.height / 2 + metrics.fontSize * 0.03);
        x += ctx.measureText(part.text).width;
      }
    }
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | [number, number, number, number]) {
  const [tl, tr, br, bl] = (Array.isArray(r) ? r : [r, r, r, r]).map((value) => Math.max(0, Math.min(value, w / 2, h / 2)));
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

/** Two chevrons and a bar with an arrow tip, proportions of a classic campaign CTA bar. */
function arrowBarPaths(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const tip = h / 2;
  const chevron = (left: number, thickness: number) => {
    ctx.beginPath();
    ctx.moveTo(x + left, y);
    ctx.lineTo(x + left + tip, y + tip);
    ctx.lineTo(x + left, y + h);
    ctx.lineTo(x + left + thickness, y + h);
    ctx.lineTo(x + left + thickness + tip, y + tip);
    ctx.lineTo(x + left + thickness, y);
    ctx.closePath();
    ctx.fill();
  };
  chevron(0, h * 0.284);
  chevron(h * 0.6, h * 0.308);
  const start = h * 1.224;
  const end = w - tip;
  ctx.beginPath();
  ctx.moveTo(x + start, y);
  ctx.lineTo(x + start + tip, y + tip);
  ctx.lineTo(x + start, y + h);
  ctx.lineTo(x + end, y + h);
  ctx.lineTo(x + end + tip, y + tip);
  ctx.lineTo(x + end, y);
  ctx.closePath();
  ctx.fill();
}

/* ---------- Badges ---------- */

/** Badge position and size in canvas pixels. */
export function badgeRect(badge: BadgeItem, W: number, H: number) {
  const w = (badge.scale / 100) * Math.min(W, H);
  return { x: (badge.pos.x_pct / 100) * W, y: (badge.pos.y_pct / 100) * H, w, h: badgeHeight(badge.shape, badge.lines, w) };
}

const SMALL_SEGMENT = 0.48;
const segmentFont = (segment: BadgeSegment, size: number, family: string) =>
  `${segment.bold ? 800 : 500} ${segment.small ? size * SMALL_SEGMENT : size}px "${family}", sans-serif`;

function segmentsWidth(ctx: CanvasRenderingContext2D, segments: BadgeSegment[], size: number, family: string) {
  let width = 0;
  for (const segment of segments) {
    ctx.font = segmentFont(segment, size, family);
    width += ctx.measureText(segment.text).width;
  }
  return width;
}

/** Draws centred lines into a box; every line shrinks until it fits the width, all shrink together for the height. */
function drawBadgeLines(ctx: CanvasRenderingContext2D, lines: readonly BadgeLine[], badge: BadgeItem, w: number, cx: number, top: number, innerW: number, innerH: number, color: string, family: string) {
  const visible = lines.filter((line) => line.text.trim()).map((line) => ({ line, segments: badgeSegments(line.text, lineBold(line)) }));
  if (!visible.length) return;
  const sizes = visible.map(({ line, segments }) => {
    const size = badgeFontSize(badge.shape, line.size, w);
    const measured = segmentsWidth(ctx, segments, size, family);
    return measured > innerW ? size * (innerW / measured) : size;
  });
  const total = sizes.reduce((sum, size) => sum + size * BADGE_LINE_HEIGHT, 0);
  const factor = total > innerH ? innerH / total : 1;
  let y = top + (innerH - total * factor) / 2;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  visible.forEach(({ line, segments }, index) => {
    const size = sizes[index] * factor;
    const lineH = size * BADGE_LINE_HEIGHT;
    const midY = y + lineH / 2;
    const lineW = segmentsWidth(ctx, segments, size, family);
    let x = cx - lineW / 2;
    for (const segment of segments) {
      ctx.font = segmentFont(segment, size, family);
      const segmentW = ctx.measureText(segment.text).width;
      // Small additions sit raised, like an old price next to the new one.
      const segmentY = segment.small ? midY - size * 0.22 : midY + size * 0.04;
      ctx.fillText(segment.text, x, segmentY);
      if (segment.small) strikeLine(ctx, x, segmentY - size * 0.02, segmentW, size * SMALL_SEGMENT);
      x += segmentW;
    }
    if (line.strike) strikeLine(ctx, cx - lineW / 2, midY, lineW, size);
    y += lineH;
  });
}

function strikeLine(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, size: number) {
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.beginPath();
  ctx.moveTo(x - size * 0.05, y);
  ctx.lineTo(x + width + size * 0.05, y);
  ctx.stroke();
}

/** Image centred at (cx, cy), rotated in degrees and optionally mirrored. */
function drawRotated(ctx: CanvasRenderingContext2D, image: HTMLImageElement, cx: number, cy: number, w: number, h: number, rotate: number, flip: boolean) {
  ctx.save();
  ctx.translate(cx, cy);
  if (rotate) ctx.rotate((rotate * Math.PI) / 180);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** Sticker size in canvas pixels (before rotation). */
export function stickerSize(item: StickerItem, aspect: number, W: number, H: number) {
  const w = (item.scale / 100) * Math.min(W, H);
  return { w, h: w / (aspect || 1) };
}

function drawSticker(ctx: CanvasRenderingContext2D, item: StickerItem, image: HTMLImageElement, W: number, H: number) {
  const { w, h } = stickerSize(item, image.width / image.height, W, H);
  drawRotated(ctx, image, (item.x_pct / 100) * W, (item.y_pct / 100) * H, w, h, item.rotate, item.flip);
}

function burstPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number, spikes: number) {
  ctx.beginPath();
  for (let index = 0; index < spikes * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI * index) / spikes - Math.PI / 2;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawBadge(ctx: CanvasRenderingContext2D, badge: BadgeItem, W: number, H: number, family: string) {
  const { x, y, w, h } = badgeRect(badge, W, H);
  const { colors } = badge;
  ctx.save();
  if (badge.shape === "price-box") {
    const layout = priceBoxLayout(badge.lines, w);
    const radius = w * 0.08;
    const line = Math.max(1, w * 0.008);
    if (layout.topH) {
      ctx.fillStyle = colors.bg;
      roundRectPath(ctx, x, y, w, layout.topH, layout.bottomH ? [radius, radius, 0, 0] : radius);
      ctx.fill();
      drawBadgeLines(ctx, layout.top, badge, w, x + w / 2, y + layout.pad, w - layout.pad * 2, layout.topH - layout.pad * 2, colors.fg, family);
    }
    if (layout.bottomH) {
      const top = y + layout.topH;
      ctx.fillStyle = colors.accentBg;
      roundRectPath(ctx, x + line / 2, top, w - line, layout.bottomH - line / 2, layout.topH ? [0, 0, radius, radius] : radius);
      ctx.fill();
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = line;
      ctx.stroke();
      drawBadgeLines(ctx, layout.bottom, badge, w, x + w / 2, top + layout.pad, w - layout.pad * 2, layout.bottomH - layout.pad * 2, colors.accentFg, family);
    }
    ctx.restore();
    return;
  }
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.fillStyle = colors.bg;
  let innerW = w * 0.62;
  let innerH = h * 0.62;
  if (badge.shape === "diamond") {
    const side = w / Math.SQRT2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    roundRectPath(ctx, -side / 2, -side / 2, side, side, side * 0.12);
    ctx.fill();
    ctx.restore();
    innerW = w * 0.56;
    innerH = h * 0.5;
  } else if (badge.shape === "burst") {
    burstPath(ctx, cx, cy, w / 2, w * 0.43, 22);
    ctx.fill();
    innerW = w * 0.66;
    innerH = h * 0.62;
  } else if (badge.shape === "circle") {
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    roundRectPath(ctx, x, y, w, h, w * 0.1);
    ctx.fill();
    innerW = w * 0.8;
    innerH = h * 0.75;
  }
  drawBadgeLines(ctx, badge.lines, badge, w, cx, cy - innerH / 2, innerW, innerH, colors.fg, family);
  ctx.restore();
}

/** Button shape: a parallelogram leaning right with rounded corners. */
function ctaTagPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, slant: number) {
  const points: Array<[number, number]> = [[x + slant, y], [x + w, y], [x + w - slant, y + h], [x, y + h]];
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[3], points[0]);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let index = 0; index < 4; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % 4];
    const middle = mid(current, next);
    ctx.arcTo(current[0], current[1], middle[0], middle[1], r);
    ctx.lineTo(middle[0], middle[1]);
  }
  ctx.closePath();
}

type Token = { text: string; kind: "word" | "space" | "nl"; b: boolean; i: boolean; u: boolean; s: number; f?: string; c?: string };

function tokenize(runs: Run[]): Token[] {
  const out: Token[] = [];
  for (const run of runs) {
    for (const part of run.text.split(/(\n|[ \t]+)/)) {
      if (!part) continue;
      const base = { b: run.b, i: run.i, u: run.u, s: run.s, f: run.f, c: run.c };
      if (part === "\n") out.push({ text: "", kind: "nl", ...base });
      else if (/^[ \t]+$/.test(part)) out.push({ text: " ", kind: "space", ...base });
      else out.push({ text: part, kind: "word", ...base });
    }
  }
  return out;
}

function fontString(token: { b: boolean; i: boolean; s?: number; f?: string }, size: number, family: string) {
  const style = token.i ? "italic" : "normal";
  const weight = token.b ? 800 : 400;
  const name = token.f || family;
  const quoted = /\s/.test(name) ? `"${name}"` : name;
  return `${style} ${weight} ${size * (token.s ?? 1)}px ${quoted}, sans-serif`;
}

function layoutTokens(
  ctx: CanvasRenderingContext2D,
  tokens: Token[],
  maxW: number,
  fontSize: number,
  fontFamily: string,
  lineSpacing: number,
): { lines: Token[][]; lineHeights: number[]; totalH: number } {
  const measure = (token: Token) => {
    ctx.font = fontString(token, fontSize, fontFamily);
    return ctx.measureText(token.text).width;
  };
  const lines: Token[][] = [];
  let current: Token[] = [];
  let currentW = 0;
  const flush = () => { lines.push(current); current = []; currentW = 0; };
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token.kind === "nl") { flush(); index += 1; continue; }
    if (token.kind === "space") {
      if (current.length > 0) { current.push(token); currentW += measure(token); }
      index += 1;
      continue;
    }
    const group: Token[] = [];
    let groupW = 0;
    while (index < tokens.length && tokens[index].kind === "word") {
      groupW += measure(tokens[index]);
      group.push(tokens[index]);
      index += 1;
    }
    if (current.length > 0 && currentW + groupW > maxW) {
      while (current.length && current[current.length - 1].kind === "space") currentW -= measure(current.pop()!);
      flush();
    }
    current.push(...group);
    currentW += groupW;
  }
  if (current.length) flush();
  // Line height follows the largest scale in the line, never the box size.
  const lineHeights = lines.map((line) => fontSize * lineSpacing * line.reduce((max, token) => Math.max(max, token.s ?? 1), 1));
  return { lines, lineHeights, totalH: lineHeights.reduce((sum, height) => sum + height, 0) };
}

function drawFormattedText(
  ctx: CanvasRenderingContext2D,
  runs: Run[],
  x: number, y: number, w: number, h: number,
  maxFontSize: number,
  fontFamily: string, color: string, align: Align, lineSpacing = 1.25,
  beforePaint?: (bounds: { x: number; y: number; w: number; h: number }) => void,
) {
  const tokens = tokenize(runs);
  if (tokens.length === 0) return;

  // The text box decides the font size: shrink until everything fits.
  let fontSize = maxFontSize;
  let layout = layoutTokens(ctx, tokens, w, fontSize, fontFamily, lineSpacing);
  const fits = (candidate: ReturnType<typeof layoutTokens>, size: number) => {
    if (candidate.totalH > h) return false;
    for (const line of candidate.lines) {
      let lineW = 0;
      for (const token of line) { ctx.font = fontString(token, size, fontFamily); lineW += ctx.measureText(token.text).width; }
      if (lineW > w + 0.5) return false;
    }
    return true;
  };
  let guard = 0;
  while (!fits(layout, fontSize) && fontSize > 4 && guard++ < 200) {
    fontSize *= 0.95;
    layout = layoutTokens(ctx, tokens, w, fontSize, fontFamily, lineSpacing);
  }
  const { lines, lineHeights, totalH } = layout;
  const lineWidths = lines.map((line) => {
    let lineW = 0;
    for (const token of line) { ctx.font = fontString(token, fontSize, fontFamily); lineW += ctx.measureText(token.text).width; }
    return lineW;
  });
  const startX = (lineW: number) => (align === "left" ? x : align === "right" ? x + w - lineW : x + (w - lineW) / 2);
  let ty = y + Math.max(0, (h - totalH) / 2);
  if (beforePaint) {
    const widest = Math.max(0, ...lineWidths);
    beforePaint({ x: startX(widest), y: ty, w: widest, h: totalH });
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  lines.forEach((line, lineIndex) => {
    const lineHeight = lineHeights[lineIndex];
    const baseY = ty + lineHeight / 2;
    let tx = startX(lineWidths[lineIndex]);
    for (const token of line) {
      ctx.font = fontString(token, fontSize, fontFamily);
      const tokenW = ctx.measureText(token.text).width;
      const tokenSize = fontSize * (token.s ?? 1);
      ctx.fillStyle = token.c || color;
      ctx.fillText(token.text, tx, baseY);
      if (token.u && token.kind !== "nl") {
        const underlineY = baseY + tokenSize * 0.42;
        ctx.strokeStyle = token.c || color;
        ctx.lineWidth = Math.max(1, tokenSize * 0.06);
        ctx.beginPath();
        ctx.moveTo(tx, underlineY);
        ctx.lineTo(tx + tokenW, underlineY);
        ctx.stroke();
      }
      tx += tokenW;
    }
    ty += lineHeight;
  });
}

let measureCanvas: HTMLCanvasElement | null = null;
export function measureContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  return measureCanvas.getContext("2d");
}

"use client";

import { useEffect } from "react";
import { contactScale } from "../../../src/modules/visual-builder/contact-sheet";
import { clampToZone, figureRect, formatOf, graphicBounds, placeInZone, zoneBox } from "../../../src/modules/visual-builder/layout";
import type { RenderCanvas, RenderJob, RenderLayout, RenderOutput } from "../../../src/modules/visual-builder/render-protocol";
import { badgeRect, ctaLabel, drawCanvas, stickerSize, textCtaMetrics } from "../../../src/modules/visual-builder/render";
import type { CtaPlacement, LogoPlacement, Rect } from "../../../src/modules/visual-builder/types";
import { layoutHints, type MeasuredElement } from "../../../src/modules/visual-builder/server/layout-hints";
import type { Fmt } from "../../../src/modules/visual-builder/types";

declare global {
  interface Window {
    __vbReady?: boolean;
    __vbRender?: (job: RenderJob) => Promise<RenderOutput>;
  }
}

function loadImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Ein Bild für die Vorschau konnte nicht geladen werden."));
    image.src = url;
  });
}

function union(boxes: Array<{ x: number; y: number; w: number; h: number; size: number }>) {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  const size = boxes.reduce((max, box) => Math.max(max, box.size), 0);
  return { x, y, w: right - x, h: bottom - y, size };
}

function inside(box: { x: number; y: number; w: number; h: number }, container: { x: number; y: number; w: number; h: number }) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return cx >= container.x && cx <= container.x + container.w && cy >= container.y && cy <= container.y + container.h;
}

async function paint(job: RenderJob): Promise<RenderOutput> {
  for (const font of job.fonts) {
    const face = new FontFace(font.family, `url(${font.dataUrl})`, { weight: String(font.weight), style: font.style });
    await face.load();
    document.fonts.add(face);
  }
  const results: RenderOutput["formats"] = [];
  const sheets: Array<{ label: string; canvas: HTMLCanvasElement }> = [];
  const frames: RenderCanvas[] = job.canvases?.length
    ? job.canvases
    : job.formats.map((id) => {
        const spec = formatOf(id);
        return { id, w: spec.w, h: spec.h, label: spec.label };
      });
  for (const frame of frames) {
    const format = (job.formats.find((id) => id === frame.id) ?? "1x1") as typeof job.formats[number];
    const layout = job.layouts?.[frame.id];
    const spec = { w: frame.w, h: frame.h, label: frame.label };
    const canvas = document.createElement("canvas");
    canvas.width = spec.w;
    canvas.height = spec.h;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Die Zeichenfläche steht nicht bereit.");
    const ink: Array<{ x: number; y: number; w: number; h: number; size: number }> = [];
    const original = context.fillText.bind(context);
    context.fillText = (text, x, y, maxWidth) => {
      const value = String(text);
      if (value.trim()) {
        const width = context.measureText(value).width;
        const size = Number(/(\d+(?:\.\d+)?)px/.exec(context.font)?.[1] ?? 0);
        ink.push({ x, y: y - size * 0.8, w: width, h: size, size });
      }
      return original(text as string, x, y, maxWidth);
    };
    const state = job.state;
    const bg = await loadImage(!layout && state.bgPaths[format] ? job.images[state.bgPaths[format]!] : null);
    const figure = await loadImage(layout?.figurePath ? job.images[layout.figurePath] : state.figurePaths?.[format] ? job.images[state.figurePaths[format]!] : null);
    const product = await loadImage(layout?.productPath ? job.images[layout.productPath] : null);
    const productLogo = await loadImage(layout?.productLogoPath ? job.images[layout.productLogoPath] : null);
    const energyLabel = await loadImage(layout?.energyPath ? job.images[layout.energyPath] : null);
    const logoAsset = job.logos.find((logo) => logo.id === (layout?.logoId ?? state.logoId[format])) ?? null;
    const logo = await loadImage(logoAsset?.dataUrl);
    const ctaAsset = job.ctas.find((cta) => cta.id === (layout?.ctaId ?? state.ctaId[format])) ?? null;
    const ctaImage = await loadImage(ctaAsset?.dataUrl);
    const stickerItems = state.stickers?.[format] ?? [];
    const stickers = [];
    for (const item of stickerItems) {
      const asset = job.stickers.find((sticker) => sticker.id === item.assetId);
      stickers.push({ item, image: await loadImage(asset?.dataUrl) });
    }
    drawCanvas({
      canvas,
      w: spec.w,
      h: spec.h,
      bg,
      crop: state.bgCrop[format],
      bgColor: layout?.bgColor ?? state.bgColor ?? "#000000",
      figure,
      figureBox: layout?.figure ?? state.figure?.[format],
      blocks: layout?.blocks ?? state.blocks[format],
      fontFamily: state.fontFamily,
      logo,
      logoPlacement: state.logoPlacement[format] ?? "bottom-left",
      logoPos: layout?.logoPos ?? state.logoPos[format],
      logoScale: layout?.logoScale ?? state.logoScale[format],
      cta: ctaAsset ? { ...ctaAsset, url: ctaAsset.dataUrl } : null,
      ctaText: layout?.ctaText ?? state.ctaText[format],
      ctaImg: ctaImage,
      ctaPlacement: layout ? (layout.ctaId ? "bottom-left" : "none") : state.ctaPlacement[format],
      ctaPos: layout?.ctaPos ?? state.ctaPos[format],
      ctaScale: layout?.ctaScale ?? state.ctaScale[format],
      splitAngle: layout?.splitAngle,
      product,
      productBox: layout?.productBox,
      productLogo,
      energyLabel,
      energyBox: layout?.energyBox,
      safeZone: job.safeZone,
      emptyLabel: "Motiv fehlt",
      ctaFont: state.fontFamily,
      badges: state.badges?.[format] ?? [],
      badgeFont: state.fontFamily,
      stickers,
    });
    const elements = measureElements(format, spec.w, spec.h, job, ink, context, layout, logo, ctaImage, figure);
    const hints = layoutHints(frame.id, zoneBox(job.safeZone, spec.w, spec.h), elements, `${spec.w}x${spec.h}`);
    if (product && !energyLabel) {
      hints.push({
        format: frame.id,
        pixelSize: `${spec.w}x${spec.h}`,
        elements: ["Produkt", "Energielabel"],
        kind: "missing",
        sentence: `Zum Produkt fehlt das Energielabel im ${spec.w}x${spec.h}.`,
      });
    }
    results.push({
      format: frame.id,
      pixelSize: `${spec.w}x${spec.h}`,
      width: spec.w,
      height: spec.h,
      pngBase64: canvas.toDataURL("image/png").split(",")[1] ?? "",
      hints,
    });
    sheets.push({ label: `${spec.w}×${spec.h}`, canvas });
  }
  const contact = contactSheet(sheets);
  return { formats: results, contactSheetBase64: contact.base64, contactSheetBytes: contact.bytes };
}

function measureElements(
  format: Fmt,
  width: number,
  height: number,
  job: RenderJob,
  ink: Array<{ x: number; y: number; w: number; h: number; size: number }>,
  context: CanvasRenderingContext2D,
  layout: RenderLayout | undefined,
  logoImage: HTMLImageElement | null,
  ctaImage: HTMLImageElement | null,
  figureImage: HTMLImageElement | null,
): MeasuredElement[] {
  const state = job.state;
  const shorter = Math.min(width, height);
  const elements: MeasuredElement[] = [];
  const badges = (state.badges?.[format] ?? []).map((badge) => badgeRect(badge, width, height));
  const blocks: Array<{ name: "Headline" | "Subline"; rect: { x: number; y: number; w: number; h: number }; requested: number }> = [
    { name: "Headline", rect: pctBox(state.blocks[format][0].rect, width, height), requested: (state.blocks[format][0].sizePct / 100) * height },
    { name: "Subline", rect: pctBox(state.blocks[format][1].rect, width, height), requested: (state.blocks[format][1].sizePct / 100) * height },
  ];
  for (const block of blocks) {
    const marks = ink.filter((mark) => inside(mark, block.rect) && !badges.some((badge) => inside(mark, badge)));
    const text = union(marks);
    if (!text) continue;
    elements.push({
      name: block.name,
      box: text,
      requestedSize: block.requested,
      drawnSize: text.size,
      clipped: text.size <= 6,
    });
  }
  for (const badge of state.badges?.[format] ?? []) elements.push({ name: "Störer", box: badgeRect(badge, width, height) });
  const logo = job.logos.find((item) => item.id === state.logoId[format]);
  if (logo) {
    const imageWidth = 1;
    const imageHeight = logo.variant === "wide" ? 0.4 : 1;
    const boxWidth = (state.logoScale[format] / 100) * shorter;
    const boxHeight = boxWidth / (imageWidth / imageHeight);
    elements.push({ name: "Logo", box: placedBox(state.logoPos[format], state.logoPlacement[format], boxWidth, boxHeight, job.safeZone, width, height) });
  }
  const cta = job.ctas.find((item) => item.id === state.ctaId[format]);
  if (cta && state.ctaPlacement[format] !== "none") {
    if (cta.variant === "graphic") {
      const boxWidth = (state.ctaScale[format] / 100) * shorter;
      elements.push({ name: "Button", box: placedBox(state.ctaPos[format], state.ctaPlacement[format], boxWidth, boxWidth * 0.4, job.safeZone, width, height) });
    } else {
      const ctaAsset = { ...cta, url: cta.dataUrl };
      const metrics = textCtaMetrics(context, ctaAsset, ctaLabel(ctaAsset, state.ctaText[format]), (state.ctaScale[format] / 100) * shorter, state.fontFamily);
      elements.push({ name: "Button", box: placedBox(state.ctaPos[format], state.ctaPlacement[format], metrics.width, metrics.height, job.safeZone, width, height) });
    }
  }
  if (layout?.logoId && logoImage) {
    elements.push({
      name: "Logo",
      box: graphicBounds(layout.logoScale, logoImage.width / logoImage.height, layout.logoPos ?? null, "bottom-left", job.safeZone, width, height),
    });
  }
  if (layout?.ctaId && ctaImage) {
    elements.push({
      name: "Button",
      box: graphicBounds(layout.ctaScale, ctaImage.width / ctaImage.height, layout.ctaPos ?? null, "bottom-left", job.safeZone, width, height),
    });
  }
  if (layout?.figure && figureImage) {
    elements.push({ name: "Figur", box: figureRect(layout.figure, figureImage.width / figureImage.height, width, height) });
  } else {
    const figurePath = state.figurePaths?.[format];
    if (figurePath && state.figure?.[format]) {
      elements.push({ name: "Figur", box: figureRect(state.figure[format], 0.45, width, height) });
    }
  }
  for (const sticker of state.stickers?.[format] ?? []) {
    const size = stickerSize(sticker, 1, width, height);
    const cx = (sticker.x_pct / 100) * width;
    const cy = (sticker.y_pct / 100) * height;
    elements.push({ name: "Sticker", box: { x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h } });
  }
  return elements;
}

function pctBox(rect: { x_pct: number; y_pct: number; w_pct: number; h_pct: number }, width: number, height: number) {
  return { x: (rect.x_pct / 100) * width, y: (rect.y_pct / 100) * height, w: (rect.w_pct / 100) * width, h: (rect.h_pct / 100) * height };
}

function placedBox(
  pos: { x_pct: number; y_pct: number } | null,
  placement: LogoPlacement | Exclude<CtaPlacement, "none">,
  boxWidth: number,
  boxHeight: number,
  zone: Rect,
  width: number,
  height: number,
) {
  const raw = pos
    ? { x: (pos.x_pct / 100) * width, y: (pos.y_pct / 100) * height }
    : placeInZone(placement, boxWidth, boxHeight, zone, width, height, Math.min(width, height) * 0.03);
  const clamped = clampToZone(raw.x, raw.y, boxWidth, boxHeight, zone, width, height);
  return { x: clamped.x, y: clamped.y, w: boxWidth, h: boxHeight };
}

function contactSheet(sheets: Array<{ label: string; canvas: HTMLCanvasElement }>) {
  const labelHeight = 36;
  const gap = 16;
  const rawWidth = sheets.reduce((sum, sheet) => sum + sheet.canvas.width, 0) + gap * (sheets.length + 1);
  const rawHeight = Math.max(...sheets.map((sheet) => sheet.canvas.height)) + labelHeight + gap * 2;
  const scale = contactScale(rawWidth, rawHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rawWidth * scale));
  canvas.height = Math.max(1, Math.round(rawHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Die Zeichenfläche steht nicht bereit.");
  context.fillStyle = "#f4f4f5";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#18181b";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${Math.max(12, Math.round(18 * scale))}px sans-serif`;
  let x = gap * scale;
  for (const sheet of sheets) {
    const width = sheet.canvas.width * scale;
    const height = sheet.canvas.height * scale;
    context.drawImage(sheet.canvas, x, gap * scale, width, height);
    context.fillText(sheet.label, x + width / 2, gap * scale + height + (labelHeight * scale) / 2);
    x += width + gap * scale;
  }
  let quality = 0.8;
  let url = canvas.toDataURL("image/jpeg", quality);
  while (url.length > 300_000 * 1.37 && quality > 0.4) {
    quality -= 0.1;
    url = canvas.toDataURL("image/jpeg", quality);
  }
  const base64 = url.split(",")[1] ?? "";
  return { base64, bytes: Math.floor((base64.length * 3) / 4) };
}

export function RenderStage() {
  useEffect(() => {
    window.__vbRender = paint;
    window.__vbReady = true;
  }, []);
  return <main data-render-stage="ready" />;
}

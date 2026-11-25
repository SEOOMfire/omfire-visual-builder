import { PNG } from "pngjs";

export type ImageBox = { x: number; y: number; w: number; h: number };

export type Cutout = {
  imageW: number;
  imageH: number;
  opaque: ImageBox;
  head: ImageBox;
  /** The clothing below the face is mostly orange, so orange deco disappears. */
  orangeCloth?: boolean;
};

function skin(r: number, g: number, b: number): boolean {
  return r > 95 && g > 45 && b > 30 && r > g && r > b && r - g < 90 && g - b < 70;
}

/** Opaque bounds and a head box (face plus the hair above it), in image pixels. */
export function measureCutout(bytes: Buffer): Cutout | undefined {
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return undefined;
  const png = PNG.sync.read(bytes);
  const { width, height, data } = png;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) < 24) continue;
      count += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (count < 20) return undefined;
  const opaque = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  let skinMinX = width;
  let skinMinY = height;
  let skinMaxX = 0;
  let skinMaxY = 0;
  let skinCount = 0;
  const skinBottom = minY + Math.round(opaque.h * 0.4);
  for (let y = minY; y <= skinBottom && y <= maxY; y += 2) {
    for (let x = minX; x <= maxX; x += 2) {
      const index = (y * width + x) * 4;
      if ((data[index + 3] ?? 0) < 24 || !skin(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0)) continue;
      skinCount += 1;
      if (x < skinMinX) skinMinX = x;
      if (y < skinMinY) skinMinY = y;
      if (x > skinMaxX) skinMaxX = x;
      if (y > skinMaxY) skinMaxY = y;
    }
  }
  let head: ImageBox;
  if (skinCount > 12) {
    const padX = Math.round((skinMaxX - skinMinX) * 0.15);
    const left = Math.max(minX, skinMinX - padX);
    const right = Math.min(maxX, skinMaxX + padX);
    let top = skinMinY;
    for (let y = skinMinY; y >= minY; y -= 1) {
      let hit = false;
      for (let x = left; x <= right; x += 2) {
        if ((data[(y * width + x) * 4 + 3] ?? 0) >= 24) {
          hit = true;
          break;
        }
      }
      if (!hit) break;
      top = y;
    }
    head = { x: left, y: top, w: right - left + 1, h: Math.max(8, skinMaxY - top + 1) };
    if (head.w > opaque.w * 0.5 || head.h > opaque.h * 0.32) {
      const faceW = opaque.w * 0.42;
      const center = head.x + head.w / 2;
      head = { x: center - faceW / 2, y: head.y, w: faceW, h: Math.min(head.h, opaque.h * 0.28) };
    }
  } else {
    head = { x: minX + opaque.w * 0.2, y: minY, w: opaque.w * 0.6, h: opaque.h * 0.22 };
  }
  let orange = 0;
  let cloth = 0;
  const bodyTop = Math.min(maxY, Math.round(head.y + head.h));
  for (let y = bodyTop; y <= maxY; y += 3) {
    for (let x = minX; x <= maxX; x += 3) {
      const index = (y * width + x) * 4;
      if ((data[index + 3] ?? 0) < 24) continue;
      cloth += 1;
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      if (red > 150 && red > green + 35 && red > blue + 40 && blue < 130) orange += 1;
    }
  }
  return { imageW: width, imageH: height, opaque, head, orangeCloth: cloth > 20 && orange / cloth > 0.22 };
}

function layoutAt(spec: {
  canvasW: number;
  canvasH: number;
  cutout: Cutout;
  left: number;
  pixel: number;
  y: number;
}): { figure: ImageBox; head: ImageBox } {
  const { opaque, head } = spec.cutout;
  const headLeft = head.x - opaque.x;
  const headRight = headLeft + head.w;
  let x = spec.left;
  const pastRight = x + headRight * spec.pixel - (spec.canvasW - 2);
  if (pastRight > 0) x -= pastRight;
  const pastLeft = 2 - (x + headLeft * spec.pixel);
  if (pastLeft > 0) x += pastLeft;
  return {
    figure: { x, y: spec.y, w: opaque.w * spec.pixel, h: opaque.h * spec.pixel },
    head: {
      x: x + headLeft * spec.pixel,
      y: spec.y + (head.y - opaque.y) * spec.pixel,
      w: head.w * spec.pixel,
      h: head.h * spec.pixel,
    },
  };
}

export function placeCutout(spec: {
  canvasW: number;
  canvasH: number;
  cutout: Cutout;
  left: number;
  topFraction: number;
  scale?: number;
  /** edge keeps the opaque bottom on the format edge. past runs it off the bottom. */
  pin?: "edge" | "past";
  topMin?: number;
}): { figure: ImageBox; head: ImageBox; short: boolean } {
  const { opaque, head } = spec.cutout;
  const grow = spec.scale && spec.scale > 0 ? spec.scale : 1;
  if (spec.pin === "edge") {
    const floor = spec.topMin ?? spec.topFraction;
    const start = Math.max(floor, spec.topFraction - Math.max(0, grow - 1) * 0.45);
    const candidates = [start, start + 0.03, start + 0.05, start - 0.05, floor]
      .map((value) => Math.min(0.5, Math.max(floor, value)))
      .filter((value, index, all) => all.indexOf(value) === index);
    let fallback: { figure: ImageBox; head: ImageBox } | undefined;
    for (const top of candidates) {
      const y = spec.canvasH * top;
      const pixel = (spec.canvasH - y) / Math.max(1, opaque.h);
      const placed = layoutAt({ ...spec, pixel, y });
      const fits = placed.head.x >= -1 && placed.head.x + placed.head.w <= spec.canvasW + 1;
      if (!fits) continue;
      if (placed.figure.x >= spec.left - 1) return { ...placed, short: false };
      fallback = placed;
    }
    if (fallback) return { ...fallback, short: false };
    const y = spec.canvasH * floor;
    const pixel = (spec.canvasH - y) / Math.max(1, opaque.h);
    return { ...layoutAt({ ...spec, pixel, y }), short: true };
  }
  if (spec.pin === "past") {
    const y = spec.canvasH * spec.topFraction;
    const pixel = ((spec.canvasH * 1.04 - y) / Math.max(1, opaque.h)) * grow;
    return { ...layoutAt({ ...spec, pixel, y }), short: false };
  }
  const bleed = spec.canvasH * 0.06;
  let pixel = ((spec.canvasH * (1 - spec.topFraction)) + bleed) / Math.max(1, opaque.h);
  pixel *= grow;
  const maxPixel = Math.max(0.01, (spec.canvasW - spec.left - 8) / Math.max(1, head.x - opaque.x + head.w));
  pixel = Math.min(pixel, maxPixel);
  const y = spec.canvasH * spec.topFraction;
  return { ...layoutAt({ ...spec, pixel, y }), short: false };
}

export function headInside(head: ImageBox, canvasW: number, canvasH: number): boolean {
  return head.x >= -1 && head.y >= -1 && head.x + head.w <= canvasW + 1 && head.y + head.h <= canvasH + 1 && head.w > 2 && head.h > 2;
}

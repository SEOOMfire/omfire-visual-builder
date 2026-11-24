import { PNG } from "pngjs";

export type ImageBox = { x: number; y: number; w: number; h: number };

export type Cutout = {
  imageW: number;
  imageH: number;
  opaque: ImageBox;
  head: ImageBox;
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
  const skinBottom = minY + Math.round(opaque.h * 0.55);
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
  } else {
    head = { x: minX + opaque.w * 0.2, y: minY, w: opaque.w * 0.6, h: opaque.h * 0.22 };
  }
  return { imageW: width, imageH: height, opaque, head };
}

export function placeCutout(spec: {
  canvasW: number;
  canvasH: number;
  cutout: Cutout;
  left: number;
  topFraction: number;
  scale?: number;
}): { figure: ImageBox; head: ImageBox } {
  const { opaque, head } = spec.cutout;
  const grow = spec.scale && spec.scale > 0 ? spec.scale : 1;
  const bleed = spec.canvasH * 0.06;
  let pixel = ((spec.canvasH * (1 - spec.topFraction)) + bleed) / opaque.h;
  pixel *= grow;
  const maxPixel = Math.max(0.01, (spec.canvasW - spec.left - 8) / Math.max(1, head.x - opaque.x + head.w));
  pixel = Math.min(pixel, maxPixel);
  const x = spec.left;
  const y = spec.canvasH * spec.topFraction;
  const figure = { x, y, w: opaque.w * pixel, h: opaque.h * pixel };
  const headBox = {
    x: x + (head.x - opaque.x) * pixel,
    y: y + (head.y - opaque.y) * pixel,
    w: head.w * pixel,
    h: head.h * pixel,
  };
  return { figure, head: headBox };
}

export function headInside(head: ImageBox, canvasW: number, canvasH: number): boolean {
  return head.x >= -1 && head.y >= -1 && head.x + head.w <= canvasW + 1 && head.y + head.h <= canvasH + 1 && head.w > 2 && head.h > 2;
}

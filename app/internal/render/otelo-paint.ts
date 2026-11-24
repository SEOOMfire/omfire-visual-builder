import { BLACK, LIME, ORANGE, WHITE, type OteloScene } from "../../../src/modules/visual-builder/otelo-scene";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function face(weight: number, size: number, family: string) {
  return `${weight} ${Math.max(8, size)}px "${family}", sans-serif`;
}

function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, family: string, maxWidth: number, size: number) {
  let next = size;
  ctx.font = face(weight, next, family);
  while (next > 8 && ctx.measureText(text).width > maxWidth) {
    next -= 1;
    ctx.font = face(weight, next, family);
  }
  return next;
}

function drawImageBox(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, box: { x: number; y: number; w: number; h: number } | undefined, align: "left" | "right" | "center") {
  if (!image || !box) return;
  const aspect = image.width / image.height;
  let height = box.h;
  let width = height * aspect;
  if (width > box.w) {
    width = box.w;
    height = width / aspect;
  }
  const x = align === "right" ? box.x + box.w - width : align === "center" ? box.x + (box.w - width) / 2 : box.x;
  const y = box.y + box.h - height;
  ctx.drawImage(image, x, y, width, height);
}

function drawHeadline(ctx: CanvasRenderingContext2D, scene: OteloScene) {
  const lines = scene.headline.lines.slice(0, 2);
  if (!lines.length) return;
  const gap = scene.headline.box.h * 0.08;
  const lineBox = (scene.headline.box.h - gap) / Math.max(1, lines.length);
  lines.forEach((line, index) => {
    const size = fit(ctx, line, 900, "Titillium Web", scene.headline.box.w * 0.92, lineBox / 0.9);
    ctx.font = face(900, size, "Titillium Web");
    const width = ctx.measureText(line).width;
    const x = scene.headline.box.x + index * scene.headline.step;
    const y = scene.headline.box.y + index * (size * 0.9 + gap);
    if (scene.headline.variant === "box") {
      const padX = size * 0.28;
      const padY = size * 0.16;
      roundRect(ctx, x - padX * 0.2, y, width + padX, size + padY, size * 0.22);
      ctx.fillStyle = BLACK;
      ctx.fill();
      ctx.lineWidth = Math.max(2, size * 0.045);
      ctx.strokeStyle = WHITE;
      ctx.stroke();
    }
    ctx.fillStyle = LIME;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(line, x, y + (scene.headline.variant === "box" ? size * 0.08 : 0));
  });
}

function drawSubline(ctx: CanvasRenderingContext2D, scene: OteloScene) {
  let y = scene.subline.box.y;
  for (const line of scene.subline.lines.slice(0, 3)) {
    const weight = line.bold ? 700 : 400;
    const size = fit(ctx, line.text, weight, "Geist", scene.subline.box.w, scene.subline.box.h / Math.max(1, scene.subline.lines.length) / 1.1);
    ctx.font = face(weight, size, "Geist");
    ctx.fillStyle = line.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(line.text, scene.subline.box.x, y);
    y += size * 1.1;
  }
}

function drawDiamond(ctx: CanvasRenderingContext2D, scene: OteloScene) {
  const { box, preis, zusatz } = scene.stoerer;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const s = box.w * 0.62;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  roundRect(ctx, -s / 2, -s / 2, s, s, s * 0.16);
  ctx.fillStyle = LIME;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = BLACK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = scene.stoerer.typ === "ohne_preis"
    ? ["Nur", zusatz || "im Fachhandel"].filter(Boolean)
    : ["Nur", preis || "29,99 €", zusatz || "monatlich¹"];
  const size = box.w * (lines.length > 2 ? 0.09 : 0.12);
  lines.forEach((line, index) => {
    const weight = index === 1 && scene.stoerer.typ !== "ohne_preis" ? 800 : 600;
    ctx.font = face(weight, size, "Geist");
    ctx.fillText(line, cx, cy + (index - (lines.length - 1) / 2) * size * 1.15);
  });
}

function drawProductStoerer(ctx: CanvasRenderingContext2D, scene: OteloScene) {
  const { box } = scene.stoerer;
  const h = box.h * 0.72;
  const w = h;
  roundRect(ctx, box.x, box.y, w, h, h * 0.16);
  ctx.fillStyle = LIME;
  ctx.fill();
  ctx.fillStyle = BLACK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = face(600, h * 0.16, "Geist");
  ctx.fillText("Einmalig", box.x + w / 2, box.y + h * 0.28);
  ctx.font = face(800, h * 0.34, "Geist");
  ctx.fillText(scene.stoerer.einmal || "1 €", box.x + w / 2, box.y + h * 0.62);
  const pillX = box.x + w + box.w * 0.06;
  const pillW = box.w * 0.7;
  const pillH = h * 0.72;
  const pillY = box.y + (h - pillH) / 2;
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH * 0.4);
  ctx.lineWidth = Math.max(2, h * 0.035);
  ctx.strokeStyle = WHITE;
  ctx.stroke();
  ctx.fillStyle = WHITE;
  ctx.font = face(800, pillH * 0.28, "Geist");
  ctx.fillText(`+ ${scene.stoerer.preis || "29,99 €"}`, pillX + pillW / 2, pillY + pillH * 0.38);
  ctx.font = face(500, pillH * 0.18, "Geist");
  ctx.fillText(scene.stoerer.zusatz || "monatlich¹", pillX + pillW / 2, pillY + pillH * 0.7);
}

function drawBurst(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, fill: string) {
  ctx.beginPath();
  const spikes = 16;
  for (let index = 0; index < spikes * 2; index += 1) {
    const r = index % 2 === 0 ? radius : radius * 0.82;
    const a = (index / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawBadge(ctx: CanvasRenderingContext2D, scene: OteloScene) {
  const { box, typ, aktion } = scene.stoerer;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const label = aktion || "Nur bis 1.9.’25";
  if (typ === "product") {
    drawProductStoerer(ctx, scene);
    return;
  }
  if (typ === "kreis") {
    ctx.beginPath();
    ctx.arc(cx, cy, box.w * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = LIME;
    ctx.fill();
    ctx.fillStyle = BLACK;
    ctx.font = face(700, box.w * 0.1, "Geist");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy);
    return;
  }
  if (typ === "stern") {
    drawBurst(ctx, cx, cy, box.w * 0.4, ORANGE);
    ctx.fillStyle = WHITE;
    ctx.font = face(700, box.w * 0.09, "Geist");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy);
    return;
  }
  if (typ === "bonus") {
    roundRect(ctx, box.x, box.y + box.h * 0.2, box.w * 0.7, box.h * 0.55, box.h * 0.1);
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.fillStyle = BLACK;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = face(800, box.h * 0.16, "Geist");
    ctx.fillText(label, box.x + box.w * 0.35, box.y + box.h * 0.47);
    return;
  }
  drawDiamond(ctx, scene);
}

function drawCta(ctx: CanvasRenderingContext2D, scene: OteloScene) {
  const { x, y, w, h } = scene.cta.box;
  const point = h * 0.85;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - point, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w - point, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = LIME;
  ctx.fill();
  const chevron = h * 0.34;
  ctx.fillStyle = BLACK;
  for (let index = 0; index < 3; index += 1) {
    const cx = x + h * 0.28 + index * chevron * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx, y + h * 0.28);
    ctx.lineTo(cx + chevron * 0.42, y + h / 2);
    ctx.lineTo(cx, y + h * 0.72);
    ctx.lineTo(cx + chevron * 0.16, y + h / 2);
    ctx.closePath();
    ctx.fill();
  }
  const raw = scene.cta.text.replace(/\*\*/g, "");
  const parts = scene.cta.text.split("**");
  let cursor = x + h * 1.15;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = BLACK;
  const size = fit(ctx, raw, 700, "Geist", w - h * 1.5, h * 0.42);
  parts.forEach((part, index) => {
    if (!part) return;
    ctx.font = face(index % 2 === 1 ? 700 : 400, size, "Geist");
    ctx.fillText(part, cursor, y + h / 2);
    cursor += ctx.measureText(part).width;
  });
}

function opaqueOverlap(image: HTMLImageElement, figure: { x: number; y: number; w: number; h: number }, texts: Array<{ x: number; y: number; w: number; h: number }>): boolean {
  const sample = document.createElement("canvas");
  sample.width = 24;
  sample.height = 24;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(image, 0, 0, 24, 24);
  const pixels = context.getImageData(0, 0, 24, 24).data;
  for (const text of texts) {
    for (let row = 1; row <= 2; row += 1) {
      for (let col = 1; col <= 2; col += 1) {
        const x = text.x + (text.w * col) / 3;
        const y = text.y + (text.h * row) / 3;
        if (x < figure.x || x > figure.x + figure.w || y < figure.y || y > figure.y + figure.h) continue;
        const px = Math.min(23, Math.max(0, Math.floor(((x - figure.x) / figure.w) * 24)));
        const py = Math.min(23, Math.max(0, Math.floor(((y - figure.y) / figure.h) * 24)));
        if (pixels[(py * 24 + px) * 4 + 3] > 40) return true;
      }
    }
  }
  return false;
}

function paintedOrangeShare(ctx: CanvasRenderingContext2D, width: number, height: number): number {
  const step = Math.max(4, Math.round(Math.min(width, height) / 48));
  const data = ctx.getImageData(0, 0, width, height).data;
  let seen = 0;
  let orange = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      seen += 1;
      if (data[index] > 220 && data[index + 1] < 130 && data[index + 2] < 60) orange += 1;
    }
  }
  return seen ? orange / seen : 0;
}

export function drawOtelo(ctx: CanvasRenderingContext2D, scene: OteloScene, images: Record<string, HTMLImageElement | null>): string[] {
  const hints: string[] = [];
  const geist = document.fonts.check('700 32px "Geist"');
  const title = document.fonts.check('900 40px "Titillium Web"');
  if (!geist || !title) hints.push(`Eine Ersatzschrift wurde verwendet im ${scene.width}x${scene.height}.`);
  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, scene.width, scene.height);
  if (scene.orange.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(scene.orange[0][0], scene.orange[0][1]);
    for (const point of scene.orange.slice(1)) ctx.lineTo(point[0], point[1]);
    ctx.closePath();
    ctx.fillStyle = ORANGE;
    ctx.fill();
    const share = paintedOrangeShare(ctx, scene.width, scene.height);
    if (share > 0.5) hints.push(`Der Orange-Anteil ist ${Math.round(share * 100)} Prozent im ${scene.width}x${scene.height}. Erlaubt sind etwa ein Drittel, höchstens die Hälfte.`);
  }
  drawImageBox(ctx, scene.productKey ? images[scene.productKey] : null, scene.product, "center");
  const figureImage = scene.figureKey ? images[scene.figureKey] : null;
  if (figureImage && scene.figure && scene.figureFlip) {
    const box = scene.figure;
    ctx.save();
    ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
    ctx.scale(-1, 1);
    ctx.drawImage(figureImage, -box.w / 2, -box.h / 2, box.w, box.h);
    ctx.restore();
  } else {
    drawImageBox(ctx, figureImage, scene.figure, scene.orangeSide === "rechts" ? "right" : "left");
  }
  if (figureImage && scene.figure && opaqueOverlap(figureImage, scene.figure, [scene.headline.box, scene.subline.box])) {
    hints.push(`Text überlappt deckende Pixel der Figur im ${scene.width}x${scene.height}.`);
  }
  drawHeadline(ctx, scene);
  drawSubline(ctx, scene);
  drawBadge(ctx, scene);
  drawCta(ctx, scene);
  drawImageBox(ctx, scene.energyKey ? images[scene.energyKey] : null, scene.energy, "center");
  if (scene.productName?.text) {
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = face(400, Math.max(10, scene.productName.box.h * 0.7), "Geist");
    ctx.fillText(scene.productName.text, scene.productName.box.x, scene.productName.box.y);
  }
  drawImageBox(ctx, scene.logoKey ? images[scene.logoKey] : null, scene.logo.box, "left");
  if (scene.pflichttext) {
    ctx.fillStyle = WHITE;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const size = Math.max(8, scene.pflichttext.box.h);
    ctx.font = face(400, size, "Geist");
    ctx.fillText(scene.pflichttext.text, scene.pflichttext.box.x, scene.pflichttext.box.y, scene.pflichttext.box.w);
  }
  return hints;
}

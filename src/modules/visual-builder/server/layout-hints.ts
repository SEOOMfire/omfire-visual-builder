import { formatOf } from "../layout";
import type { Fmt } from "../types";

export type Box = { x: number; y: number; w: number; h: number };

export type HintElement = "Headline" | "Subline" | "Störer" | "Logo" | "Button" | "Sticker" | "Figur";

export type LayoutHint = {
  format: Fmt;
  pixelSize: string;
  elements: HintElement[];
  kind: "overlap" | "safe-zone" | "shrunk" | "clipped";
  sentence: string;
};

export type MeasuredElement = {
  name: HintElement;
  box: Box;
  /** Requested font size in pixels, only for text. */
  requestedSize?: number;
  /** Size actually painted, only for text. */
  drawnSize?: number;
  clipped?: boolean;
};

const SHRINK_RATIO = 0.75;

export function formatPixelSize(format: Fmt): string {
  const spec = formatOf(format);
  return `${spec.w}x${spec.h}`;
}

export function boxesOverlap(left: Box, right: Box): boolean {
  const width = Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x);
  const height = Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y);
  return width > 2 && height > 2;
}

export function outsideZone(box: Box, zone: Box): boolean {
  return box.x < zone.x - 1 || box.y < zone.y - 1 || box.x + box.w > zone.x + zone.w + 1 || box.y + box.h > zone.y + zone.h + 1;
}

function pairKey(left: HintElement, right: HintElement): string {
  return [left, right].sort().join("|");
}

/** Figure and stickers may overlap. Every other pair is a hint. */
function overlapAllowed(left: HintElement, right: HintElement): boolean {
  const key = pairKey(left, right);
  return key === "Figur|Sticker";
}

export function layoutHints(format: Fmt, zone: Box, elements: readonly MeasuredElement[]): LayoutHint[] {
  const pixelSize = formatPixelSize(format);
  const hints: LayoutHint[] = [];
  const seen = new Set<string>();
  const push = (hint: LayoutHint) => {
    const key = `${hint.kind}|${hint.elements.join("|")}|${hint.sentence}`;
    if (seen.has(key)) return;
    seen.add(key);
    hints.push(hint);
  };

  for (const element of elements) {
    if (element.name === "Figur") continue;
    if (outsideZone(element.box, zone)) {
      push({
        format,
        pixelSize,
        elements: [element.name],
        kind: "safe-zone",
        sentence: `${element.name} liegt außerhalb der sicheren Zone im ${pixelSize}.`,
      });
    }
    if (element.clipped) {
      push({
        format,
        pixelSize,
        elements: [element.name],
        kind: "clipped",
        sentence: `${element.name} ist abgeschnitten im ${pixelSize}.`,
      });
    }
    if (
      element.requestedSize &&
      element.drawnSize &&
      element.drawnSize < element.requestedSize * SHRINK_RATIO
    ) {
      push({
        format,
        pixelSize,
        elements: [element.name],
        kind: "shrunk",
        sentence: `${element.name} wurde stark verkleinert im ${pixelSize}.`,
      });
    }
  }

  for (let i = 0; i < elements.length; i += 1) {
    for (let j = i + 1; j < elements.length; j += 1) {
      const left = elements[i];
      const right = elements[j];
      if (overlapAllowed(left.name, right.name)) continue;
      if (!boxesOverlap(left.box, right.box)) continue;
      const [first, second] = [left.name, right.name].sort((a, b) => a.localeCompare(b, "de"));
      push({
        format,
        pixelSize,
        elements: [first as HintElement, second as HintElement],
        kind: "overlap",
        sentence: `${left.name} überlappt ${right.name} im ${pixelSize}.`,
      });
    }
  }
  return hints;
}

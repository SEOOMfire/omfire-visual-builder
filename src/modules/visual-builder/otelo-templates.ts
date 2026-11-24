import type { RenderLayout } from "./render-protocol";
import type { TextBlock } from "./types";

function block(html: string, x: number, y: number, w: number, h: number, sizePct: number, color: string): TextBlock {
  return { html, rect: { x_pct: x, y_pct: y, w_pct: w, h_pct: h }, align: "left", color, sizePct, lineHeight: 0.95 };
}

const logo = { logoId: "wortmarke-weiss", logoScale: 18 };
const price = (lines: string): TextBlock => block(lines, 6, 8, 48, 28, 8, "#000000");

export function templateLayout(name: string, headline: string, subline: string, withProduct: boolean): RenderLayout {
  const young = name === "young";
  const blocks: [TextBlock, TextBlock] = young
    ? [block(headline || "BLACK WEEK", 6, 5, 70, 12, 7.5, "#D7EB00"), block(subline || "Gleicher Preis.", 6, 17, 70, 6, 3.2, "#FA5A14")]
    : [block("", 0, 0, 1, 1, 1, "#000000"), block("", 0, 0, 1, 1, 1, "#000000")];
  return {
    blocks,
    bgColor: "#000000",
    figurePath: withProduct ? null : "figur.png",
    figure: { x_pct: 78, bottom_pct: 100, h_pct: young ? 78 : 62, flip: false },
    ...logo,
    ctaId: young ? "cta" : null,
    ctaText: "Jetzt sichern",
    ctaScale: 42,
    productPath: withProduct ? "produkt.png" : null,
    productBox: { x_pct: 72, bottom_pct: 98, h_pct: 46, flip: false },
    energyPath: withProduct ? "energie-a.svg" : null,
  };
}

export const TEMPLATE_NAMES = ["young", "standard", "hardware"] as const;

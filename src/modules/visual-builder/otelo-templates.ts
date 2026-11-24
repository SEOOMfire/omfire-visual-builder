import type { RenderLayout } from "./render-protocol";
import type { TextBlock } from "./types";

function block(html: string, x: number, y: number, w: number, h: number, sizePct: number, color: string): TextBlock {
  return { html, rect: { x_pct: x, y_pct: y, w_pct: w, h_pct: h }, align: "left", color, sizePct, lineHeight: 0.95 };
}

const logo = { logoId: "wortmarke-weiss", logoScale: 26, logoPos: { x_pct: 6, y_pct: 74 } };

/** 32° sits in both ranges: landscape 25–45 and portrait 11–45. */
export const OTELO_SPLIT_ANGLE = 32;

export function templateLayout(name: string, headline: string, subline: string, withProduct: boolean): RenderLayout {
  const young = name === "young";
  const blocks: [TextBlock, TextBlock] = young
    ? [block(headline || "BLACK WEEK", 6, 5, 62, 12, 7.5, "#D7EB00"), block(subline || "Gleicher Preis.", 6, 17, 62, 6, 3.2, "#FA5A14")]
    : [block("", 0, 0, 1, 1, 1, "#000000"), block("", 0, 0, 1, 1, 1, "#000000")];
  return {
    blocks,
    bgColor: "#000000",
    splitAngle: OTELO_SPLIT_ANGLE,
    figurePath: withProduct ? null : "figur.png",
    figure: { x_pct: 78, bottom_pct: young ? 72 : 70, h_pct: young ? 64 : 58, flip: false },
    ...logo,
    ctaId: young ? "cta" : null,
    ctaText: "Jetzt sichern",
    ctaScale: young ? 90 : 42,
    ctaPos: young ? { x_pct: 5, y_pct: 84 } : null,
    productPath: withProduct ? "produkt.png" : null,
    productBox: { x_pct: 72, bottom_pct: 70, h_pct: 46, flip: false },
    energyPath: withProduct ? "energie-a.svg" : null,
    energyBox: withProduct ? { x_pct: 6, y_pct: 62, h_pct: 8 } : undefined,
  };
}

export const TEMPLATE_NAMES = ["young", "standard", "hardware"] as const;

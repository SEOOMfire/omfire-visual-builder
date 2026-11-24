import type { CreativeState, CtaStyle, FigureBox, Fmt, Rect, TextBlock } from "./types";

export type RenderFont = {
  family: string;
  weight: number;
  style: "normal" | "italic";
  dataUrl: string;
};

export type RenderLogo = { id: string; name: string; variant: "square" | "wide"; dataUrl: string };
export type RenderCta = {
  id: string;
  name: string;
  variant: "text" | "graphic";
  text: string | null;
  style: CtaStyle;
  dataUrl: string | null;
};
export type RenderSticker = { id: string; name: string; dataUrl: string };

export type RenderCanvas = { id: string; w: number; h: number; label: string };

/** Explicit layout for one canvas. Used for customer formats beyond the original three. */
export type RenderLayout = {
  blocks: [TextBlock, TextBlock];
  bgColor?: string | null;
  figurePath?: string | null;
  figure?: FigureBox;
  logoId?: string | null;
  logoScale: number;
  ctaId?: string | null;
  ctaText?: string;
  ctaScale: number;
  productPath?: string | null;
  productBox?: FigureBox;
  productLogoPath?: string | null;
  energyPath?: string | null;
};

/** Everything the browser needs to paint. Images are data URLs, paths are the keys of `images`. */
export type RenderJob = {
  formats: Fmt[];
  canvases?: RenderCanvas[];
  layouts?: Record<string, RenderLayout>;
  state: CreativeState;
  images: Record<string, string>;
  fonts: RenderFont[];
  logos: RenderLogo[];
  ctas: RenderCta[];
  stickers: RenderSticker[];
  safeZone: Rect;
};

export type RenderFormatResult = {
  format: string;
  pixelSize: string;
  width: number;
  height: number;
  pngBase64: string;
  hints: Array<{
    format: string;
    pixelSize: string;
    elements: string[];
    kind: string;
    sentence: string;
  }>;
};

export type RenderOutput = {
  formats: RenderFormatResult[];
  contactSheetBase64: string;
  contactSheetBytes: number;
};

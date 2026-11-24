import type { CreativeState, CtaStyle, Fmt, Rect } from "./types";

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

/** Everything the browser needs to paint. Images are data URLs, paths are the keys of `images`. */
export type RenderJob = {
  formats: Fmt[];
  state: CreativeState;
  images: Record<string, string>;
  fonts: RenderFont[];
  logos: RenderLogo[];
  ctas: RenderCta[];
  stickers: RenderSticker[];
  safeZone: Rect;
};

export type RenderFormatResult = {
  format: Fmt;
  pixelSize: string;
  width: number;
  height: number;
  pngBase64: string;
  hints: Array<{
    format: Fmt;
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

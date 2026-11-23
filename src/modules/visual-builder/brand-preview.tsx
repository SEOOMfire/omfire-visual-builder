"use client";

import { useEffect, useRef, useState } from "react";
import { badgeHeight } from "./brand";
import { blockDefaults } from "./layout";
import { drawCanvas, measureContext, textCtaMetrics, ctaLabel } from "./render";
import type { BadgeItem, CtaAsset, FontAsset, Rect } from "./types";

const FULL: Rect = { x_pct: 0, y_pct: 0, w_pct: 100, h_pct: 100 };
const PREVIEW_BG = "#3a3a3a";

/** Registers the tenant fonts once per page; the counter changes when they are ready to draw. */
export function useTenantFonts(fonts: readonly FontAsset[]): number {
  const [ready, setReady] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(fonts.map(async (font) => {
      const key = `${font.family}|${font.weight}|${font.style}|${font.id}`;
      if ([...document.fonts].some((face) => (face as FontFace & { vbKey?: string }).vbKey === key)) return;
      const face = new FontFace(font.family, `url(${font.url})`, { weight: String(font.weight), style: font.style }) as FontFace & { vbKey?: string };
      face.vbKey = key;
      try {
        await face.load();
        document.fonts.add(face);
      } catch {
        /* A broken font file falls back to the next family. */
      }
    })).then(() => { if (!cancelled) setReady((value) => value + 1); });
    return () => { cancelled = true; };
  }, [fonts]);
  return ready;
}

function emptyBlocks() {
  const block = { ...blockDefaults(FULL, 0), html: "" };
  return [block, block] as const;
}

/** A text button drawn exactly like in the editor. */
export function CtaPreview({ cta, font, fontsReady, height = 30 }: { cta: CtaAsset; font: string; fontsReady: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = measureContext();
    if (!canvas || !context) return;
    const scale = 2;
    const targetW = height * scale;
    const metrics = textCtaMetrics(context, cta, ctaLabel(cta, undefined), targetW, font);
    const pad = 6 * scale;
    const w = Math.ceil(metrics.width + pad * 2);
    const h = Math.ceil(metrics.height + pad * 2);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w / scale}px`;
    canvas.style.height = `${h / scale}px`;
    drawCanvas({
      canvas, w, h, bg: null, bgColor: PREVIEW_BG, blocks: emptyBlocks(), fontFamily: font,
      logo: null, logoPlacement: "top-left", logoScale: 0,
      cta, ctaImg: null, ctaPlacement: "top-left", ctaPos: { x_pct: (pad / w) * 100, y_pct: (pad / h) * 100 },
      ctaScale: (targetW / Math.min(w, h)) * 100, safeZone: FULL, emptyLabel: "", ctaFont: font,
    });
  }, [cta, font, fontsReady, height]);
  return <canvas ref={ref} className="vb-canvas-preview" aria-hidden="true" />;
}

/** A badge drawn exactly like in the editor. */
export function BadgePreview({ badge, font, fontsReady, width = 120 }: { badge: Omit<BadgeItem, "uid" | "pos" | "scale">; font: string; fontsReady: number; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const scale = 2;
    const pad = 6 * scale;
    const bw = width * scale;
    const w = bw + pad * 2;
    const h = Math.ceil(badgeHeight(badge.shape, badge.lines, bw) + pad * 2);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w / scale}px`;
    canvas.style.height = `${h / scale}px`;
    const item: BadgeItem = { ...badge, uid: "preview", pos: { x_pct: (pad / w) * 100, y_pct: (pad / h) * 100 }, scale: (bw / Math.min(w, h)) * 100 };
    drawCanvas({
      canvas, w, h, bg: null, bgColor: PREVIEW_BG, blocks: emptyBlocks(), fontFamily: font,
      logo: null, logoPlacement: "top-left", logoScale: 0,
      cta: null, ctaImg: null, ctaPlacement: "none", ctaScale: 0, safeZone: FULL, emptyLabel: "", ctaFont: font,
      badges: [item], badgeFont: font,
    });
  }, [badge, font, fontsReady, width]);
  return <canvas ref={ref} className="vb-canvas-preview" aria-hidden="true" />;
}

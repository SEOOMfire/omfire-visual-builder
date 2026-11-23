"use client";

import { clamp } from "./layout";
import { useI18n } from "./i18n";
import type { FigureBox, Rect } from "./types";

type Corner = "nw" | "ne" | "sw" | "se";
export type OverlayKind = "text" | "logo" | "cta" | "badge" | "sticker" | "figure";

/** Movable text frames, logo, button and badges on top of a canvas, all kept inside the safe zone. */
export function TextBoxOverlay({
  safeZone,
  rects,
  onChange,
  logoRect,
  onLogoMove,
  ctaRect,
  onCtaMove,
  badges = [],
  onBadgeMove,
  stickers = [],
  onStickerChange,
  figure,
  figureWidthFactor = 1,
  onFigureChange,
  onPick,
}: {
  safeZone: Rect;
  rects: readonly [Rect, Rect];
  onChange: (index: 0 | 1, rect: Rect) => void;
  logoRect?: Rect | null;
  onLogoMove?: (x_pct: number, y_pct: number) => void;
  ctaRect?: Rect | null;
  onCtaMove?: (x_pct: number, y_pct: number) => void;
  badges?: ReadonlyArray<{ uid: string; rect: Rect }>;
  onBadgeMove?: (uid: string, x_pct: number, y_pct: number) => void;
  /** Sticker frames: centre and size in % of the canvas, rotation in degrees; `scale` is the stored size value. */
  stickers?: ReadonlyArray<{ uid: string; cx: number; cy: number; w: number; h: number; rotate: number; scale: number }>;
  onStickerChange?: (uid: string, patch: { x_pct?: number; y_pct?: number; scale?: number; rotate?: number }) => void;
  figure?: FigureBox | null;
  /** Figure width in % of the canvas width per 1 % of canvas height. */
  figureWidthFactor?: number;
  onFigureChange?: (box: FigureBox) => void;
  /** Called when an element is grabbed, so the editor can open its controls. */
  onPick?: (kind: OverlayKind) => void;
}) {
  const { t } = useI18n();

  const track = (event: React.PointerEvent, onMove: (dxPct: number, dyPct: number) => void) => {
    event.preventDefault();
    event.stopPropagation();
    const wrap = (event.currentTarget as HTMLElement).closest(".vb-overlay");
    if (!wrap) return;
    const bounds = wrap.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    const move = (next: PointerEvent) => onMove(((next.clientX - startX) / bounds.width) * 100, ((next.clientY - startY) / bounds.height) * 100);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const dragPoint = (rect: Rect | null | undefined, callback?: (x: number, y: number) => void) => (event: React.PointerEvent) => {
    if (!rect || !callback) return;
    const start = { ...rect };
    track(event, (dx, dy) => callback(
      clamp(start.x_pct + dx, safeZone.x_pct, Math.max(safeZone.x_pct, safeZone.x_pct + safeZone.w_pct - start.w_pct)),
      clamp(start.y_pct + dy, safeZone.y_pct, Math.max(safeZone.y_pct, safeZone.y_pct + safeZone.h_pct - start.h_pct)),
    ));
  };

  const dragBox = (index: 0 | 1, mode: "move" | Corner) => (event: React.PointerEvent) => {
    const start = { ...rects[index] };
    const minX = safeZone.x_pct;
    const minY = safeZone.y_pct;
    const maxX = safeZone.x_pct + safeZone.w_pct;
    const maxY = safeZone.y_pct + safeZone.h_pct;
    track(event, (dx, dy) => {
      let { x_pct, y_pct, w_pct, h_pct } = start;
      if (mode === "move") {
        x_pct = clamp(start.x_pct + dx, minX, Math.max(minX, maxX - start.w_pct));
        y_pct = clamp(start.y_pct + dy, minY, Math.max(minY, maxY - start.h_pct));
      } else {
        if (mode.includes("e")) w_pct = clamp(start.w_pct + dx, 5, Math.max(5, maxX - start.x_pct));
        if (mode.includes("s")) h_pct = clamp(start.h_pct + dy, 5, Math.max(5, maxY - start.y_pct));
        if (mode.includes("w")) {
          const nx = clamp(start.x_pct + dx, minX, start.x_pct + start.w_pct - 5);
          w_pct = start.w_pct + (start.x_pct - nx);
          x_pct = nx;
        }
        if (mode.includes("n")) {
          const ny = clamp(start.y_pct + dy, minY, start.y_pct + start.h_pct - 5);
          h_pct = start.h_pct + (start.y_pct - ny);
          y_pct = ny;
        }
      }
      onChange(index, { x_pct, y_pct, w_pct, h_pct });
    });
  };

  /** Moving keeps the size; the top handles scale with the bottom edge as anchor, so the figure keeps standing. */
  const dragFigure = (mode: "move" | "scale") => (event: React.PointerEvent) => {
    if (!figure || !onFigureChange) return;
    const start = { ...figure };
    track(event, (dx, dy) => onFigureChange(mode === "move"
      ? { ...start, x_pct: clamp(start.x_pct + dx, -50, 150), bottom_pct: clamp(start.bottom_pct + dy, 10, 200) }
      : { ...start, h_pct: clamp(start.h_pct - dy, 5, 250) }));
  };

  /** Rotation knob: the angle between the centre of the frame and the pointer, snapping to upright. */
  const dragRotate = (onRotate: (degrees: number) => void) => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const frame = (event.currentTarget as HTMLElement).parentElement;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    const cx = bounds.left + bounds.width / 2;
    const cy = bounds.top + bounds.height / 2;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    const move = (next: PointerEvent) => {
      let degrees = (Math.atan2(next.clientY - cy, next.clientX - cx) * 180) / Math.PI + 90;
      if (degrees > 180) degrees -= 360;
      if (Math.abs(degrees) < 3) degrees = 0;
      onRotate(Math.round(degrees));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** Corner handle: size follows the distance of the pointer from the centre. */
  const dragScale = (start: number, onScale: (scale: number) => void) => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const frame = (event.currentTarget as HTMLElement).parentElement;
    if (!frame) return;
    const bounds = frame.getBoundingClientRect();
    const cx = bounds.left + bounds.width / 2;
    const cy = bounds.top + bounds.height / 2;
    const startDistance = Math.max(4, Math.hypot(event.clientX - cx, event.clientY - cy));
    (event.target as Element).setPointerCapture?.(event.pointerId);
    const move = (next: PointerEvent) => onScale(clamp(start * (Math.hypot(next.clientX - cx, next.clientY - cy) / startDistance), 3, 300));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const dragSticker = (sticker: { uid: string; cx: number; cy: number }) => (event: React.PointerEvent) => {
    if (!onStickerChange) return;
    const start = { ...sticker };
    track(event, (dx, dy) => onStickerChange(sticker.uid, { x_pct: clamp(start.cx + dx, -50, 150), y_pct: clamp(start.cy + dy, -50, 150) }));
  };

  const box = (rect: Rect) => ({ left: `${rect.x_pct}%`, top: `${rect.y_pct}%`, width: `${rect.w_pct}%`, height: `${rect.h_pct}%` });
  const figureBox = figure ? (() => {
    const w = figure.h_pct * figureWidthFactor;
    return box({ x_pct: figure.x_pct - w / 2, y_pct: figure.bottom_pct - figure.h_pct, w_pct: w, h_pct: figure.h_pct });
  })() : null;

  return (
    <div className="vb-overlay" onPointerDownCapture={(event) => {
      const kind = (event.target as HTMLElement).closest<HTMLElement>("[data-kind]")?.dataset.kind;
      if (kind) onPick?.(kind as OverlayKind);
    }}>
      <div className="vb-overlay-zone" style={box(safeZone)} />
      {figureBox && (
        <div onPointerDown={dragFigure("move")} data-kind="figure" title={t("Freisteller verschieben", "Move cut-out")} className="vb-overlay-box vb-overlay-figure"
          style={{ ...figureBox, transform: figure?.rotate ? `rotate(${figure.rotate}deg)` : undefined }}>
          <span className="vb-overlay-tag">{t("Freisteller", "Cut-out")}</span>
          {onFigureChange && figure && (
            <div onPointerDown={dragRotate((rotate) => onFigureChange({ ...figure, rotate }))} title={t("Drehen", "Rotate")} className="vb-overlay-rotate" />
          )}
          {(["nw", "ne"] as const).map((corner) => (
            <div key={corner} onPointerDown={dragFigure("scale")} title={t("Größe ändern", "Resize")} className={`vb-overlay-handle is-${corner}`} />
          ))}
        </div>
      )}
      {([0, 1] as const).map((index) => (
        <div key={index} data-kind="text" onPointerDown={dragBox(index, "move")} className={`vb-overlay-box vb-overlay-text-${index + 1}`} style={box(rects[index])}>
          <span className="vb-overlay-tag">{index + 1}</span>
          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <div key={corner} onPointerDown={dragBox(index, corner)} className={`vb-overlay-handle is-${corner}`} />
          ))}
        </div>
      ))}
      {logoRect && (
        <div onPointerDown={dragPoint(logoRect, onLogoMove)} data-kind="logo" title={t("Logo verschieben", "Move logo")} className="vb-overlay-box vb-overlay-logo" style={box(logoRect)}>
          <span className="vb-overlay-tag">Logo</span>
        </div>
      )}
      {ctaRect && (
        <div onPointerDown={dragPoint(ctaRect, onCtaMove)} data-kind="cta" title={t("Button verschieben", "Move button")} className="vb-overlay-box vb-overlay-cta" style={box(ctaRect)}>
          <span className="vb-overlay-tag">CTA</span>
        </div>
      )}
      {stickers.map((sticker) => (
        <div key={sticker.uid} onPointerDown={dragSticker(sticker)} data-kind="sticker" title={t("Grafik verschieben", "Move graphic")} className="vb-overlay-box vb-overlay-sticker"
          style={{ left: `${sticker.cx - sticker.w / 2}%`, top: `${sticker.cy - sticker.h / 2}%`, width: `${sticker.w}%`, height: `${sticker.h}%`, transform: sticker.rotate ? `rotate(${sticker.rotate}deg)` : undefined }}>
          <span className="vb-overlay-tag">{t("Grafik", "Graphic")}</span>
          {onStickerChange && (
            <>
              <div onPointerDown={dragRotate((rotate) => onStickerChange(sticker.uid, { rotate }))} title={t("Drehen", "Rotate")} className="vb-overlay-rotate" />
              <div onPointerDown={dragScale(sticker.scale, (scale) => onStickerChange(sticker.uid, { scale: Math.round(scale) }))} title={t("Größe ändern", "Resize")} className="vb-overlay-handle is-se" />
            </>
          )}
        </div>
      ))}
      {badges.map(({ uid, rect }) => (
        <div key={uid} onPointerDown={dragPoint(rect, onBadgeMove && ((x, y) => onBadgeMove(uid, x, y)))} data-kind="badge" title={t("Störer verschieben", "Move badge")} className="vb-overlay-box vb-overlay-badge" style={box(rect)}>
          <span className="vb-overlay-tag">{t("Störer", "Badge")}</span>
        </div>
      ))}
    </div>
  );
}

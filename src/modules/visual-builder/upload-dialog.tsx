"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Upload, X } from "lucide-react";
import { Modal } from "../../../design-system/components/Modal";
import { useFeedback } from "../../components/Feedback";
import { loadImage, postForm } from "./client";
import { detectCutout, shrinkForUpload } from "./cutout";
import { FORMATS } from "./layout";
import { useI18n } from "./i18n";
import type { Fmt } from "./types";

type Box = { x: number; y: number; w: number; h: number };

const FILE_SUFFIX: Record<Fmt, string> = { "1x1": "1x1", "191x1": "1.91x1", "1x191": "1x1.91" };

function initialBox(width: number, height: number, ratio: number): Box {
  let w = width;
  let h = w / ratio;
  if (h > height) {
    h = height;
    w = h * ratio;
  }
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

function clampBox(box: Box, width: number, height: number): Box {
  const w = Math.min(box.w, width);
  const h = Math.min(box.h, height);
  return { w, h, x: Math.max(0, Math.min(box.x, width - w)), y: Math.max(0, Math.min(box.y, height - h)) };
}

function CropPane({ format, libraryId, onUploaded }: { format: (typeof FORMATS)[number]; libraryId: string; onUploaded: (name: string) => void }) {
  const { t } = useI18n();
  const { notify } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<Box | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayWidth, setDisplayWidth] = useState(0);
  const [cutout, setCutout] = useState(false);

  const pick = useCallback(async (picked: File | null | undefined) => {
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      notify({ tone: "danger", title: t("Bitte eine Bilddatei wählen", "Please choose an image file") });
      return;
    }
    const url = URL.createObjectURL(picked);
    const image = await loadImage(url);
    setFile(picked);
    setSrc(url);
    setNatural({ w: image.naturalWidth, h: image.naturalHeight });
    const isCutout = detectCutout(image);
    setCutout(isCutout);
    setCrop(isCutout ? null : initialBox(image.naturalWidth, image.naturalHeight, format.ratio));
  }, [format.ratio, notify, t]);

  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setDisplayWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [src]);

  const scale = natural && displayWidth ? displayWidth / natural.w : 1;

  const startDrag = (mode: "move" | "resize") => (event: React.PointerEvent) => {
    if (!crop || !natural) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...crop };
    const move = (next: PointerEvent) => {
      const dx = (next.clientX - startX) / scale;
      const dy = (next.clientY - startY) / scale;
      if (mode === "move") {
        setCrop(clampBox({ ...start, x: start.x + dx, y: start.y + dy }, natural.w, natural.h));
        return;
      }
      let w = Math.max(40, start.w + dx);
      let h = w / format.ratio;
      if (start.x + w > natural.w) {
        w = natural.w - start.x;
        h = w / format.ratio;
      }
      if (start.y + h > natural.h) {
        h = natural.h - start.y;
        w = h * format.ratio;
      }
      setCrop({ ...start, w, h });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const reset = () => {
    if (src) URL.revokeObjectURL(src);
    setFile(null);
    setSrc(null);
    setNatural(null);
    setCrop(null);
    setCutout(false);
  };

  /** Cut-outs work in every format, so they are stored whole and keep their transparency. */
  const uploadCutout = async () => {
    if (!file || !src) return;
    setBusy(true);
    try {
      const prepared = await shrinkForUpload(file, await loadImage(src), true);
      const name = `${file.name.replace(/\.[^.]+$/, "")}_freisteller.png`;
      const form = new FormData();
      form.set("library", libraryId);
      form.set("name", name);
      form.set("file", new File([prepared], name, { type: prepared.type }));
      await postForm("/api/visual-builder/drive", form);
      onUploaded(name);
      notify({ tone: "success", title: t("Freisteller hochgeladen", "Cut-out uploaded") });
      reset();
    } catch (error) {
      notify({ tone: "danger", title: t("Upload fehlgeschlagen", "Upload failed"), message: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const upload = async () => {
    if (!file || !src || !crop) return;
    setBusy(true);
    try {
      const image = await loadImage(src);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(crop.w);
      canvas.height = Math.round(crop.h);
      const context = canvas.getContext("2d");
      if (!context) throw new Error(t("Der Browser kann das Bild nicht zuschneiden.", "The browser cannot crop this image."));
      context.drawImage(image, Math.round(crop.x), Math.round(crop.y), Math.round(crop.w), Math.round(crop.h), 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) throw new Error(t("Das Bild konnte nicht erstellt werden.", "The image could not be created."));
      const name = `${file.name.replace(/\.[^.]+$/, "")}_${FILE_SUFFIX[format.id]}.jpg`;
      const form = new FormData();
      form.set("library", libraryId);
      form.set("name", name);
      form.set("file", new File([blob], name, { type: "image/jpeg" }));
      await postForm("/api/visual-builder/drive", form);
      onUploaded(name);
      notify({ tone: "success", title: t(`${format.label} hochgeladen`, `${format.label} uploaded`) });
      reset();
    } catch (error) {
      notify({ tone: "danger", title: t("Upload fehlgeschlagen", "Upload failed"), message: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vb-crop-pane">
      <div className="vb-crop-pane-head">
        <strong>{t("Format", "Format")} {format.label}</strong>
        {src && <button type="button" className="vb-tool" onClick={reset} aria-label={t("Zurücksetzen", "Reset")}><X size={14} /></button>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void pick(event.target.files?.[0])} />
      {!src ? (
        <button
          type="button"
          className={`vb-dropzone${dragOver ? " is-over" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => { event.preventDefault(); setDragOver(false); void pick(event.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={18} aria-hidden="true" />
          <span>{t("Bild ziehen oder klicken (beliebiges Seitenverhältnis)", "Drop or click an image (any aspect ratio)")}</span>
        </button>
      ) : (
        <>
          <div ref={boxRef} className="vb-crop-stage">
            {/* eslint-disable-next-line @next/next/no-img-element -- Local object URL preview. */}
            <img src={src} alt="" draggable={false} />
            {crop && natural && (
              <div onPointerDown={startDrag("move")} className="vb-crop-box" style={{ left: crop.x * scale, top: crop.y * scale, width: crop.w * scale, height: crop.h * scale }}>
                <div onPointerDown={startDrag("resize")} className="vb-crop-handle" />
              </div>
            )}
          </div>
          {cutout ? (
            <>
              <p className="vb-hint">{t("Freisteller erkannt: Er wird ohne Zuschnitt gespeichert und passt in alle drei Formate.", "Cut-out detected: it is stored uncropped and fits all three formats.")}</p>
              <button type="button" className="primary-button" onClick={() => void uploadCutout()} disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}
                {t("Freisteller hochladen", "Upload cut-out")}
              </button>
            </>
          ) : (<>
          <p className="vb-hint">
            {t("Ausschnitt verschieben, Ecke ziehen zum Skalieren", "Move the frame, drag the corner to resize")} · {crop ? `${Math.round(crop.w)}×${Math.round(crop.h)} px` : ""}
          </p>
          <button type="button" className="primary-button" onClick={() => void upload()} disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}
            {t("Ausschnitt hochladen", "Upload crop")}
          </button>
          </>)}
        </>
      )}
    </div>
  );
}

export function UploadDialog({ open, libraryId, libraryLabel, onClose, onUploaded }: {
  open: boolean;
  libraryId: string;
  libraryLabel: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { t } = useI18n();
  const [done, setDone] = useState<string[]>([]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={t("Bilder hochladen", "Upload images")}
      description={t(
        `Pro Format ein Bild in beliebigem Seitenverhältnis laden und den passenden Ausschnitt wählen. Der Ausschnitt wird formatgenau in „${libraryLabel}“ gespeichert.`,
        `Load one image per format in any aspect ratio and choose the crop. It is saved to “${libraryLabel}” in the exact format.`,
      )}
    >
      <div className="vb-crop-grid">
        {FORMATS.map((format) => (
          <CropPane key={format.id} format={format} libraryId={libraryId} onUploaded={(name) => { setDone((current) => [name, ...current].slice(0, 12)); onUploaded(); }} />
        ))}
      </div>
      {done.length > 0 && (
        <ul className="vb-upload-done">
          {done.map((name) => <li key={name}><Check size={13} aria-hidden="true" /> {name}</li>)}
        </ul>
      )}
    </Modal>
  );
}

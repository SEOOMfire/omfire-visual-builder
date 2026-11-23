"use client";

import { useEffect, useRef, useState } from "react";
import { AArrowDown, AArrowUp, Bold, Eye, Italic, Underline } from "lucide-react";
import { useI18n } from "./i18n";
import type { PaletteColor } from "./types";

/** WYSIWYG editor (contentEditable). The value is HTML; users never see markup. */
export function RichTextEditor({
  value,
  onChange,
  fontFamily,
  fontOptions,
  colors = [],
  label,
}: {
  value: string;
  onChange: (html: string) => void;
  fontFamily: string;
  fontOptions: readonly string[];
  /** Brand colours offered for selected words. */
  colors?: readonly PaletteColor[];
  label: string;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef("");
  const [readable, setReadable] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (value !== lastEmitted.current && value !== element.innerHTML) element.innerHTML = value;
  }, [value]);

  const emit = () => {
    const element = ref.current;
    if (!element) return;
    lastEmitted.current = element.innerHTML;
    onChange(element.innerHTML);
  };

  const exec = (command: string) => {
    ref.current?.focus();
    try {
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand(command);
    } catch {
      /* Unsupported in this browser. */
    }
    emit();
  };

  const wrapSelection = (style: Partial<CSSStyleDeclaration>) => {
    const element = ref.current;
    if (!element) return;
    element.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!element.contains(range.commonAncestorContainer)) return;
    const span = document.createElement("span");
    Object.assign(span.style, style);
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      selection.removeAllRanges();
      const next = document.createRange();
      next.selectNodeContents(span);
      selection.addRange(next);
    } catch {
      /* Selection crossed a boundary the browser cannot split. */
    }
    emit();
  };

  const scale = (factor: number) => wrapSelection({ fontSize: `${Math.round(factor * 100)}%` });
  const setFont = (family: string) => family && wrapSelection({ fontFamily: `"${family}"` });
  const keepSelection = (event: React.MouseEvent) => event.preventDefault();

  return (
    <div className="vb-rte">
      <div className="vb-rte-toolbar" role="toolbar" aria-label={t("Textformat", "Text format")}>
        <button type="button" className="vb-tool" onMouseDown={keepSelection} onClick={() => exec("bold")} title={t("Fett", "Bold")} aria-label={t("Fett", "Bold")}><Bold size={14} /></button>
        <button type="button" className="vb-tool" onMouseDown={keepSelection} onClick={() => exec("italic")} title={t("Kursiv", "Italic")} aria-label={t("Kursiv", "Italic")}><Italic size={14} /></button>
        <button type="button" className="vb-tool" onMouseDown={keepSelection} onClick={() => exec("underline")} title={t("Unterstrichen", "Underline")} aria-label={t("Unterstrichen", "Underline")}><Underline size={14} /></button>
        <button type="button" className="vb-tool" onMouseDown={keepSelection} onClick={() => scale(1.35)} title={t("Auswahl größer", "Larger")} aria-label={t("Auswahl größer", "Larger")}><AArrowUp size={14} /></button>
        <button type="button" className="vb-tool" onMouseDown={keepSelection} onClick={() => scale(0.75)} title={t("Auswahl kleiner", "Smaller")} aria-label={t("Auswahl kleiner", "Smaller")}><AArrowDown size={14} /></button>
        <select
          className="vb-select vb-select-compact"
          value=""
          onChange={(event) => setFont(event.target.value)}
          title={t("Schriftart für Auswahl", "Font for selection")}
        >
          <option value="">{t("Schrift (Auswahl)", "Font (selection)")}</option>
          {fontOptions.map((family) => <option key={family} value={family}>{family}</option>)}
        </select>
        {colors.length > 0 && <span className="vb-divider" />}
        {colors.map(({ name, hex }) => (
          <button key={hex} type="button" className="vb-tool" onMouseDown={keepSelection} onClick={() => wrapSelection({ color: hex })}
            title={`${t("Farbe für Auswahl", "Color for selection")}: ${name}`} aria-label={`${t("Farbe für Auswahl", "Color for selection")}: ${name}`}>
            <span className="vb-swatch" style={{ background: hex }} />
          </button>
        ))}
        <button
          type="button"
          className={`vb-tool vb-tool-text${readable ? " is-active" : ""}`}
          aria-pressed={readable}
          onClick={() => setReadable((current) => !current)}
          title={readable ? t("Lesbare Ansicht aktiv (Größen im Bild bleiben erhalten)", "Readable view active (sizes in image unchanged)") : t("Originalgrößen anzeigen", "Show original sizes")}
        >
          <Eye size={14} /> {t("Lesbar", "Readable")}
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        onInput={emit}
        onBlur={emit}
        className={`vb-rte-surface${readable ? " is-readable" : ""}`}
        style={{ fontFamily: `"${fontFamily}", sans-serif` }}
      />
    </div>
  );
}

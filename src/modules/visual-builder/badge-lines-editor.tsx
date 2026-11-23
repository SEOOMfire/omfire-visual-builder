"use client";

import { ArrowUp, Bold, Plus, Strikethrough, X } from "lucide-react";
import { BADGE_SIZES, MAX_BADGE_LINES, lineBold } from "./brand";
import { useI18n } from "./i18n";
import { InfoTip } from "./info-tip";
import type { BadgeLine, BadgeSize } from "./types";

/** Rows of a badge: text, size, bold, struck through; `**…**` and `~~…~~` work inside a row. */
export function BadgeLinesEditor({ lines, onChange, maxText = 60 }: { lines: readonly BadgeLine[]; onChange: (lines: BadgeLine[]) => void; maxText?: number }) {
  const { t } = useI18n();
  const sizeLabel: Record<BadgeSize, string> = { xl: "XL", l: t("Groß", "Large"), m: t("Mittel", "Medium"), s: t("Klein", "Small") };
  const set = (index: number, patch: Partial<BadgeLine>) => onChange(lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  const move = (index: number) => {
    const next = [...lines];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };
  return (
    <div className="vb-stack">
      {lines.map((line, index) => {
        const bold = lineBold(line);
        return (
          <div key={index} className="vb-badge-line">
            <input className="vb-input" value={line.text} maxLength={maxText} aria-label={`${t("Zeile", "Line")} ${index + 1}`} onChange={(event) => set(index, { text: event.target.value })} />
            <select className="vb-select vb-select-tiny" value={line.size} aria-label={t("Größe", "Size")} onChange={(event) => set(index, { size: event.target.value as BadgeSize })}>
              {BADGE_SIZES.map((size) => <option key={size} value={size}>{sizeLabel[size]}</option>)}
            </select>
            <button type="button" className={`vb-tool${bold ? " is-active" : ""}`} aria-pressed={bold} title={t("Fett", "Bold")} aria-label={t("Fett", "Bold")} onClick={() => set(index, { bold: !bold })}>
              <Bold size={14} />
            </button>
            <button type="button" className={`vb-tool${line.strike ? " is-active" : ""}`} aria-pressed={line.strike} title={t("Ganze Zeile durchstreichen", "Strike through line")} aria-label={t("Durchgestrichen", "Strikethrough")} onClick={() => set(index, { strike: !line.strike })}>
              <Strikethrough size={14} />
            </button>
            <span className="vb-toggle-row">
              <button type="button" className="vb-tool" disabled={index === 0} title={t("Nach oben", "Move up")} aria-label={t("Nach oben", "Move up")} onClick={() => move(index)}><ArrowUp size={14} /></button>
              <button type="button" className="vb-tool" title={t("Zeile entfernen", "Remove line")} aria-label={t("Zeile entfernen", "Remove line")} onClick={() => onChange(lines.filter((_, position) => position !== index))}><X size={14} /></button>
            </span>
          </div>
        );
      })}
      <span className="vb-toggle-row">
        {lines.length < MAX_BADGE_LINES && (
          <button type="button" className="vb-tool" onClick={() => onChange([...lines, { text: "", size: "s", strike: false }])}><Plus size={14} /> {t("Zeile", "Line")}</button>
        )}
        <InfoTip align="start" text={t("In einer Zeile: **fett** und ~~100 GB~~ für einen kleinen durchgestrichenen Zusatz, z. B. „200 GB ~~100 GB~~“.", "Inside a line: **bold** and ~~100 GB~~ for a small struck-through addition.")} />
      </span>
    </div>
  );
}

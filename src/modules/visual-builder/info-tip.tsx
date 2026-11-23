"use client";

import { useId } from "react";
import { Info } from "lucide-react";
import { useI18n } from "./i18n";

/** Small "i" that reveals a help text on hover or keyboard focus. */
export function InfoTip({ text, align = "center" }: { text: string; align?: "center" | "start" | "end" }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <span className={`vb-info is-${align}`}>
      <button type="button" className="vb-info-button" aria-label={t("Hinweis", "Info")} aria-describedby={id} onClick={(event) => event.preventDefault()}>
        <Info size={13} aria-hidden="true" />
      </button>
      <span role="tooltip" id={id} className="vb-info-text">{text}</span>
    </span>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Pencil, Search, Trash2 } from "lucide-react";
import { ConfirmDialog, useFeedback } from "../../components/Feedback";
import { removeArchivedCreative } from "./archive-cache";
import { api } from "./client";
import { useI18n } from "./i18n";
import { FORMATS } from "./layout";
import type { ArchiveEntry, BuilderCapabilities } from "./types";

type Filter = "all" | "checked" | "open";

export function Archive({ caps, onEdit }: { caps: BuilderCapabilities; onEdit: (id: string) => void }) {
  const { t, locale } = useI18n();
  const { notify } = useFeedback();
  const [entries, setEntries] = useState<ArchiveEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingDelete, setPendingDelete] = useState<ArchiveEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEntries((await api.creatives()).creatives);
      setError(null);
    } catch (loadError) {
      setError((loadError as Error).message);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Loads the archive when the tab opens.
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (entries ?? []).filter((entry) => {
      if (filter === "checked" && !entry.zipUrl) return false;
      if (filter === "open" && entry.zipUrl) return false;
      return !needle || entry.sourceText.toLowerCase().includes(needle) || (entry.languageCode ?? "").toLowerCase().includes(needle);
    });
  }, [entries, filter, query]);

  const confirmDelete = async () => {
    const entry = pendingDelete;
    if (!entry || deletingId) return;
    setDeletingId(entry.id);
    try {
      await api.deleteCreative(entry.id);
      setEntries((current) => removeArchivedCreative(current, entry.id));
      notify({ tone: "success", title: t("Eintrag gelöscht", "Entry deleted") });
      setPendingDelete(null);
    } catch (deleteError) {
      notify({ tone: "danger", title: t("Löschen fehlgeschlagen", "Delete failed"), message: (deleteError as Error).message });
    } finally {
      setDeletingId(null);
    }
  };

  if (error) return <p className="vb-hint is-error">{error}</p>;
  if (!entries) return <p className="vb-hint">{t("Lädt…", "Loading…")}</p>;

  return (
    <div className="vb-archive">
      <div className="vb-archive-toolbar">
        <label className="vb-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Text oder Sprache suchen", "Search text or language")} aria-label={t("Archiv durchsuchen", "Search archive")} />
        </label>
        <div className="segmented compact" role="group" aria-label={t("Filter", "Filter")}>
          {([["all", t("Alle", "All")], ["checked", t("Geprüft", "Checked")], ["open", t("Noch nicht geprüft", "Not checked yet")]] as const).map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <span className="vb-hint">{visible.length} / {entries.length}</span>
      </div>

      {entries.length === 0 ? (
        <p className="vb-empty">{t("Noch keine gespeicherten Werbemittel.", "No saved creatives yet.")}</p>
      ) : visible.length === 0 ? (
        <p className="vb-empty">{t("Keine Treffer für diese Auswahl.", "No matches for this selection.")}</p>
      ) : (
        <div className="vb-archive-grid">
          {visible.map((entry) => (
            <article key={entry.id} className="vb-card vb-archive-card">
              <div className="vb-archive-thumbs">
                {FORMATS.map((format) => entry.thumbs[format.id]
                  // eslint-disable-next-line @next/next/no-img-element -- Same-origin archive preview.
                  ? <img key={format.id} src={entry.thumbs[format.id]} alt={format.label} loading="lazy" style={{ aspectRatio: `${format.w} / ${format.h}` }} />
                  : null)}
              </div>
              <p className="vb-archive-text">{entry.sourceText || "—"}</p>
              <div className="vb-archive-meta">
                {entry.guidelineStatus === "approved" && <span className="status-pill success">{t("CI-Prüfung bestanden", "Guideline check passed")}</span>}
                {entry.guidelineStatus === "flagged" && <span className="status-pill critical">{t("Nicht abgenommen", "Not signed off")}</span>}
                {entry.guidelineStatus === "draft" && <span className="status-pill warning">{t("Noch nicht geprüft", "Not checked yet")}</span>}
                {entry.languageCode && <span className="meta-pill">{entry.languageCode.toUpperCase()}</span>}
                <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString(locale === "en" ? "en-US" : "de-DE")}</time>
              </div>
              <div className="vb-archive-actions">
                {entry.zipUrl ? (
                  <a className="primary-button" href={entry.zipUrl} download
                    title={entry.guidelineStatus === "flagged" ? t("Download möglich, aber nicht final abgenommen", "Download available, but not signed off") : undefined}>
                    <Download size={15} /> ZIP
                  </a>
                ) : (
                  <button type="button" className="primary-button" disabled title={t("Bitte über Bearbeiten öffnen und die Richtlinien prüfen, bevor du die ZIP herunterladen kannst.", "Open via Edit and run the guideline check before downloading the ZIP.")}>
                    <Download size={15} /> ZIP
                  </button>
                )}
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={!entry.hasState}
                  title={entry.hasState ? undefined : t("Dieses Projekt wurde vor der Bearbeiten-Funktion gespeichert – neue Projekte lassen sich wieder öffnen.", "This project was saved before editing was available – new projects can be reopened.")}
                  onClick={() => onEdit(entry.id)}
                >
                  <Pencil size={15} /> {t("Bearbeiten", "Edit")}
                </button>
                {caps.delete && (
                  <button type="button" className="icon-text-btn vb-danger" disabled={deletingId !== null} onClick={() => setPendingDelete(entry)} aria-label={t("Löschen", "Delete")} title={t("Löschen", "Delete")}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("Archiv-Eintrag löschen?", "Delete archive entry?")}
        message={t("Der Eintrag und seine Dateien werden endgültig gelöscht.", "The entry and its files will be deleted permanently.")}
        confirmLabel={t("Löschen", "Delete")}
        cancelLabel={t("Abbrechen", "Cancel")}
        busy={deletingId !== null}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive as ArchiveIcon, PenSquare, Settings2 } from "lucide-react";
import { useApp } from "../../components/AppContext";
import { PageSkeleton } from "../../components/Feedback";
import { Archive } from "./archive";
import { api } from "./client";
import { Editor } from "./editor";
import { I18nProvider, useI18n } from "./i18n";
import { SETTINGS_SECTIONS, Settings, type SettingsSection } from "./settings";
import type { Bootstrap } from "./types";
import "./styles.css";

const BASE = "/visual-builder";
type Tab = "editor" | "archiv" | "einstellungen";

function parsePath(path: string): { tab: Tab; section: SettingsSection } {
  const [, tab = "", section = ""] = path.slice(BASE.length).split("/");
  const known = (SETTINGS_SECTIONS as readonly string[]).includes(section) ? (section as SettingsSection) : "bibliothek";
  if (tab === "archiv") return { tab: "archiv", section: known };
  if (tab === "einstellungen") return { tab: "einstellungen", section: known };
  return { tab: "editor", section: known };
}

export function VisualBuilderView() {
  return (
    <I18nProvider>
      <VisualBuilder />
    </I18nProvider>
  );
}

function VisualBuilder() {
  const { path, navigate } = useApp();
  const { t, locale, setLocale } = useI18n();
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadRequest, setLoadRequest] = useState<string | null>(null);
  const { tab, section } = parsePath(path);

  const reload = useCallback(async () => {
    try {
      setBootstrap(await api.bootstrap());
      setError(null);
    } catch (loadError) {
      setError((loadError as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial module data.
    void reload();
    const requested = new URLSearchParams(window.location.search).get("load");
    if (requested) setLoadRequest(requested);
  }, [reload]);

  const go = (next: Tab, nextSection?: SettingsSection) => {
    navigate(next === "editor" ? BASE : next === "archiv" ? `${BASE}/archiv` : `${BASE}/einstellungen${nextSection ? `/${nextSection}` : ""}`);
  };

  if (error) {
    return (
      <div className="page-enter">
        <p className="vb-hint is-error">{error}</p>
        <button type="button" className="secondary-btn" onClick={() => void reload()}>{t("Erneut versuchen", "Try again")}</button>
      </div>
    );
  }
  if (!bootstrap) return <PageSkeleton variant="detail" />;

  const caps = bootstrap.capabilities;
  const activeTab: Tab = tab === "einstellungen" && !caps.configure ? "editor" : tab;
  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "editor", label: "Editor", icon: <PenSquare size={15} /> },
    { id: "archiv", label: t("Archiv", "Archive"), icon: <ArchiveIcon size={15} /> },
    ...(caps.configure ? [{ id: "einstellungen" as const, label: t("Einstellungen", "Settings"), icon: <Settings2 size={15} /> }] : []),
  ];

  return (
    <div className="page-enter vb-page">
      <header className="page-heading vb-heading">
        <div>
          <span className="eyebrow">{t("Werkzeuge", "Tools")}</span>
          <h1>Visual-Builder</h1>
          <p>{t("Werbemittel in drei Formaten gestalten, prüfen und exportieren.", "Design, check and export creatives in three formats.")}</p>
        </div>
        <div className="segmented compact" role="group" aria-label={t("Sprache der Oberfläche", "Interface language")}>
          {(["de", "en"] as const).map((value) => (
            <button key={value} type="button" className={locale === value ? "active" : ""} aria-pressed={locale === value} onClick={() => setLocale(value)}>{value.toUpperCase()}</button>
          ))}
        </div>
      </header>

      <nav className="vb-tabs" aria-label="Visual-Builder">
        {tabs.map((entry) => (
          <button key={entry.id} type="button" className={activeTab === entry.id ? "is-active" : ""} aria-current={activeTab === entry.id ? "page" : undefined} onClick={() => go(entry.id)}>
            {entry.icon} {entry.label}
          </button>
        ))}
      </nav>

      <div hidden={activeTab !== "editor"}>
        <Editor bootstrap={bootstrap} active={activeTab === "editor"} loadRequest={loadRequest} onLoaded={() => setLoadRequest(null)} />
      </div>
      {activeTab === "archiv" && (
        <Archive caps={caps} onEdit={(id) => { setLoadRequest(id); go("editor"); }} />
      )}
      {activeTab === "einstellungen" && (
        <Settings bootstrap={bootstrap} onChanged={reload} section={section} onSection={(next) => go("einstellungen", next)} />
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  BadgePercent,
  ExternalLink,
  FileText,
  FileUp,
  FolderPlus,
  HardDrive,
  Images,
  Languages,
  LoaderCircle,
  MousePointer2,
  Paintbrush,
  Palette,
  Plus,
  RefreshCw,
  SquareDashed,
  Sticker,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { ConfirmDialog, useFeedback } from "../../components/Feedback";
import { BADGE_SHAPES, CTA_SHAPES, DEFAULT_BADGE_COLORS, DEFAULT_BADGE_LINES, MAX_PALETTE, brandColors } from "./brand";
import { BadgeLinesEditor } from "./badge-lines-editor";
import { BadgePreview, CtaPreview, useTenantFonts } from "./brand-preview";
import { action, api, driveImageUrl, loadImage, postForm } from "./client";
import { detectCutout, shrinkForUpload } from "./cutout";
import { useI18n } from "./i18n";
import { DEFAULT_ZONES, FORMATS, closestFormat, perFormat } from "./layout";
import type { BadgeColors, BadgeLine, BadgeShape, Bootstrap, Brand, CtaAsset, CtaShape, DriveListing, Fmt, PaletteColor, Rect } from "./types";

export const SETTINGS_SECTIONS = ["bibliothek", "beispiele", "logos", "marke", "buttons", "stoerer", "grafiken", "schriften", "sprachen", "richtlinien", "zonen"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

type Props = { bootstrap: Bootstrap; onChanged: () => Promise<void> };
type Confirm = { title: string; message: string; run: () => Promise<void> } | null;

function useRunner() {
  const { notify } = useFeedback();
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(async (key: string, task: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await task();
      if (success) notify({ tone: "success", title: success });
      return true;
    } catch (error) {
      notify({ tone: "danger", title: t("Das hat nicht geklappt", "That did not work"), message: (error as Error).message });
      return false;
    } finally {
      setBusy(null);
    }
  }, [notify, t]);
  return { busy, run };
}

function Section({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="vb-card vb-settings-section">
      <header className="vb-settings-head">
        <div>
          <h2>{title}</h2>
          {description ? <p className="vb-hint">{description}</p> : null}
        </div>
        {actions ? <div className="vb-format-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function Settings({ bootstrap, onChanged, section, onSection }: Props & { section: SettingsSection; onSection: (section: SettingsSection) => void }) {
  const { t } = useI18n();
  const items: Array<{ id: SettingsSection; label: string; icon: ReactNode }> = [
    { id: "bibliothek", label: t("Bildbibliothek", "Image library"), icon: <HardDrive size={15} /> },
    { id: "beispiele", label: t("Motive", "Images"), icon: <Images size={15} /> },
    { id: "logos", label: "Logos", icon: <Palette size={15} /> },
    { id: "marke", label: t("Marke & Farben", "Brand & colors"), icon: <Paintbrush size={15} /> },
    { id: "buttons", label: t("Buttons", "Buttons"), icon: <MousePointer2 size={15} /> },
    { id: "stoerer", label: t("Störer & Preisboxen", "Badges & price boxes"), icon: <BadgePercent size={15} /> },
    { id: "grafiken", label: t("Grafiken", "Graphics"), icon: <Sticker size={15} /> },
    { id: "schriften", label: t("Schriften", "Fonts"), icon: <Type size={15} /> },
    { id: "sprachen", label: t("Sprachen", "Languages"), icon: <Languages size={15} /> },
    { id: "richtlinien", label: t("CI-Richtlinien", "CI guidelines"), icon: <FileText size={15} /> },
    { id: "zonen", label: t("Sichere Zonen", "Safe zones"), icon: <SquareDashed size={15} /> },
  ];
  return (
    <div className="vb-settings">
      <nav className="vb-settings-nav" aria-label={t("Einstellungen", "Settings")}>
        {items.map((item) => (
          <button key={item.id} type="button" className={section === item.id ? "is-active" : ""} aria-current={section === item.id ? "page" : undefined} onClick={() => onSection(item.id)}>
            {item.icon} {item.label}
          </button>
        ))}
        <p className="vb-hint">{t("Nutzer und Rechte verwaltest du zentral in der Plattform-Verwaltung.", "Users and permissions are managed centrally in platform administration.")}</p>
      </nav>
      <div>
        {section === "bibliothek" && <LibrarySettings bootstrap={bootstrap} onChanged={onChanged} />}
        {section === "beispiele" && <ExampleSettings bootstrap={bootstrap} onChanged={onChanged} />}
        {section === "logos" && <LogoSettings bootstrap={bootstrap} onChanged={onChanged} />}
        {section === "marke" && <BrandSettings bootstrap={bootstrap} onChanged={onChanged} />}
        {section === "buttons" && <ButtonSettings bootstrap={bootstrap} onChanged={onChanged} />}
        {section === "stoerer" && <BadgeSettings bootstrap={bootstrap} onChanged={onChanged} />}
        {section === "grafiken" && <StickerSettings bootstrap={bootstrap} onChanged={onChanged} />}
        {section === "schriften" && <FontSettings bootstrap={bootstrap} onChanged={onChanged} />}
        {section === "sprachen" && <LanguageSettings bootstrap={bootstrap} onChanged={onChanged} />}
        {section === "richtlinien" && <GuidelineSettings onChanged={onChanged} />}
        {section === "zonen" && <SafeZoneSettings bootstrap={bootstrap} onChanged={onChanged} />}
      </div>
    </div>
  );
}

/* ---------- Image library (Google Drive) ---------- */

function LibrarySettings({ bootstrap, onChanged }: Props) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const [folder, setFolder] = useState("");
  const [label, setLabel] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [preview, setPreview] = useState<string | null>(null);

  if (!bootstrap.driveConfigured) {
    return (
      <Section title={t("Bildbibliothek (Google Drive)", "Image library (Google Drive)")}>
        <p className="vb-empty">{t("Google Drive ist für diese Installation noch nicht verbunden. Bitte das OMfire-Team ansprechen.", "Google Drive is not connected for this installation yet. Please contact the OMfire team.")}</p>
      </Section>
    );
  }

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await run("add", async () => {
      const result = await action<{ name: string }>("library.add", { folder, label });
      return result;
    }, t("Ordner verbunden", "Folder connected"));
    if (ok) {
      setFolder("");
      setLabel("");
      await onChanged();
    }
  };
  const create = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await run("create", () => action("library.create", { label: newLabel }), t("Ordner angelegt", "Folder created"));
    if (ok) {
      setNewLabel("");
      await onChanged();
    }
  };

  return (
    <>
      <Section
        title={t("Bildbibliothek (Google Drive)", "Image library (Google Drive)")}
        description={t(
          "Motive werden live aus Google Drive (inkl. Unterordner) geladen und automatisch dem passendsten Format zugeordnet. Mehrere Ordner sind möglich, z. B. pro Markt oder Sprache.",
          "Images are loaded live from Google Drive (incl. subfolders) and automatically assigned to the closest format. Several folders are possible, e.g. per market or language.",
        )}
      >
        {bootstrap.libraries.length === 0 ? (
          <p className="vb-empty">{t("Noch kein Ordner verbunden.", "No folder connected yet.")}</p>
        ) : (
          <ul className="vb-list">
            {bootstrap.libraries.map((library) => (
              <li key={library.id}>
                <div>
                  <strong>{library.label}</strong>
                  <a className="vb-link" href={`https://drive.google.com/drive/folders/${library.folderId}`} target="_blank" rel="noreferrer">
                    {t("In Drive öffnen", "Open in Drive")} <ExternalLink size={12} />
                  </a>
                </div>
                <div className="vb-format-actions">
                  <button type="button" className="icon-text-btn" onClick={() => setPreview(preview === library.id ? null : library.id)}>
                    {preview === library.id ? t("Übersicht schließen", "Close overview") : t("Bilder ansehen", "View images")}
                  </button>
                  <button type="button" className="icon-text-btn" disabled={busy !== null} onClick={() => void run(`test:${library.id}`, async () => {
                    const result = await action<{ name: string }>("library.test", { id: library.id });
                    return result;
                  }, t("Verbindung funktioniert", "Connection works"))}>
                    {busy === `test:${library.id}` ? <LoaderCircle className="spin" size={15} /> : null} {t("Verbindung testen", "Test connection")}
                  </button>
                  <button type="button" className="icon-text-btn vb-danger" aria-label={t("Entfernen", "Remove")} onClick={() => setConfirm({
                    title: t("Ordner trennen?", "Disconnect folder?"),
                    message: t("Der Ordner bleibt in Google Drive erhalten, wird hier aber nicht mehr angezeigt.", "The folder stays in Google Drive but is no longer shown here."),
                    run: async () => { await action("library.remove", { id: library.id }); await onChanged(); },
                  })}><Trash2 size={15} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {preview && <LibraryOverview libraryId={preview} />}

      <Section title={t("Bestehenden Ordner verbinden", "Connect an existing folder")} description={bootstrap.driveServiceAccount ? (
        <>
          {t("Den Ordner in Google Drive für diese Adresse freigeben (Betrachter reicht zum Lesen, Mitbearbeiter für Uploads):", "Share the folder in Google Drive with this address (viewer to read, editor for uploads):")}
          {" "}<code className="vb-code">{bootstrap.driveServiceAccount}</code>
        </>
      ) : undefined}>
        <form className="vb-form-row" onSubmit={(event) => void add(event)}>
          <label className="form-field">
            <span>{t("Ordner-Link oder -ID", "Folder link or ID")}</span>
            <input value={folder} onChange={(event) => setFolder(event.target.value)} placeholder="https://drive.google.com/drive/folders/…" required />
          </label>
          <label className="form-field">
            <span>{t("Bezeichnung (optional)", "Label (optional)")}</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder={t("z. B. Motive DE", "e.g. Images EN")} />
          </label>
          <button type="submit" className="primary-button" disabled={busy !== null || !folder.trim()}>
            {busy === "add" ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} {t("Verbinden", "Connect")}
          </button>
        </form>
      </Section>

      {bootstrap.driveCanCreateFolders && (
        <Section title={t("Neuen Ordner anlegen", "Create a new folder")} description={t("Legt einen eigenen Ordner für diesen Mandanten an. Kunden können dort Motive ablegen oder sie hier im Editor hochladen.", "Creates a dedicated folder for this tenant. Customers can drop images there or upload them in the editor.")}>
          <form className="vb-form-row" onSubmit={(event) => void create(event)}>
            <label className="form-field">
              <span>{t("Bezeichnung", "Label")}</span>
              <input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder={t("Motive", "Images")} />
            </label>
            <button type="submit" className="primary-button" disabled={busy !== null}>
              {busy === "create" ? <LoaderCircle className="spin" size={16} /> : <FolderPlus size={16} />} {t("Ordner anlegen", "Create folder")}
            </button>
          </form>
        </Section>
      )}

      <ConfirmDialogFor confirm={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

function LibraryOverview({ libraryId }: { libraryId: string }) {
  const { t } = useI18n();
  const { run } = useRunner();
  const [listing, setListing] = useState<DriveListing | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setListing(await api.library(libraryId));
    } catch (error) {
      setListing({ configured: true, images: [], error: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, [libraryId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Loads the overview for the opened library.
    void load();
  }, [load]);
  const reassign = (id: string, value: string) => void run(`fmt:${id}`, async () => {
    const format = value === "auto" ? null : (value as Fmt);
    await api.setImageFormat(id, format);
    setListing((current) => current && { ...current, images: current.images.map((image) => (image.id === id ? { ...image, override: format } : image)) });
  });
  return (
    <Section
      title={t("Bildübersicht", "Image overview")}
      description={t("Die Zuordnung zum Format kann hier oder im Editor geändert werden.", "The format assignment can be changed here or in the editor.")}
      actions={<button type="button" className="icon-text-btn" disabled={loading} onClick={() => void load()}>{loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} {t("Aktualisieren", "Refresh")}</button>}
    >
      {!listing ? <p className="vb-hint">{t("Lädt…", "Loading…")}</p> : listing.error ? <p className="vb-hint is-error">{listing.error}</p> : listing.images.length === 0 ? (
        <p className="vb-empty">{t("Noch keine Bilder in diesem Ordner.", "No images in this folder yet.")}</p>
      ) : (
        <div className="vb-library-grid">
          {listing.images.map((image) => {
            const auto = closestFormat(image.width && image.height ? image.width / image.height : 1);
            return (
              <figure key={image.id} className="vb-library-item">
                <div className="vb-library-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Drive preview with same-origin fallback. */}
                  <img src={image.thumb ?? driveImageUrl(image.id)} alt={image.name} referrerPolicy="no-referrer" loading="lazy"
                    onError={(event) => { const fallback = driveImageUrl(image.id); if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback; }} />
                </div>
                <figcaption>
                  <span title={`${image.folder}/${image.name}`}>{image.name}</span>
                  <small>{image.width}×{image.height}</small>
                  <select className="vb-select vb-select-tiny" value={image.override ?? "auto"} onChange={(event) => reassign(image.id, event.target.value)} aria-label={t("Format zuordnen", "Assign format")}>
                    <option value="auto">Auto ({FORMATS.find((format) => format.id === auto)!.label})</option>
                    {FORMATS.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}
                  </select>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function ConfirmDialogFor({ confirm, onClose }: { confirm: Confirm; onClose: () => void }) {
  const { t } = useI18n();
  const { notify } = useFeedback();
  const [busy, setBusy] = useState(false);
  return (
    <ConfirmDialog
      open={confirm !== null}
      title={confirm?.title ?? ""}
      message={confirm?.message ?? ""}
      confirmLabel={t("Löschen", "Delete")}
      cancelLabel={t("Abbrechen", "Cancel")}
      busy={busy}
      onClose={onClose}
      onConfirm={async () => {
        if (!confirm) return;
        setBusy(true);
        try {
          await confirm.run();
          onClose();
        } catch (error) {
          notify({ tone: "danger", title: t("Das hat nicht geklappt", "That did not work"), message: (error as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

/* ---------- Example motifs ---------- */

function ExampleSettings({ bootstrap, onChanged }: Props) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const ok = await run("upload", async () => {
      for (const file of Array.from(files)) {
        const url = URL.createObjectURL(file);
        let width = 0;
        let height = 0;
        let cutout = false;
        let upload = file;
        try {
          const image = await loadImage(url);
          width = image.naturalWidth;
          height = image.naturalHeight;
          cutout = detectCutout(image);
          upload = await shrinkForUpload(file, image, cutout);
        } finally {
          URL.revokeObjectURL(url);
        }
        const form = new FormData();
        form.set("kind", "example");
        form.set("name", file.name.replace(/\.[^.]+$/, "").slice(0, 120));
        form.set("width", String(width));
        form.set("height", String(height));
        if (cutout) form.set("cutout", "1");
        form.set("file", upload);
        await postForm("/api/visual-builder/files", form);
      }
    }, t("Motive hochgeladen", "Images uploaded"));
    if (ok) await onChanged();
  };

  return (
    <Section
      title={t("Motive und Freisteller", "Images and cut-outs")}
      description={t("Hintergrundbilder und freigestellte Personen oder Produkte (PNG mit transparentem Hintergrund). Freisteller erkennt das System selbst; im Editor liegen sie als eigene Ebene über dem Hintergrund. Große Dateien werden beim Hochladen verkleinert. Löschen entfernt sie nur hier.", "Background images and cut-out people or products (PNG with a transparent background). Cut-outs are detected automatically and sit as their own layer in the editor. Large files are scaled down on upload. Deleting removes them only here.")}
      actions={<>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden multiple onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} />
        <button type="button" className="primary-button" disabled={busy !== null} onClick={() => fileRef.current?.click()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />} {t("Hochladen", "Upload")}</button>
      </>}
    >
      {bootstrap.examples.length === 0 ? <p className="vb-empty">{t("Noch keine Motive.", "No images yet.")}</p> : (
        <div className="vb-asset-grid">
          {bootstrap.examples.map((example) => (
            <figure key={example.id} className="vb-asset">
              {/* eslint-disable-next-line @next/next/no-img-element -- Same-origin tenant asset. */}
              <img src={example.url} alt={example.name} />
              <figcaption><span title={example.name}>{example.name}</span></figcaption>
              <button type="button" className="vb-asset-delete" aria-label={t("Löschen", "Delete")} onClick={() => setConfirm({
                title: t("Motiv löschen?", "Delete image?"),
                message: example.name,
                run: async () => { await action("asset.delete", { id: example.id }); await onChanged(); },
              })}><Trash2 size={13} /></button>
            </figure>
          ))}
        </div>
      )}
      <ConfirmDialogFor confirm={confirm} onClose={() => setConfirm(null)} />
    </Section>
  );
}

/* ---------- Stickers (leaves, arrows) ---------- */

function StickerSettings({ bootstrap, onChanged }: Props) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const ok = await run("upload", async () => {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("kind", "sticker");
        form.set("file", file);
        await postForm("/api/visual-builder/files", form);
      }
    }, t("Grafiken hochgeladen", "Graphics uploaded"));
    if (ok) await onChanged();
  };

  return (
    <Section
      title={t("Grafiken", "Graphics")}
      description={t("Deko-Elemente wie Blätter, Pfeile oder Formen als PNG oder SVG mit transparentem Hintergrund. Im Editor frei platzierbar, drehbar, spiegelbar, vor oder hinter dem Freisteller.", "Decorative elements such as leaves, arrows or shapes as PNG or SVG with a transparent background. Freely placed, rotated and mirrored in the editor, in front of or behind the cut-out.")}
      actions={<>
        <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/webp" hidden multiple onChange={(event) => { void upload(event.target.files); event.target.value = ""; }} />
        <button type="button" className="primary-button" disabled={busy !== null} onClick={() => fileRef.current?.click()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />} {t("Hochladen", "Upload")}</button>
      </>}
    >
      {bootstrap.stickers.length === 0 ? <p className="vb-empty">{t("Noch keine Grafiken hochgeladen.", "No graphics uploaded yet.")}</p> : (
        <div className="vb-asset-grid">
          {bootstrap.stickers.map((sticker) => (
            <figure key={sticker.id} className="vb-asset vb-asset-dark">
              {/* eslint-disable-next-line @next/next/no-img-element -- Same-origin tenant asset. */}
              <img src={sticker.url} alt={sticker.name} />
              <figcaption><span title={sticker.name}>{sticker.name}</span></figcaption>
              <button type="button" className="vb-asset-delete" aria-label={t("Löschen", "Delete")} onClick={() => setConfirm({
                title: t("Grafik löschen?", "Delete graphic?"),
                message: sticker.name,
                run: async () => { await action("asset.delete", { id: sticker.id }); await onChanged(); },
              })}><Trash2 size={13} /></button>
            </figure>
          ))}
        </div>
      )}
      <ConfirmDialogFor confirm={confirm} onClose={() => setConfirm(null)} />
    </Section>
  );
}

/* ---------- Logos ---------- */

function LogoSettings({ bootstrap, onChanged }: Props) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const squareRef = useRef<HTMLInputElement>(null);
  const wideRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const upload = async (files: FileList | null, variant: "square" | "wide") => {
    if (!files?.length) return;
    const ok = await run(`upload:${variant}`, async () => {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("kind", "logo");
        form.set("variant", variant);
        form.set("file", file);
        await postForm("/api/visual-builder/files", form);
      }
    }, t("Logos hochgeladen", "Logos uploaded"));
    if (ok) await onChanged();
  };

  return (
    <Section
      title="Logos"
      description={t("PNG oder SVG mit transparentem Hintergrund, max. 4 MB.", "PNG or SVG with transparent background, max. 4 MB.")}
      actions={<>
        <input ref={squareRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden multiple onChange={(event) => { void upload(event.target.files, "square"); event.target.value = ""; }} />
        <input ref={wideRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden multiple onChange={(event) => { void upload(event.target.files, "wide"); event.target.value = ""; }} />
        <button type="button" className="secondary-btn" disabled={busy !== null} onClick={() => squareRef.current?.click()}><Upload size={15} /> {t("Quadratisch", "Square")}</button>
        <button type="button" className="primary-button" disabled={busy !== null} onClick={() => wideRef.current?.click()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Upload size={15} />} {t("Breit", "Wide")}</button>
      </>}
    >
      {bootstrap.logos.length === 0 ? <p className="vb-empty">{t("Noch keine Logos hochgeladen.", "No logos uploaded yet.")}</p> : (
        <div className="vb-asset-grid">
          {bootstrap.logos.map((logo) => (
            <figure key={logo.id} className="vb-asset">
              {/* eslint-disable-next-line @next/next/no-img-element -- Same-origin tenant asset. */}
              <img src={logo.url} alt={logo.name} />
              <figcaption><span title={logo.name}>{logo.name}</span><small>{logo.variant === "wide" ? t("Breit", "Wide") : t("Quadratisch", "Square")}</small></figcaption>
              <button type="button" className="vb-asset-delete" aria-label={t("Löschen", "Delete")} onClick={() => setConfirm({
                title: t("Logo löschen?", "Delete logo?"),
                message: logo.name,
                run: async () => { await action("asset.delete", { id: logo.id }); await onChanged(); },
              })}><Trash2 size={13} /></button>
            </figure>
          ))}
        </div>
      )}
      <ConfirmDialogFor confirm={confirm} onClose={() => setConfirm(null)} />
    </Section>
  );
}

/* ---------- Buttons (CTAs) ---------- */

function ButtonSettings({ bootstrap, onChanged }: Props) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const fonts = [...new Set([...bootstrap.fonts.map((font) => font.family), "Arial"])];
  const fontsReady = useTenantFonts(bootstrap.fonts);
  const baseFont = bootstrap.brand.bodyFont ?? bootstrap.defaultFont ?? fonts[0];
  const colors = brandColors(bootstrap.brand);
  const [form, setForm] = useState({
    name: "", variant: "text" as "text" | "graphic", text: "", shape: "tag" as CtaShape,
    bg: colors[0]?.hex ?? "#e5001c", fg: "#ffffff", border: "#ffffff", font: "", file: null as File | null,
  });
  const [confirm, setConfirm] = useState<Confirm>(null);
  const shapeLabel = (shape: CtaShape) => ({
    tag: t("Abgeschrägt", "Slanted"),
    arrow: t("Pfeil-Leiste (zwei Pfeile, Spitze rechts)", "Arrow bar"),
    pill: t("Abgerundet", "Rounded"),
    outline: t("Abgerundet mit Kontur", "Rounded with outline"),
  })[shape];
  const draft: CtaAsset = {
    id: "draft", name: form.name, variant: "text", url: null, text: form.text || form.name || t("Vorschau", "Preview"),
    style: { bg_color: form.bg, text_color: form.fg, font_family: form.font || null, shape: form.shape, border_color: form.shape === "outline" ? form.border : null },
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const data = new FormData();
    data.set("kind", "cta");
    data.set("name", form.name);
    data.set("variant", form.variant);
    if (form.variant === "text") {
      data.set("text", form.text);
      data.set("bg_color", form.bg);
      data.set("text_color", form.fg);
      data.set("font_family", form.font);
      data.set("shape", form.shape);
      if (form.shape === "outline") data.set("border_color", form.border);
    } else if (form.file) {
      data.set("file", form.file);
    }
    const ok = await run("save", () => postForm("/api/visual-builder/files", data), t("Button gespeichert", "Button saved"));
    if (ok) {
      setForm((current) => ({ ...current, name: "", text: "", file: null }));
      await onChanged();
    }
  };

  return (
    <>
      <Section title={t("Buttons (Call-to-Action)", "Buttons (call to action)")}>
        {bootstrap.ctas.length === 0 ? <p className="vb-empty">{t("Noch keine Buttons angelegt.", "No buttons yet.")}</p> : (
          <ul className="vb-list">
            {bootstrap.ctas.map((cta) => (
              <li key={cta.id}>
                <div className="vb-cta-preview">
                  {cta.variant === "graphic" && cta.url
                    // eslint-disable-next-line @next/next/no-img-element -- Same-origin tenant asset.
                    ? <img src={cta.url} alt="" />
                    : <CtaPreview cta={cta} font={baseFont} fontsReady={fontsReady} />}
                  <div>
                    <strong>{cta.name}</strong>
                    <small>{cta.variant === "text" ? `${t("Text-Button", "Text button")} · ${shapeLabel(cta.style.shape ?? "tag")}` : t("Grafik", "Graphic")}</small>
                  </div>
                </div>
                <button type="button" className="icon-text-btn vb-danger" aria-label={t("Löschen", "Delete")} onClick={() => setConfirm({
                  title: t("Button löschen?", "Delete button?"),
                  message: cta.name,
                  run: async () => { await action("asset.delete", { id: cta.id }); await onChanged(); },
                })}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t("Neuen Button anlegen", "New button")}>
        <form className="vb-form-grid" onSubmit={(event) => void save(event)}>
          <label className="form-field"><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={120} /></label>
          <label className="form-field">
            <span>{t("Typ", "Type")}</span>
            <select value={form.variant} onChange={(event) => setForm({ ...form, variant: event.target.value as "text" | "graphic" })}>
              <option value="text">{t("Text-Button", "Text button")}</option>
              <option value="graphic">{t("Grafik / Sticker", "Graphic / sticker")}</option>
            </select>
          </label>
          {form.variant === "text" ? (
            <>
              <label className="form-field">
                <span>Text</span>
                <input value={form.text} onChange={(event) => setForm({ ...form, text: event.target.value })} placeholder={t("Jetzt sichern auf **beispiel.de**", "Buy now at **example.com**")} maxLength={200} />
                <small className="vb-hint">{t("Mit **Sternchen** markierte Teile werden fett.", "Parts marked with **asterisks** are bold.")}</small>
              </label>
              <label className="form-field">
                <span>{t("Form", "Shape")}</span>
                <select value={form.shape} onChange={(event) => setForm({ ...form, shape: event.target.value as CtaShape })}>
                  {CTA_SHAPES.map((shape) => <option key={shape} value={shape}>{shapeLabel(shape)}</option>)}
                </select>
              </label>
              <label className="form-field">
                <span>{t("Schriftart", "Font")}</span>
                <select value={form.font} onChange={(event) => setForm({ ...form, font: event.target.value })}>
                  <option value="">{t("Wie Markenschrift (Fließtext)", "Same as brand body font")}</option>
                  {fonts.map((family) => <option key={family} value={family}>{family}</option>)}
                </select>
              </label>
              <ColorField label={t("Hintergrund", "Background")} value={form.bg} colors={colors} onChange={(bg) => setForm({ ...form, bg })} />
              <ColorField label={t("Textfarbe", "Text color")} value={form.fg} colors={colors} onChange={(fg) => setForm({ ...form, fg })} />
              {form.shape === "outline" && <ColorField label={t("Kontur", "Outline")} value={form.border} colors={colors} onChange={(border) => setForm({ ...form, border })} />}
              <div className="vb-form-preview vb-span-2">
                <CtaPreview cta={draft} font={form.font || baseFont} fontsReady={fontsReady} height={36} />
              </div>
            </>
          ) : (
            <label className="form-field vb-span-2">
              <span>{t("Bild-Datei (PNG mit Transparenz empfohlen)", "Image file (PNG with transparency recommended)")}</span>
              <input type="file" accept="image/png,image/svg+xml,image/webp" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] ?? null })} required />
            </label>
          )}
          <div className="vb-span-2">
            <button type="submit" className="primary-button" disabled={busy !== null || !form.name.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} {t("Speichern", "Save")}</button>
          </div>
        </form>
      </Section>
      <ConfirmDialogFor confirm={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

/** Brand colours as quick picks plus a free colour field. */
function ColorField({ label, value, colors, onChange }: { label: string; value: string; colors: readonly PaletteColor[]; onChange: (hex: string) => void }) {
  return (
    <div className="form-field">
      <span>{label}</span>
      <div className="vb-toggle-row">
        {colors.map(({ name, hex }) => (
          <button key={hex} type="button" className={`vb-tool${value.toLowerCase() === hex ? " is-active" : ""}`} aria-pressed={value.toLowerCase() === hex} title={`${name} ${hex}`} aria-label={`${label}: ${name}`} onClick={() => onChange(hex)}>
            <span className="vb-swatch" style={{ background: hex }} />
          </button>
        ))}
        <input type="color" value={value} aria-label={label} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}

/* ---------- Brand (fonts per role, colours) ---------- */

function BrandSettings({ bootstrap, onChanged }: Props) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const families = [...new Set([...bootstrap.fonts.map((font) => font.family), "Arial"])];
  const [brand, setBrand] = useState<Brand>(bootstrap.brand);
  const [draft, setDraft] = useState<PaletteColor>({ name: "", hex: "#000000" });
  const setPalette = (palette: PaletteColor[]) => setBrand({ ...brand, palette });
  const move = (index: number, delta: number) => {
    const next = [...brand.palette];
    const [item] = next.splice(index, 1);
    next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, item);
    setPalette(next);
  };
  const colors = brandColors(brand);
  const fontSelect = (value: string | null, onChange: (font: string | null) => void) => (
    <select value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">{t("Nicht festgelegt", "Not set")}</option>
      {families.map((family) => <option key={family} value={family}>{family}</option>)}
    </select>
  );
  const colorSelect = (label: string, value: string | null, onChange: (hex: string | null) => void) => (
    <ColorField label={label} value={value ?? "#ffffff"} colors={colors} onChange={onChange} />
  );

  return (
    <>
      <Section
        title={t("Markenschriften", "Brand fonts")}
        description={t("Diese Schriften sind im Editor vorausgewählt: Textfenster 1 (Headline) und Textfenster 2 (Subline). Buttons und Störer nutzen die Fließtextschrift, wenn sie keine eigene haben.", "These fonts are preselected in the editor: text box 1 (headline) and text box 2 (subline). Buttons and badges use the body font unless they have their own.")}
      >
        <div className="vb-form-grid">
          <label className="form-field"><span>{t("Headline", "Headline")}</span>{fontSelect(brand.headlineFont, (headlineFont) => setBrand({ ...brand, headlineFont }))}</label>
          <label className="form-field"><span>{t("Subline, Buttons, Störer", "Subline, buttons, badges")}</span>{fontSelect(brand.bodyFont, (bodyFont) => setBrand({ ...brand, bodyFont }))}</label>
          {colorSelect(t("Standardfarbe Headline", "Default headline color"), brand.headlineColor, (headlineColor) => setBrand({ ...brand, headlineColor }))}
          {colorSelect(t("Standardfarbe Subline", "Default subline color"), brand.bodyColor, (bodyColor) => setBrand({ ...brand, bodyColor }))}
        </div>
      </Section>
      <Section
        title={t("Markenfarben", "Brand colors")}
        description={t("Stehen im Editor für Text, einzelne Wörter, Hintergrund, Buttons und Störer bereit. Schwarz und Weiß sind immer dabei.", "Available in the editor for text, single words, background, buttons and badges. Black and white are always included.")}
      >
        {brand.palette.length === 0 ? <p className="vb-empty">{t("Noch keine Markenfarben.", "No brand colors yet.")}</p> : (
          <div className="vb-stack">
            {brand.palette.map((color, index) => (
              <div key={`${color.hex}-${index}`} className="vb-palette-row">
                <input className="vb-input" value={color.name} maxLength={40} aria-label={t("Name", "Name")}
                  onChange={(event) => setPalette(brand.palette.map((entry, position) => (position === index ? { ...entry, name: event.target.value } : entry)))} />
                <input type="color" value={color.hex} aria-label={color.name || color.hex}
                  onChange={(event) => setPalette(brand.palette.map((entry, position) => (position === index ? { ...entry, hex: event.target.value.toLowerCase() } : entry)))} />
                <code>{color.hex}</code>
                <div className="vb-toggle-row">
                  <button type="button" className="vb-tool" disabled={index === 0} onClick={() => move(index, -1)} aria-label={t("Nach oben", "Move up")}>↑</button>
                  <button type="button" className="vb-tool" onClick={() => setPalette(brand.palette.filter((_, position) => position !== index))} aria-label={t("Entfernen", "Remove")}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {brand.palette.length < MAX_PALETTE && (
          <div className="vb-palette-row">
            <input className="vb-input" value={draft.name} maxLength={40} placeholder={t("Name, z. B. Orange", "Name, e.g. Orange")} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            <input type="color" value={draft.hex} aria-label={t("Farbe", "Color")} onChange={(event) => setDraft({ ...draft, hex: event.target.value.toLowerCase() })} />
            <code>{draft.hex}</code>
            <button type="button" className="icon-text-btn" disabled={brand.palette.some((entry) => entry.hex === draft.hex)} onClick={() => { setPalette([...brand.palette, { name: draft.name.trim() || draft.hex, hex: draft.hex }]); setDraft({ name: "", hex: "#000000" }); }}>
              <Plus size={14} /> {t("Hinzufügen", "Add")}
            </button>
          </div>
        )}
        <div>
          <button type="button" className="primary-button" disabled={busy !== null} onClick={() => void run("brand", async () => { await action("settings.save", { brand }); await onChanged(); }, t("Marke gespeichert", "Brand saved"))}>
            {busy === "brand" ? <LoaderCircle className="spin" size={16} /> : null} {t("Speichern", "Save")}
          </button>
        </div>
      </Section>
    </>
  );
}

/* ---------- Badges (price boxes, diamonds, starbursts) ---------- */

function BadgeSettings({ bootstrap, onChanged }: Props) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const fontsReady = useTenantFonts(bootstrap.fonts);
  const font = bootstrap.brand.bodyFont ?? bootstrap.defaultFont ?? bootstrap.fonts[0]?.family ?? "Arial";
  const colors = brandColors(bootstrap.brand);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [form, setForm] = useState<{ name: string; shape: BadgeShape; lines: BadgeLine[]; colors: BadgeColors }>({
    name: "", shape: "price-box", lines: DEFAULT_BADGE_LINES["price-box"].map((line) => ({ ...line })), colors: { ...DEFAULT_BADGE_COLORS },
  });
  const shapeLabel = (shape: BadgeShape) => ({
    "price-box": t("Preis-Box (zweiteilig)", "Price box (two parts)"),
    diamond: t("Raute", "Diamond"),
    burst: t("Zacken-Stern", "Starburst"),
    circle: t("Kreis", "Circle"),
    box: t("Box", "Box"),
  })[shape];
  const setColor = (key: keyof BadgeColors) => (hex: string) => setForm({ ...form, colors: { ...form.colors, [key]: hex } });

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const data = new FormData();
    data.set("kind", "badge");
    data.set("name", form.name);
    data.set("variant", form.shape);
    data.set("lines", JSON.stringify(form.lines.filter((line) => line.text.trim())));
    data.set("bg_color", form.colors.bg);
    data.set("text_color", form.colors.fg);
    data.set("accent_bg", form.colors.accentBg);
    data.set("accent_fg", form.colors.accentFg);
    data.set("border_color", form.colors.border);
    const ok = await run("save", () => postForm("/api/visual-builder/files", data), t("Störer gespeichert", "Badge saved"));
    if (ok) {
      setForm((current) => ({ ...current, name: "" }));
      await onChanged();
    }
  };

  return (
    <>
      <Section
        title={t("Störer & Preisboxen", "Badges & price boxes")}
        description={t("Vorlagen, die im Editor pro Format eingefügt werden. Texte, Größe und Position passt man dort an; Form und Farben kommen aus der Vorlage.", "Templates inserted per format in the editor. Text, size and position are adjusted there; shape and colors come from the template.")}
      >
        {bootstrap.badges.length === 0 ? <p className="vb-empty">{t("Noch keine Störer angelegt.", "No badges yet.")}</p> : (
          <ul className="vb-list">
            {bootstrap.badges.map((badge) => (
              <li key={badge.id}>
                <div className="vb-cta-preview">
                  <BadgePreview badge={badge} font={font} fontsReady={fontsReady} width={badge.shape === "price-box" ? 90 : 70} />
                  <div>
                    <strong>{badge.name}</strong>
                    <small>{shapeLabel(badge.shape)}</small>
                  </div>
                </div>
                <button type="button" className="icon-text-btn vb-danger" aria-label={t("Löschen", "Delete")} onClick={() => setConfirm({
                  title: t("Störer löschen?", "Delete badge?"),
                  message: badge.name,
                  run: async () => { await action("asset.delete", { id: badge.id }); await onChanged(); },
                })}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={t("Neuen Störer anlegen", "New badge")}>
        <form className="vb-form-grid" onSubmit={(event) => void save(event)}>
          <label className="form-field"><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={120} /></label>
          <label className="form-field">
            <span>{t("Form", "Shape")}</span>
            <select value={form.shape} onChange={(event) => {
              const shape = event.target.value as BadgeShape;
              setForm({ ...form, shape, lines: DEFAULT_BADGE_LINES[shape].map((line) => ({ ...line })) });
            }}>
              {BADGE_SHAPES.map((shape) => <option key={shape} value={shape}>{shapeLabel(shape)}</option>)}
            </select>
          </label>
          <div className="form-field vb-span-2">
            <span>{form.shape === "price-box" ? t("Zeilen (die ersten zwei stehen im oberen Feld)", "Lines (the first two go in the top part)") : t("Zeilen", "Lines")}</span>
            <BadgeLinesEditor lines={form.lines} maxText={40} onChange={(lines) => setForm({ ...form, lines })} />
          </div>
          <ColorField label={form.shape === "price-box" ? t("Fläche oben", "Top fill") : t("Fläche", "Fill")} value={form.colors.bg} colors={colors} onChange={setColor("bg")} />
          <ColorField label={form.shape === "price-box" ? t("Text oben", "Top text") : t("Text", "Text")} value={form.colors.fg} colors={colors} onChange={setColor("fg")} />
          {form.shape === "price-box" && (
            <>
              <ColorField label={t("Fläche unten", "Bottom fill")} value={form.colors.accentBg} colors={colors} onChange={setColor("accentBg")} />
              <ColorField label={t("Text unten", "Bottom text")} value={form.colors.accentFg} colors={colors} onChange={setColor("accentFg")} />
              <ColorField label={t("Kontur unten", "Bottom outline")} value={form.colors.border} colors={colors} onChange={setColor("border")} />
            </>
          )}
          <div className="vb-form-preview vb-span-2">
            <BadgePreview badge={{ name: form.name, shape: form.shape, lines: form.lines, colors: form.colors }} font={font} fontsReady={fontsReady} width={form.shape === "price-box" ? 140 : 120} />
          </div>
          <div className="vb-span-2">
            <button type="submit" className="primary-button" disabled={busy !== null || !form.name.trim() || !form.lines.some((line) => line.text.trim())}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} {t("Speichern", "Save")}</button>
          </div>
        </form>
      </Section>
      <ConfirmDialogFor confirm={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

/* ---------- Fonts ---------- */

function FontSettings({ bootstrap, onChanged }: Props) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const families = [...new Set(bootstrap.fonts.map((font) => font.family))];
  const [form, setForm] = useState({ family: families[0] ?? "", weight: "400", style: "normal", file: null as File | null });
  const [defaultFont, setDefaultFont] = useState(bootstrap.defaultFont ?? "");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.file) return;
    const data = new FormData();
    data.set("kind", "font");
    data.set("family", form.family);
    data.set("weight", form.weight);
    data.set("style", form.style);
    data.set("file", form.file);
    const ok = await run("upload", () => postForm("/api/visual-builder/files", data), t("Schrift hochgeladen", "Font uploaded"));
    if (ok) {
      setForm((current) => ({ ...current, file: null }));
      if (fileRef.current) fileRef.current.value = "";
      await onChanged();
    }
  };

  return (
    <>
      <Section
        title={t("Schriften", "Fonts")}
        description={t("Hausschriften als OTF, TTF, WOFF oder WOFF2 hochladen – pro Schnitt eine Datei. Nur hochladen, wenn die Lizenz die Nutzung für Werbemittel erlaubt.", "Upload brand fonts as OTF, TTF, WOFF or WOFF2 – one file per style. Only upload fonts licensed for advertising use.")}
      >
        {bootstrap.fonts.length === 0 ? <p className="vb-empty">{t("Noch keine Schriften – der Editor nutzt Arial.", "No fonts yet – the editor uses Arial.")}</p> : (
          <ul className="vb-list">
            {bootstrap.fonts.map((font) => (
              <li key={font.id}>
                <div>
                  <strong style={{ fontFamily: `"${font.family}", sans-serif`, fontWeight: font.weight, fontStyle: font.style }}>{font.family}</strong>
                  <small>{font.weight}{font.style === "italic" ? ` · ${t("kursiv", "italic")}` : ""} · {font.name}</small>
                </div>
                <button type="button" className="icon-text-btn vb-danger" aria-label={t("Löschen", "Delete")} onClick={() => setConfirm({
                  title: t("Schrift löschen?", "Delete font?"),
                  message: `${font.family} ${font.weight}`,
                  run: async () => { await action("asset.delete", { id: font.id }); await onChanged(); },
                })}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
        <form className="vb-form-grid" onSubmit={(event) => void upload(event)}>
          <label className="form-field">
            <span>{t("Schriftname (Familie)", "Font family name")}</span>
            <input value={form.family} onChange={(event) => setForm({ ...form, family: event.target.value })} placeholder="z. B. DIN Next LT Pro" required maxLength={80} list="vb-font-families" />
            <datalist id="vb-font-families">{families.map((family) => <option key={family} value={family} />)}</datalist>
          </label>
          <label className="form-field">
            <span>{t("Strichstärke", "Weight")}</span>
            <select value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })}>
              {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>{t("Stil", "Style")}</span>
            <select value={form.style} onChange={(event) => setForm({ ...form, style: event.target.value })}>
              <option value="normal">{t("Normal", "Normal")}</option>
              <option value="italic">{t("Kursiv", "Italic")}</option>
            </select>
          </label>
          <label className="form-field">
            <span>{t("Datei", "File")}</span>
            <input ref={fileRef} type="file" accept=".otf,.ttf,.woff,.woff2" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] ?? null })} required />
          </label>
          <div className="vb-span-2">
            <button type="submit" className="primary-button" disabled={busy !== null || !form.file || !form.family.trim()}>{busy === "upload" ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />} {t("Hochladen", "Upload")}</button>
          </div>
        </form>
      </Section>
      <Section title={t("Standardschrift im Editor", "Default editor font")}>
        <div className="vb-form-row">
          <label className="form-field">
            <span>{t("Schrift", "Font")}</span>
            <select value={defaultFont} onChange={(event) => setDefaultFont(event.target.value)}>
              <option value="">{t("Erste hochgeladene Schrift", "First uploaded font")}</option>
              {[...families, "Arial"].map((family) => <option key={family} value={family}>{family}</option>)}
            </select>
          </label>
          <button type="button" className="primary-button" disabled={busy !== null} onClick={() => void run("default", async () => { await action("settings.save", { defaultFont }); await onChanged(); }, t("Gespeichert", "Saved"))}>
            {t("Speichern", "Save")}
          </button>
        </div>
      </Section>
      <ConfirmDialogFor confirm={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

/* ---------- Languages ---------- */

function LanguageSettings({ bootstrap, onChanged }: Props) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const [draft, setDraft] = useState({ code: "", label: "" });

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await run("add", () => action("language.save", draft), t("Sprache hinzugefügt", "Language added"));
    if (ok) {
      setDraft({ code: "", label: "" });
      await onChanged();
    }
  };

  return (
    <Section
      title={t("Sprachen für die Übersetzung", "Translation languages")}
      actions={bootstrap.languages.length === 0 ? (
        <button type="button" className="secondary-btn" disabled={busy !== null} onClick={() => void run("seed", async () => { await action("language.seed"); await onChanged(); }, t("Standardsprachen angelegt", "Default languages added"))}>
          {t("Standardsprachen anlegen", "Add default languages")}
        </button>
      ) : undefined}
    >
      <form className="vb-form-row" onSubmit={(event) => void add(event)}>
        <label className="form-field"><span>{t("Kürzel (z. B. de-DE)", "Code (e.g. en-US)")}</span><input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} required maxLength={20} /></label>
        <label className="form-field"><span>{t("Bezeichnung", "Label")}</span><input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder={t("Deutsch", "German")} required maxLength={80} /></label>
        <button type="submit" className="primary-button" disabled={busy !== null}><Plus size={16} /> {t("Hinzufügen", "Add")}</button>
      </form>
      {bootstrap.languages.length === 0 ? <p className="vb-empty">{t("Noch keine Sprachen hinterlegt.", "No languages yet.")}</p> : (
        <ul className="vb-list">
          {bootstrap.languages.map((language) => (
            <li key={language.id}>
              <div><strong>{language.label}</strong><small>{language.code}</small></div>
              <div className="vb-format-actions">
                <label className="vb-switch">
                  <input type="checkbox" checked={language.active} disabled={busy !== null}
                    onChange={(event) => void run(`toggle:${language.id}`, async () => { await action("language.save", { ...language, active: event.target.checked }); await onChanged(); })} />
                  <span>{language.active ? t("aktiv", "active") : t("inaktiv", "inactive")}</span>
                </label>
                <button type="button" className="icon-text-btn vb-danger" aria-label={t("Löschen", "Delete")} disabled={busy !== null}
                  onClick={() => void run(`delete:${language.id}`, async () => { await action("language.delete", { id: language.id }); await onChanged(); })}>
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ---------- CI guidelines ---------- */

function GuidelineSettings({ onChanged }: { onChanged: () => Promise<void> }) {
  const { t } = useI18n();
  const { notify } = useFeedback();
  const { busy, run } = useRunner();
  const [text, setText] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void api.guideline().then((result) => {
      if (cancelled) return;
      setText(result.text);
      setFilename(result.filename);
    }).catch(() => { if (!cancelled) setText(""); });
    return () => { cancelled = true; };
  }, []);

  const onFile = async (file?: File) => {
    if (!file) return;
    setParsing(true);
    try {
      const { extractGuidelineText } = await import("./guideline-parse");
      const extracted = await extractGuidelineText(file);
      if (!extracted) throw new Error(t("Kein Text gefunden", "No text found"));
      setText(extracted.slice(0, 50_000));
      setFilename(file.name);
      notify({ tone: "info", title: t(`„${file.name}“ eingelesen – bitte speichern`, `“${file.name}” imported – please save`) });
    } catch (error) {
      notify({ tone: "danger", title: t("Datei konnte nicht gelesen werden", "Could not read file"), message: (error as Error).message });
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (text === null) return <Section title={t("CI-Richtlinien", "CI guidelines")}><p className="vb-hint">{t("Lädt…", "Loading…")}</p></Section>;

  return (
    <Section
      title={t("CI-Richtlinien", "CI guidelines")}
      description={t("Lade die Richtlinien als DOCX oder PDF hoch oder füge sie als Text ein. Sie gelten für alle Nutzer dieses Mandanten; Texte in jeder Sprache werden dagegen geprüft.", "Upload the guidelines as DOCX or PDF or paste them as text. They apply to all users of this tenant; copy in any language is checked against them.")}
    >
      <div className="vb-dropzone vb-dropzone-wide" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void onFile(event.dataTransfer.files?.[0]); }}>
        <input ref={fileRef} type="file" accept=".docx,.pdf,.txt,.md" hidden onChange={(event) => void onFile(event.target.files?.[0])} />
        <button type="button" className="secondary-btn" onClick={() => fileRef.current?.click()} disabled={parsing}>
          {parsing ? <LoaderCircle className="spin" size={16} /> : <FileUp size={16} />} {t("DOCX / PDF hochladen", "Upload DOCX / PDF")}
        </button>
        <span>{t("oder Datei hierher ziehen", "or drop a file here")}{filename ? ` · ${t("zuletzt", "last")}: ${filename}` : ""}</span>
      </div>
      <label className="form-field">
        <span>{t("Richtlinien", "Guidelines")}</span>
        <textarea rows={18} value={text} maxLength={50_000} onChange={(event) => setText(event.target.value)} placeholder={t("z. B. – Keine Superlative – Anrede immer „du“ – …", "e.g. – No superlatives – always informal address – …")} />
      </label>
      <div className="vb-form-row">
        <button type="button" className="primary-button" disabled={busy !== null} onClick={() => void run("save", async () => { await action("guideline.save", { text, filename }); await onChanged(); }, t("Richtlinien gespeichert", "Guidelines saved"))}>
          {busy ? <LoaderCircle className="spin" size={16} /> : null} {t("Speichern", "Save")}
        </button>
        <span className="vb-hint">{text.length.toLocaleString("de-DE")} / 50.000</span>
      </div>
    </Section>
  );
}

/* ---------- Safe zones ---------- */

function SafeZoneSettings({ bootstrap, onChanged }: Props) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const [zones, setZones] = useState<Record<Fmt, Rect>>(() => perFormat((id) => bootstrap.safeZones[id] ?? DEFAULT_ZONES[id]));
  const labels: Record<Fmt, string> = { "1x1": t("Quadrat (1:1)", "Square (1:1)"), "191x1": t("Querformat (1.91:1)", "Landscape (1.91:1)"), "1x191": t("Hochformat (1:1.91)", "Portrait (1:1.91)") };
  const fields: Array<[keyof Rect, string]> = [["x_pct", t("Abstand links", "Left")], ["y_pct", t("Abstand oben", "Top")], ["w_pct", t("Breite", "Width")], ["h_pct", t("Höhe", "Height")]];

  return (
    <Section
      title={t("Sichere Zonen (Meta / Instagram)", "Safe zones (Meta / Instagram)")}
      description={t("Definiere für jedes Format den Bereich, in dem Text, Logo und Button nicht abgeschnitten oder überlagert werden. Werte in Prozent der Bildgröße.", "Define for each format the area in which text, logo and button are not cut off or covered. Values in percent of the image size.")}
    >
      {FORMATS.map((format) => {
        const rect = zones[format.id];
        const invalid = rect.x_pct + rect.w_pct > 100.001 || rect.y_pct + rect.h_pct > 100.001 || rect.w_pct < 5 || rect.h_pct < 5;
        return (
          <div key={format.id} className="vb-zone-row">
            <div>
              <strong>{labels[format.id]}</strong>
              <div className="vb-zone-preview" style={{ aspectRatio: `${format.w} / ${format.h}`, width: `min(100%, ${Math.round((260 * format.w) / format.h)}px)` }}>
                <div style={{ left: `${rect.x_pct}%`, top: `${rect.y_pct}%`, width: `${rect.w_pct}%`, height: `${rect.h_pct}%` }} />
              </div>
            </div>
            <div className="vb-form-grid">
              {fields.map(([key, label]) => (
                <label key={key} className="form-field">
                  <span>{label} (%)</span>
                  <input type="number" min={0} max={100} step={0.5} value={rect[key]}
                    onChange={(event) => setZones((current) => ({ ...current, [format.id]: { ...rect, [key]: Math.max(0, Math.min(100, Number(event.target.value))) } }))} />
                </label>
              ))}
              <div className="vb-span-2 vb-form-row">
                <button type="button" className="primary-button" disabled={busy !== null || invalid}
                  onClick={() => void run(format.id, async () => { await action("safe-zone.save", { format: format.id, rect }); await onChanged(); }, t(`${labels[format.id]} gespeichert`, `${labels[format.id]} saved`))}>
                  {t("Speichern", "Save")}
                </button>
                {invalid && <span className="vb-hint is-error">{t("Die Zone muss vollständig im Bild liegen.", "The zone must lie fully inside the image.")}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </Section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Download,
  ImagePlus,
  Languages as LanguagesIcon,
  Link2,
  Link2Off,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Square,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useFeedback } from "../../components/Feedback";
import { canDownloadCreative, guidelineOutcome } from "./approval";
import { api, ApiError, driveImageUrl, loadImage, uploadInParts } from "./client";
import { useI18n } from "./i18n";
import {
  CTA_PLACEMENTS,
  DEFAULT_CROP,
  DEFAULT_FIGURE,
  normalizeFigure,
  DEFAULT_HEADLINE,
  DEFAULT_ZONES,
  FORMATS,
  FORMAT_IDS,
  LOGO_PLACEMENTS,
  blockDefaults,
  clampToZone,
  closestFormat,
  fileBaseName,
  fitRectToZone,
  languageSuffix,
  perFormat,
  placeInZone,
} from "./layout";
import { badgePlain, brandColors, normalizeBadgeItem, normalizeFrame, normalizeStickerItem } from "./brand";
import { AssetTiles } from "./asset-tiles";
import { BadgeLinesEditor } from "./badge-lines-editor";
import { BadgePreview, CtaPreview, useTenantFonts } from "./brand-preview";
import { detectCutout } from "./cutout";
import { structuredCopy } from "./guideline-rules";
import { badgeRect, ctaLabel, ctaPlain, drawCanvas, measureContext, stickerSize, textCtaMetrics } from "./render";
import { htmlToPlain, plainToHtml } from "./rich-text";
import { InfoTip } from "./info-tip";
import { RichTextEditor } from "./rich-text-editor";
import { TextBoxOverlay } from "./text-box-overlay";
import { UploadDialog } from "./upload-dialog";
import type {
  Align,
  BadgeAsset,
  BadgeItem,
  Bootstrap,
  StickerAsset,
  StickerItem,
  Crop,
  CtaPlacement,
  DriveListing,
  FigureBox,
  Fmt,
  LogoPlacement,
  PerFormat,
  Point,
  Rect,
  TextBlock,
  Violation,
} from "./types";

type Pair = [TextBlock, TextBlock];
type Step = "image" | "text" | "brand" | "extras";
type LibraryImage = { id: string; path: string; name: string; folder: string; src: string; auto: Fmt; format: Fmt; override: Fmt | null; stored: boolean };

const SHARED_KEYS = ["html", "align", "color", "font", "frame"] as const;
const FALLBACK_FONT = "Arial";
const THUMB_EDGE = 600;

const placementLabel = (placement: string, t: (de: string, en: string) => string) => ({
  none: t("Ausblenden", "Hidden"),
  "top-left": t("Oben links", "Top left"),
  "top-center": t("Oben mittig", "Top center"),
  "top-right": t("Oben rechts", "Top right"),
  "bottom-left": t("Unten links", "Bottom left"),
  "bottom-center": t("Unten mittig", "Bottom center"),
  "bottom-right": t("Unten rechts", "Bottom right"),
  center: t("Mittig", "Center"),
}[placement] ?? placement);

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Export fehlgeschlagen."))), type, quality));
}

function thumbnail(canvas: HTMLCanvasElement): string {
  const factor = Math.min(1, THUMB_EDGE / Math.max(canvas.width, canvas.height));
  const small = document.createElement("canvas");
  small.width = Math.round(canvas.width * factor);
  small.height = Math.round(canvas.height * factor);
  small.getContext("2d")?.drawImage(canvas, 0, 0, small.width, small.height);
  return small.toDataURL("image/jpeg", 0.85);
}

const spread = <T,>(value: unknown, fallback: T): PerFormat<T> =>
  value && typeof value === "object" && !Array.isArray(value) && "1x1" in value
    ? { ...perFormat(() => fallback), ...(value as PerFormat<T>) }
    : perFormat(() => ((value ?? fallback) as T));

export function Editor({ bootstrap, active, loadRequest, onLoaded }: {
  bootstrap: Bootstrap;
  active: boolean;
  loadRequest: string | null;
  onLoaded: () => void;
}) {
  const { t, locale } = useI18n();
  const { notify } = useFeedback();
  const caps = bootstrap.capabilities;
  const fail = useCallback((error: unknown) => notify({ tone: "danger", title: t("Das hat nicht geklappt", "That did not work"), message: (error as Error).message }), [notify, t]);

  /* ---------- Fonts ---------- */
  const fontOptions = useMemo(() => [...new Set([...bootstrap.fonts.map((font) => font.family), FALLBACK_FONT])], [bootstrap.fonts]);
  const brand = bootstrap.brand;
  const colors = useMemo(() => brandColors(brand), [brand]);
  const knownFont = (family: string | null | undefined) => (family && fontOptions.includes(family) ? family : null);
  const baseFont = knownFont(brand.bodyFont) ?? knownFont(bootstrap.defaultFont) ?? fontOptions[0] ?? FALLBACK_FONT;
  const roleFont = [knownFont(brand.headlineFont) ?? baseFont, baseFont] as const;
  const roleColor = [brand.headlineColor ?? "#ffffff", brand.bodyColor ?? "#ffffff"] as const;
  /** Text boxes start in the brand font and colour of their role: 1 headline, 2 subline. */
  const brandBlock = (zone: Rect, index: 0 | 1, text?: string): TextBlock => ({ ...blockDefaults(zone, index, text), font: roleFont[index], color: roleColor[index] });
  const [fontFamily, setFontFamily] = useState(baseFont);
  const fontsReady = useTenantFonts(bootstrap.fonts);

  /* ---------- Safe zones ---------- */
  const zones = useMemo(() => perFormat((id) => bootstrap.safeZones[id] ?? DEFAULT_ZONES[id]), [bootstrap.safeZones]);

  /* ---------- Text blocks ---------- */
  const headline = DEFAULT_HEADLINE[locale];
  const [blocks, setBlocks] = useState<PerFormat<Pair>>(() =>
    perFormat((id) => [brandBlock(zones[id], 0, headline), brandBlock(zones[id], 1, headline)]));
  const setRoleFont = (index: 0 | 1, font: string) =>
    setBlocks((prev) => perFormat((id) => prev[id].map((block, position) => (position === index ? { ...block, font } : block)) as Pair));
  const customizedRef = useRef<PerFormat<boolean>>(perFormat(() => false));

  const previousLocale = useRef(locale);
  useEffect(() => {
    if (previousLocale.current === locale) return;
    const from = DEFAULT_HEADLINE[previousLocale.current];
    const to = DEFAULT_HEADLINE[locale];
    previousLocale.current = locale;
    setBlocks((prev) => {
      let changed = false;
      const next = perFormat((id) => prev[id].map((block) => (block.html === from ? ((changed = true), { ...block, html: to }) : block)) as Pair);
      return changed ? next : prev;
    });
  }, [locale]);

  const previousZones = useRef(zones);
  useEffect(() => {
    if (previousZones.current === zones) return;
    previousZones.current = zones;
    setBlocks((prev) => perFormat((id) => (customizedRef.current[id]
      ? [{ ...prev[id][0], rect: fitRectToZone(prev[id][0].rect, zones[id]) }, { ...prev[id][1], rect: fitRectToZone(prev[id][1].rect, zones[id]) }]
      : [{ ...prev[id][0], rect: blockDefaults(zones[id], 0).rect }, { ...prev[id][1], rect: blockDefaults(zones[id], 1).rect }])));
  }, [zones]);

  /* Linking: 1:1 is the source; other formats follow until they are customised. */
  const [individual, setIndividual] = useState<PerFormat<boolean>>(perFormat(() => false));
  const linkedTargets = (source: Fmt): Fmt[] => (individual[source] ? [] : FORMAT_IDS.filter((id) => id !== source && !individual[id]));

  const updateBlock = (fmt: Fmt, index: 0 | 1, patch: Partial<TextBlock>) => {
    const shared: Partial<TextBlock> = {};
    for (const key of SHARED_KEYS) if (key in patch) (shared as Record<string, unknown>)[key] = patch[key];
    const targets = Object.keys(shared).length > 0 ? linkedTargets(fmt) : [];
    setBlocks((prev) => {
      const next = { ...prev };
      const pair = [...prev[fmt]] as Pair;
      pair[index] = { ...pair[index], ...patch };
      next[fmt] = pair;
      for (const target of targets) {
        const targetPair = [...prev[target]] as Pair;
        targetPair[index] = { ...targetPair[index], ...shared };
        next[target] = targetPair;
      }
      return next;
    });
  };
  const moveBlock = (fmt: Fmt, index: 0 | 1, rect: Rect) => {
    customizedRef.current[fmt] = true;
    updateBlock(fmt, index, { rect });
  };
  const resetBoxes = (fmt: Fmt) => {
    customizedRef.current[fmt] = false;
    setBlocks((prev) => ({ ...prev, [fmt]: [{ ...prev[fmt][0], rect: blockDefaults(zones[fmt], 0).rect }, { ...prev[fmt][1], rect: blockDefaults(zones[fmt], 1).rect }] }));
  };

  /* ---------- Image library ---------- */
  const [libraryId, setLibraryId] = useState<string | null>(bootstrap.libraries[0]?.id ?? null);
  const library = bootstrap.libraries.find((entry) => entry.id === libraryId) ?? bootstrap.libraries[0] ?? null;
  const [listing, setListing] = useState<DriveListing | null>(null);
  const [listingBusy, setListingBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const refreshListing = useCallback(async () => {
    if (!library) {
      setListing({ configured: false, images: [], error: null });
      return;
    }
    setListingBusy(true);
    try {
      setListing(await api.library(library.id));
    } catch (error) {
      setListing({ configured: true, images: [], error: (error as Error).message });
    } finally {
      setListingBusy(false);
    }
  }, [library]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Loads the motif list for the chosen library.
    void refreshListing();
  }, [refreshListing]);

  const images = useMemo<LibraryImage[]>(() => {
    const examples = bootstrap.examples.map((image) => {
      const auto = closestFormat(image.width && image.height ? image.width / image.height : 1);
      return { id: image.id, path: `asset:${image.id}`, name: image.name, folder: "", src: image.url, auto, format: auto, override: null, stored: false };
    });
    const drive = (listing?.images ?? []).map((image) => {
      const auto = closestFormat(image.width && image.height ? image.width / image.height : 1);
      return { id: image.id, path: `drive:${image.id}`, name: image.name, folder: image.folder, src: image.thumb ?? driveImageUrl(image.id), auto, format: image.override ?? auto, override: image.override, stored: true };
    });
    return [...examples, ...drive];
  }, [bootstrap.examples, listing]);
  const [showAll, setShowAll] = useState<PerFormat<boolean>>(perFormat(() => false));
  const [step, setStep] = useState<PerFormat<Step>>(perFormat(() => "image"));

  const reassign = async (fileId: string, format: Fmt | null) => {
    try {
      await api.setImageFormat(fileId, format);
      setListing((current) => current && { ...current, images: current.images.map((image) => (image.id === fileId ? { ...image, override: format } : image)) });
    } catch (error) { fail(error); }
  };

  /* ---------- Backgrounds ---------- */
  const [bgPaths, setBgPaths] = useState<PerFormat<string | null>>(perFormat(() => null));
  const [bgImages, setBgImages] = useState<PerFormat<HTMLImageElement | null>>(perFormat(() => null));
  const [bgCrop, setBgCrop] = useState<PerFormat<Crop>>(perFormat(() => DEFAULT_CROP));
  const [bgColor, setBgColor] = useState<string | null>(null);

  /** Images picked from the computer live only in this tab (object URLs keyed by their `local:` path). */
  const localImagesRef = useRef<Record<string, string>>({});
  const sourceOf = (path: string | null) => path?.startsWith("drive:")
    ? driveImageUrl(path.slice(6))
    : path?.startsWith("asset:")
      ? bootstrap.examples.find((image) => image.id === path.slice(6))?.url
      : path ? localImagesRef.current[path] : undefined;
  const selectBg = async (fmt: Fmt, path: string | null, crop?: Crop) => {
    const source = sourceOf(path);
    setBgPaths((prev) => ({ ...prev, [fmt]: source ? path : null }));
    setBgCrop((prev) => ({ ...prev, [fmt]: crop ?? DEFAULT_CROP }));
    if (!source) {
      setBgImages((prev) => ({ ...prev, [fmt]: null }));
      return;
    }
    try {
      const image = await loadImage(source);
      setBgImages((prev) => ({ ...prev, [fmt]: image }));
    } catch {
      setBgImages((prev) => ({ ...prev, [fmt]: null }));
      notify({ tone: "warning", title: t("Motiv konnte nicht geladen werden", "Image could not be loaded") });
    }
  };

  /* ---------- Cut-out figures ---------- */
  const [figurePaths, setFigurePaths] = useState<PerFormat<string | null>>(perFormat(() => null));
  const [figureImages, setFigureImages] = useState<PerFormat<HTMLImageElement | null>>(perFormat(() => null));
  const [figure, setFigure] = useState<PerFormat<FigureBox>>(perFormat(() => ({ ...DEFAULT_FIGURE })));
  const [cutouts, setCutouts] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(bootstrap.examples.map((image) => [`asset:${image.id}`, image.cutout])));

  const placeFigure = (targets: Fmt[], path: string | null, image: HTMLImageElement | null) => {
    setFigurePaths((prev) => { const next = { ...prev }; for (const target of targets) next[target] = image ? path : null; return next; });
    setFigureImages((prev) => { const next = { ...prev }; for (const target of targets) next[target] = image; return next; });
  };
  /** Linked formats get the same relative position and size, so the figure sits alike in all three formats. */
  const updateFigure = (fmt: Fmt, box: FigureBox, everywhere = false) => {
    const targets = everywhere ? [...FORMAT_IDS] : [fmt, ...linkedTargets(fmt)];
    setFigure((prev) => { const next = { ...prev }; for (const target of targets) next[target] = { ...box }; return next; });
  };

  /** Loads a motif once and decides by its transparency whether it is a cut-out or a finished background. */
  const chooseMotif = async (fmt: Fmt, path: string) => {
    const source = sourceOf(path);
    if (!source) return;
    let image: HTMLImageElement;
    try {
      image = await loadImage(source);
    } catch {
      notify({ tone: "warning", title: t("Motiv konnte nicht geladen werden", "Image could not be loaded") });
      return;
    }
    const cutout = cutouts[path] ?? detectCutout(image);
    if (cutouts[path] === undefined) setCutouts((prev) => ({ ...prev, [path]: cutout }));
    if (!cutout) {
      await chooseBg(fmt, path);
      return;
    }
    placeFigure([fmt, ...linkedTargets(fmt)], path, image);
    notify({ tone: "info", title: t("Freisteller erkannt", "Cut-out detected"), message: t("Das Motiv liegt als eigene Ebene über dem Hintergrund. Position und Größe stellst du im Bild ein.", "The image sits as its own layer above the background. Set position and size in the image.") });
  };

  /** Picks a motif and loads siblings with the same base name into linked formats. */
  const chooseBg = async (fmt: Fmt, path: string | null) => {
    await selectBg(fmt, path);
    const targets = linkedTargets(fmt);
    if (targets.length === 0) return;
    if (!path) {
      for (const target of targets) await selectBg(target, null);
      return;
    }
    const chosen = images.find((image) => image.path === path);
    const base = fileBaseName(chosen?.name ?? path);
    for (const target of targets) {
      const sibling = images.find((image) => image.format === target && image.path !== path && fileBaseName(image.name) === base);
      if (sibling) await selectBg(target, sibling.path);
    }
  };
  const chooseLocalBg = async (fmt: Fmt, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify({ tone: "warning", title: t("Bitte eine Bilddatei wählen", "Please choose an image file") });
      return;
    }
    const path = `local:${crypto.randomUUID()}`;
    localImagesRef.current[path] = URL.createObjectURL(file);
    const image = await loadImage(localImagesRef.current[path]).catch(() => null);
    if (image && detectCutout(image)) {
      await chooseMotif(fmt, path);
      return;
    }
    await selectBg(fmt, path);
    for (const target of linkedTargets(fmt)) {
      if (!bgPaths[target]) await selectBg(target, path);
    }
  };
  useEffect(() => {
    const urls = localImagesRef.current;
    return () => { for (const url of Object.values(urls)) URL.revokeObjectURL(url); };
  }, []);

  /* ---------- Logo & button per format ---------- */
  const [logoId, setLogoId] = useState<PerFormat<string | null>>(perFormat(() => null));
  const [logoPlacement, setLogoPlacement] = useState<PerFormat<LogoPlacement>>(perFormat(() => "top-center"));
  const [logoScale, setLogoScale] = useState<PerFormat<number>>(perFormat(() => 15));
  const [logoPos, setLogoPos] = useState<PerFormat<Point | null>>(perFormat(() => null));
  const [ctaId, setCtaId] = useState<PerFormat<string | null>>(perFormat(() => null));
  const [ctaPlacement, setCtaPlacement] = useState<PerFormat<CtaPlacement>>(perFormat(() => "bottom-right"));
  const [ctaScale, setCtaScale] = useState<PerFormat<number>>(perFormat(() => 20));
  const [ctaPos, setCtaPos] = useState<PerFormat<Point | null>>(perFormat(() => null));
  const [ctaText, setCtaText] = useState<PerFormat<string>>(perFormat(() => ""));
  const [assetImages, setAssetImages] = useState<Record<string, HTMLImageElement>>({});
  const [badges, setBadges] = useState<PerFormat<BadgeItem[]>>(perFormat(() => []));

  /* ---------- Badges (price boxes, diamonds, starbursts) ---------- */
  const addBadge = (fmt: Fmt, template: BadgeAsset) => {
    const uid = crypto.randomUUID();
    const targets = [fmt, ...linkedTargets(fmt)];
    setBadges((prev) => {
      const next = { ...prev };
      for (const target of targets) {
        const zone = zones[target];
        const offset = prev[target].length * 4;
        next[target] = [...prev[target], {
          uid, name: template.name, shape: template.shape, colors: { ...template.colors },
          lines: template.lines.map((line) => ({ ...line })),
          pos: { x_pct: zone.x_pct + 2 + offset, y_pct: zone.y_pct + zone.h_pct * 0.3 + offset },
          scale: template.shape === "price-box" ? 32 : 26,
        }];
      }
      return next;
    });
  };
  /** Text changes and removal follow the linked formats; position and size stay per format. */
  const changeBadge = (fmt: Fmt, uid: string, patch: Partial<BadgeItem>, linked = false) => {
    const targets = linked ? [fmt, ...linkedTargets(fmt)] : [fmt];
    setBadges((prev) => {
      const next = { ...prev };
      for (const target of targets) next[target] = prev[target].map((item) => (item.uid === uid ? { ...item, ...patch } : item));
      return next;
    });
  };
  const removeBadge = (fmt: Fmt, uid: string) => {
    const targets = [fmt, ...linkedTargets(fmt)];
    setBadges((prev) => {
      const next = { ...prev };
      for (const target of targets) next[target] = prev[target].filter((item) => item.uid !== uid);
      return next;
    });
  };

  /* ---------- Stickers (leaves, arrows) ---------- */
  const [stickers, setStickers] = useState<PerFormat<StickerItem[]>>(perFormat(() => []));
  const addSticker = (fmt: Fmt, asset: StickerAsset) => {
    const uid = crypto.randomUUID();
    const targets = [fmt, ...linkedTargets(fmt)];
    setStickers((prev) => {
      const next = { ...prev };
      for (const target of targets) {
        next[target] = [...prev[target], { uid, assetId: asset.id, name: asset.name, x_pct: 75, y_pct: 75, scale: 50, rotate: 0, flip: false, behind: true }];
      }
      return next;
    });
  };
  /** Position, size and rotation stay per format; removal follows the linked formats. */
  const changeSticker = (fmt: Fmt, uid: string, patch: Partial<StickerItem>) =>
    setStickers((prev) => ({ ...prev, [fmt]: prev[fmt].map((item) => (item.uid === uid ? { ...item, ...patch } : item)) }));
  const removeSticker = (fmt: Fmt, uid: string) => {
    const targets = [fmt, ...linkedTargets(fmt)];
    setStickers((prev) => {
      const next = { ...prev };
      for (const target of targets) next[target] = prev[target].filter((item) => item.uid !== uid);
      return next;
    });
  };
  const stickerUrl = (item: StickerItem) => bootstrap.stickers.find((asset) => asset.id === item.assetId)?.url ?? null;

  const logoFor = (fmt: Fmt) => bootstrap.logos.find((logo) => logo.id === logoId[fmt]) ?? null;
  const ctaFor = (fmt: Fmt) => bootstrap.ctas.find((cta) => cta.id === ctaId[fmt]) ?? null;
  const logoImageFor = (fmt: Fmt) => {
    const url = logoFor(fmt)?.url;
    return (url && assetImages[url]) || null;
  };
  const ctaImageFor = (fmt: Fmt) => {
    const cta = ctaFor(fmt);
    return cta?.variant === "graphic" && cta.url ? assetImages[cta.url] ?? null : null;
  };

  const neededAssetUrls = FORMAT_IDS.flatMap((fmt) => {
    const cta = ctaFor(fmt);
    return [logoFor(fmt)?.url, cta?.variant === "graphic" ? cta.url : null, ...stickers[fmt].map(stickerUrl)];
  }).filter((url): url is string => Boolean(url) && !assetImages[url!]);
  const missingKey = [...new Set(neededAssetUrls)].sort().join("|");
  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    void (async () => {
      const loaded: Record<string, HTMLImageElement> = {};
      for (const url of missingKey.split("|")) {
        try { loaded[url] = await loadImage(url); } catch { /* Missing assets are simply not drawn. */ }
      }
      if (!cancelled && Object.keys(loaded).length) setAssetImages((prev) => ({ ...prev, ...loaded }));
    })();
    return () => { cancelled = true; };
  }, [missingKey]);

  const forLinked = <T,>(fmt: Fmt, setter: React.Dispatch<React.SetStateAction<PerFormat<T>>>, value: T) => {
    const targets = [fmt, ...linkedTargets(fmt)];
    setter((prev) => {
      const next = { ...prev };
      for (const target of targets) next[target] = value;
      return next;
    });
  };
  const setCtaForFormat = (fmt: Fmt, id: string | null) => {
    forLinked(fmt, setCtaId, id);
    const cta = bootstrap.ctas.find((entry) => entry.id === id);
    if (cta?.variant === "text") forLinked(fmt, setCtaText, cta.text || cta.name || "");
  };

  /* ---------- Drawing ---------- */
  const canvasRefs = useRef<PerFormat<HTMLCanvasElement | null>>(perFormat(() => null));
  const emptyLabel = t("Bitte Hintergrundbild wählen", "Please select a background image");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await Promise.all([fontFamily, ...fontOptions].flatMap((family) => [
          ...[400, 500, 600, 700, 800, 900].map((weight) => document.fonts.load(`${weight} 32px "${family}"`)),
          document.fonts.load(`italic 400 32px "${family}"`),
          document.fonts.load(`italic 800 32px "${family}"`),
        ]));
      } catch {
        /* Drawing continues with fallback fonts. */
      }
      if (cancelled) return;
      for (const format of FORMATS) {
        const canvas = canvasRefs.current[format.id];
        if (!canvas) continue;
        drawCanvas({
          canvas,
          w: format.w,
          h: format.h,
          bg: bgImages[format.id],
          crop: bgCrop[format.id],
          bgColor,
          figure: figureImages[format.id],
          figureBox: figure[format.id],
          blocks: blocks[format.id],
          fontFamily,
          logo: logoImageFor(format.id),
          logoPlacement: logoPlacement[format.id],
          logoPos: logoPos[format.id],
          logoScale: logoScale[format.id],
          cta: ctaFor(format.id),
          ctaText: ctaText[format.id],
          ctaImg: ctaImageFor(format.id),
          ctaPlacement: ctaPlacement[format.id],
          ctaPos: ctaPos[format.id],
          ctaScale: ctaScale[format.id],
          safeZone: zones[format.id],
          emptyLabel,
          ctaFont: fontFamily,
          badges: badges[format.id],
          badgeFont: fontFamily,
          stickers: stickers[format.id].map((item) => {
            const url = stickerUrl(item);
            return { item, image: url ? assetImages[url] ?? null : null };
          }),
        });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Lookup helpers derive from the listed state.
  }, [bgImages, bgCrop, bgColor, figureImages, figure, blocks, badges, stickers, fontFamily, fontOptions, fontsReady, assetImages, bootstrap.logos, bootstrap.ctas,
    logoId, logoPlacement, logoScale, logoPos, ctaId, ctaPlacement, ctaScale, ctaText, ctaPos, zones, emptyLabel, active]);

  /* ---------- Translation & guideline check ---------- */
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [translating, setTranslating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [checkedText, setCheckedText] = useState<string | null>(null);
  const [guidelineCheckId, setGuidelineCheckId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  const allPlainText = () => structuredCopy(FORMATS.flatMap((format) => {
    const cta = ctaFor(format.id);
    return [
      { role: "headline" as const, format: format.label, text: htmlToPlain(blocks[format.id][0].html) },
      { role: "subline" as const, format: format.label, text: htmlToPlain(blocks[format.id][1].html) },
      ...badges[format.id].map((item) => ({ role: "badge" as const, format: format.label, text: badgePlain(item.lines) })),
      ...(cta?.variant === "text" && ctaPlacement[format.id] !== "none" ? [{ role: "button" as const, format: format.label, text: ctaPlain(ctaLabel(cta, ctaText[format.id])) }] : []),
    ];
  }));
  const currentPlain = allPlainText();
  const outcome = guidelineOutcome(checkedText, currentPlain, guidelineCheckId, violations.length === 0);
  const canDownload = canDownloadCreative(outcome);
  const activeLanguages = bootstrap.languages.filter((language) => language.active);

  const doTranslate = async () => {
    if (!selectedLanguage) return;
    setTranslating(true);
    try {
      const label = bootstrap.languages.find((language) => language.code === selectedLanguage)?.label ?? selectedLanguage;
      const items: Array<{ key: string; text: string; isHtml: boolean }> = [];
      for (const id of FORMAT_IDS) {
        blocks[id].forEach((block, index) => {
          const plain = htmlToPlain(block.html);
          if (plain) items.push({ key: `${id}:${index}`, text: block.html?.trim() || plainToHtml(plain), isHtml: true });
        });
        const text = ctaText[id]?.trim();
        if (ctaFor(id)?.variant === "text" && text) items.push({ key: `cta:${id}`, text, isHtml: false });
        for (const item of badges[id]) {
          item.lines.forEach((line, index) => { if (line.text.trim()) items.push({ key: `badge:${id}:${item.uid}:${index}`, text: line.text, isHtml: false }); });
        }
      }
      if (items.length === 0) return;
      const { translations } = await api.translate(items, selectedLanguage, label);
      setBlocks((prev) => perFormat((id) => prev[id].map((block, index) => {
        const translated = translations[`${id}:${index}`]?.trim();
        return translated ? { ...block, html: translated } : block;
      }) as Pair));
      setCtaText((prev) => perFormat((id) => translations[`cta:${id}`]?.trim() || prev[id]));
      setBadges((prev) => perFormat((id) => prev[id].map((item) => ({
        ...item,
        lines: item.lines.map((line, index) => ({ ...line, text: translations[`badge:${id}:${item.uid}:${index}`]?.trim() || line.text })),
      }))));
      notify({ tone: "success", title: t("Übersetzt", "Translated") });
    } catch (error) {
      fail(error);
    } finally {
      setTranslating(false);
    }
  };

  const doCheck = async () => {
    setChecking(true);
    setViolations([]);
    setCheckedText(null);
    setGuidelineCheckId(null);
    const text = allPlainText();
    try {
      const result = await api.check(text, locale);
      setViolations(result.violations);
      setCheckedText(text);
      setGuidelineCheckId(result.checkId);
      if (result.violations.length === 0) {
        notify({ tone: "success", title: text.trim() ? t("Keine Verstöße gefunden", "No violations found") : t("Kein Text enthalten – nichts zu prüfen", "No text included – nothing to check") });
      } else {
        notify({
          tone: "warning",
          title: t(`${result.violations.length} Hinweise – nicht abgenommen`, `${result.violations.length} findings – not signed off`),
          message: t("Du kannst trotzdem herunterladen; die Dateien sind dann als nicht abgenommen markiert.", "You can still download; the files are marked as not signed off."),
        });
      }
    } catch (error) {
      fail(error);
    } finally {
      setChecking(false);
    }
  };

  /* ---------- Export & archive ---------- */
  const buildZip = async () => {
    const zip = new JSZip();
    const suffix = languageSuffix(selectedLanguage);
    const thumbs: Partial<Record<Fmt, string>> = {};
    for (const format of FORMATS) {
      const canvas = canvasRefs.current[format.id];
      if (!canvas) continue;
      zip.file(`creative_${format.id}${suffix}.png`, await canvasBlob(canvas, "image/png"));
      thumbs[format.id] = thumbnail(canvas);
    }
    return { blob: await zip.generateAsync({ type: "blob" }), thumbs, suffix };
  };

  const doExport = async () => {
    if (!canDownload) {
      notify({ tone: "danger", title: t("Bitte zuerst die Richtlinien prüfen.", "Please run the guideline check first.") });
      return;
    }
    setExporting(true);
    try {
      const { blob, suffix } = await buildZip();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `visual-builder${suffix}${outcome === "flagged" ? "-nicht-abgenommen" : ""}-${Date.now()}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(outcome === "approved"
        ? { tone: "success", title: t("ZIP heruntergeladen", "ZIP downloaded") }
        : { tone: "warning", title: t("ZIP heruntergeladen – nicht final abgenommen", "ZIP downloaded – not signed off"), message: t("Die Prüfung hat Hinweise gemeldet. Bitte vor der Veröffentlichung klären.", "The check reported findings. Please resolve them before publishing.") });
    } catch (error) {
      fail(error);
    } finally {
      setExporting(false);
    }
  };

  const buildState = () => ({
    v: 1 as const,
    blocks, bgPaths, bgCrop, bgColor, figurePaths, figure, fontFamily,
    logoId, logoPlacement, logoPos, logoScale,
    ctaId, ctaPlacement, ctaPos, ctaScale, ctaText, badges, stickers,
    selectedLanguage, individual,
    libraryId: library?.id ?? null,
  });

  const doSave = async () => {
    setSaving(true);
    try {
      const { blob, thumbs, suffix } = await buildZip();
      const upload = await uploadInParts(blob);
      const response = await fetch("/api/visual-builder/creatives", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload,
          thumbs,
          sourceText: currentPlain,
          languageCode: selectedLanguage || null,
          state: buildState(),
          guidelineCheckId: outcome === "none" ? null : guidelineCheckId,
          fileLabel: `visual-builder${suffix}`,
        }),
      });
      const body = await response.json().catch(() => null) as { error?: string; guidelineStatus?: string } | null;
      if (!response.ok) throw new ApiError(body?.error || t("Speichern fehlgeschlagen.", "Saving failed."), response.status);
      notify({
        tone: "success",
        title: t("Im Archiv gespeichert", "Saved to archive"),
        message: body?.guidelineStatus === "approved"
          ? t("Geprüft – der Download ist im Archiv freigegeben.", "Checked – the download is enabled in the archive.")
          : body?.guidelineStatus === "flagged"
            ? t("Nicht abgenommen – im Archiv als solches markiert, Download möglich.", "Not signed off – marked as such in the archive, download available.")
            : t("Noch nicht geprüft – der Download im Archiv folgt nach der Prüfung.", "Not checked yet – the archive download follows a check."),
      });
    } catch (error) {
      fail(error);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Restore an archived project ---------- */
  const restoringRef = useRef<string | null>(null);
  useEffect(() => {
    if (!loadRequest || restoringRef.current === loadRequest) return;
    restoringRef.current = loadRequest;
    void (async () => {
      try {
        const { state } = await api.creativeState(loadRequest);
        const st = state as Record<string, unknown> | null;
        if (!st) {
          notify({ tone: "warning", title: t("Für dieses Projekt sind keine Editor-Daten gespeichert", "No editor data stored for this project") });
          return;
        }
        setCheckedText(null);
        setGuidelineCheckId(null);
        setViolations([]);
        if (st.blocks && typeof st.blocks === "object") {
          const stored = st.blocks as Partial<PerFormat<Pair>>;
          setBlocks((prev) => perFormat((id) => {
            const pair = stored[id];
            return pair ? [
              { ...prev[id][0], ...pair[0], rect: fitRectToZone(pair[0].rect, zones[id]), frame: normalizeFrame(pair[0].frame) },
              { ...prev[id][1], ...pair[1], rect: fitRectToZone(pair[1].rect, zones[id]), frame: normalizeFrame(pair[1].frame) },
            ] : prev[id];
          }));
          customizedRef.current = perFormat(() => true);
        }
        if (typeof st.fontFamily === "string") setFontFamily(st.fontFamily);
        setLogoId(spread<string | null>(st.logoId, null));
        setLogoPlacement(spread<LogoPlacement>(st.logoPlacement, "top-center"));
        setLogoPos(spread<Point | null>(st.logoPos, null));
        setLogoScale(spread<number>(st.logoScale, 15));
        setCtaId(spread<string | null>(st.ctaId, null));
        setCtaPlacement(spread<CtaPlacement>(st.ctaPlacement, "bottom-right"));
        setCtaScale(spread<number>(st.ctaScale, 20));
        setCtaPos(spread<Point | null>(st.ctaPos, null));
        setCtaText(spread<string>(st.ctaText, ""));
        const storedBadges = (st.badges ?? {}) as Partial<PerFormat<unknown>>;
        setBadges(perFormat((id) => (Array.isArray(storedBadges[id]) ? (storedBadges[id] as unknown[]) : [])
          .map(normalizeBadgeItem).filter((item): item is BadgeItem => item !== null)));
        const storedStickers = (st.stickers ?? {}) as Partial<PerFormat<unknown>>;
        setStickers(perFormat((id) => (Array.isArray(storedStickers[id]) ? (storedStickers[id] as unknown[]) : [])
          .map(normalizeStickerItem).filter((item): item is StickerItem => item !== null)));
        setSelectedLanguage(typeof st.selectedLanguage === "string" ? st.selectedLanguage : "");
        if (st.individual && typeof st.individual === "object") setIndividual(spread<boolean>(st.individual, false));
        if (typeof st.libraryId === "string" && bootstrap.libraries.some((entry) => entry.id === st.libraryId)) setLibraryId(st.libraryId);
        const paths = (st.bgPaths ?? {}) as Partial<PerFormat<string | null>>;
        const crops = (st.bgCrop ?? {}) as Partial<PerFormat<Crop>>;
        for (const id of FORMAT_IDS) await selectBg(id, paths[id] ?? null, crops[id]);
        setBgColor(typeof st.bgColor === "string" && /^#[0-9a-f]{6}$/i.test(st.bgColor) ? st.bgColor : null);
        const storedFigure = (st.figure ?? {}) as Partial<PerFormat<unknown>>;
        setFigure(perFormat((id) => normalizeFigure(storedFigure[id])));
        const figureStored = (st.figurePaths ?? {}) as Partial<PerFormat<string | null>>;
        for (const id of FORMAT_IDS) {
          const source = sourceOf(figureStored[id] ?? null);
          placeFigure([id], figureStored[id] ?? null, source ? await loadImage(source).catch(() => null) : null);
        }
        const missingLocal = FORMAT_IDS.some((id) => [paths[id], figureStored[id]].some((path) => path?.startsWith("local:") && !localImagesRef.current[path]));
        notify(missingLocal
          ? { tone: "warning", title: t("Projekt geladen", "Project loaded"), message: t("Motive vom Rechner werden nicht gespeichert. Bitte das Motiv erneut wählen.", "Images from your computer are not stored. Please choose the image again.") }
          : { tone: "success", title: t("Projekt zum Bearbeiten geladen", "Project loaded for editing") });
      } catch (error) {
        fail(error);
      } finally {
        restoringRef.current = null;
        onLoaded();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Runs once per load request.
  }, [loadRequest]);

  /* ---------- Movable frames ---------- */
  const logoRectFor = (format: (typeof FORMATS)[number]): Rect | null => {
    const image = logoImageFor(format.id);
    if (!image) return null;
    const shorter = Math.min(format.w, format.h);
    const lw = (logoScale[format.id] / 100) * shorter;
    const lh = lw / (image.width / image.height);
    const point = logoPos[format.id];
    const raw = point
      ? { x: (point.x_pct / 100) * format.w, y: (point.y_pct / 100) * format.h }
      : placeInZone(logoPlacement[format.id], lw, lh, zones[format.id], format.w, format.h, shorter * 0.03);
    const pos = clampToZone(raw.x, raw.y, lw, lh, zones[format.id], format.w, format.h);
    return { x_pct: (pos.x / format.w) * 100, y_pct: (pos.y / format.h) * 100, w_pct: (lw / format.w) * 100, h_pct: (lh / format.h) * 100 };
  };

  const ctaRectFor = (format: (typeof FORMATS)[number]): Rect | null => {
    const cta = ctaFor(format.id);
    if (!cta || ctaPlacement[format.id] === "none") return null;
    const shorter = Math.min(format.w, format.h);
    const targetW = (ctaScale[format.id] / 100) * shorter;
    let cw: number;
    let ch: number;
    if (cta.variant === "graphic") {
      const image = ctaImageFor(format.id);
      if (!image) return null;
      cw = targetW;
      ch = targetW / (image.width / image.height);
    } else {
      const context = measureContext();
      if (!context) return null;
      const metrics = textCtaMetrics(context, cta, ctaLabel(cta, ctaText[format.id]), targetW, fontFamily);
      cw = metrics.width;
      ch = metrics.height;
    }
    const point = ctaPos[format.id];
    const raw = point
      ? { x: (point.x_pct / 100) * format.w, y: (point.y_pct / 100) * format.h }
      : placeInZone(ctaPlacement[format.id], cw, ch, zones[format.id], format.w, format.h, shorter * 0.03);
    const pos = clampToZone(raw.x, raw.y, cw, ch, zones[format.id], format.w, format.h);
    return { x_pct: (pos.x / format.w) * 100, y_pct: (pos.y / format.h) * 100, w_pct: (cw / format.w) * 100, h_pct: (ch / format.h) * 100 };
  };

  const textChangedSinceCheck = checkedText !== null && checkedText !== currentPlain;

  return (
    <div className="vb-editor">
      <div className="vb-actionbar">
        {bootstrap.libraries.length > 1 && (
          <label className="vb-inline-field">
            <span>{t("Bildbibliothek", "Image library")}</span>
            <select className="vb-select" value={library?.id ?? ""} onChange={(event) => setLibraryId(event.target.value)}>
              {bootstrap.libraries.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
          </label>
        )}
        {caps.upload && library && listing?.configured && (
          <button type="button" className="icon-text-btn" onClick={() => setUploadOpen(true)}>
            <ImagePlus size={16} /> {t("Bilder hochladen", "Upload images")}
          </button>
        )}
        <span className="vb-actionbar-spacer" />
        <span className="vb-actionbar-group">
          <select className="vb-select vb-select-compact" value={selectedLanguage} aria-label={t("Zielsprache", "Target language")} disabled={activeLanguages.length === 0}
            onChange={(event) => setSelectedLanguage(event.target.value)}>
            <option value="">{t("Sprache wählen", "Choose language")}</option>
            {activeLanguages.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
          </select>
          <button type="button" className="icon-text-btn" onClick={() => void doTranslate()} disabled={!caps.create || !selectedLanguage || translating}>
            {translating ? <LoaderCircle className="spin" size={15} /> : <LanguagesIcon size={15} />} {t("Übersetzen", "Translate")}
          </button>
          {activeLanguages.length === 0 && <InfoTip align="end" text={t("Noch keine Sprachen hinterlegt (Einstellungen → Sprachen).", "No languages yet (Settings → Languages).")} />}
        </span>
        <span className="vb-actionbar-group">
          <button type="button" className="secondary-btn" onClick={() => void doCheck()} disabled={!caps.create || checking}>
            {checking ? <LoaderCircle className="spin" size={16} /> : <ShieldCheck size={16} />} {t("Richtlinien prüfen", "Check guidelines")}
          </button>
          {outcome === "approved" ? <span className="status-pill success">{t("Geprüft", "Checked")}</span>
            : outcome === "flagged" ? <span className="status-pill critical">{t("Nicht abgenommen", "Not signed off")}</span>
            : <span className="status-pill warning">{textChangedSinceCheck ? t("Text geändert – neu prüfen", "Text changed – check again") : t("Noch nicht geprüft", "Not checked yet")}</span>}
          <InfoTip align="end" text={t(
            "Geprüft werden alle Texte (Headline, Subline, Störer, Button) gegen die hinterlegten CI-Richtlinien und die Liste verbotener Wörter. Herunterladen geht nach jeder Prüfung; mit Hinweisen ist das Werbemittel als nicht abgenommen markiert.",
            "All texts (headline, subline, badges, button) are checked against the saved CI guidelines and the forbidden-word list. Downloading works after every check; with findings the creative is marked as not signed off.",
          )} />
        </span>
        <button type="button" className="secondary-btn" title={t("Im Archiv speichern", "Save to archive")} onClick={() => void doSave()} disabled={!caps.create || saving}>
          {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
          {t("Speichern", "Save")}
        </button>
        <span title={canDownload
          ? outcome === "flagged" ? t("Download möglich, aber nicht final abgenommen", "Download available, but not signed off") : undefined
          : t("Bitte zuerst die Richtlinien prüfen", "Please run the guideline check first")}>
          <button type="button" className="primary-button" onClick={() => void doExport()} disabled={exporting || !canDownload}>
            {exporting ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}
            {t("ZIP herunterladen", "Download ZIP")}
          </button>
        </span>
      </div>

      {outcome === "flagged" && (
        <div className="vb-violations" role="status">
          <p><ShieldAlert size={14} aria-hidden="true" /> {t("Nicht abgenommen – Download möglich, bitte diese Hinweise klären:", "Not signed off – download available, please resolve these findings:")}</p>
          <ul>{violations.map((violation, index) => <li key={index}><strong>{violation.rule}:</strong> {violation.message}</li>)}</ul>
        </div>
      )}

        {FORMATS.map((format) => {
          const matching = images.filter((image) => showAll[format.id] || image.format === format.id || (cutouts[image.path] ?? /freisteller/i.test(image.name)));
          const figureImage = figureImages[format.id];
          const box = figure[format.id];
          const shownColor = bgColor ?? (figureImage ? "#000000" : null);
          const exampleCount = matching.filter((image) => image.path.startsWith("asset:")).length;
          const sourceLabel = exampleCount === matching.length
            ? t("Motive", "images")
            : exampleCount === 0
              ? t("aus Google Drive", "from Google Drive")
              : t("Motive", "images");
          const activeImage = bgImages[format.id];
          const activeRatio = activeImage ? activeImage.width / activeImage.height : format.ratio;
          const crop = bgCrop[format.id];
          const canPanX = Boolean(activeImage) && (activeRatio > format.ratio + 0.001 || crop.zoom > 1);
          const canPanY = Boolean(activeImage) && (activeRatio < format.ratio - 0.001 || crop.zoom > 1);
          const activePath = bgPaths[format.id];
          const pair = blocks[format.id];
          const linked = !individual[format.id];
          const steps: { id: Step; label: string; done: boolean }[] = [
            { id: "image", label: t("Bild", "Image"), done: Boolean(activePath || figurePaths[format.id]) },
            { id: "text", label: "Text", done: pair.some((block) => !["", headline].includes(htmlToPlain(block.html).trim())) },
            { id: "brand", label: t("Logo & Button", "Logo & button"), done: Boolean(logoId[format.id] || ctaId[format.id]) },
            ...(bootstrap.badges.length + bootstrap.stickers.length > 0
              ? [{ id: "extras" as const, label: t("Störer & Grafiken", "Badges & graphics"), done: badges[format.id].length + stickers[format.id].length > 0 }]
              : []),
          ];
          const current = steps.some((entry) => entry.id === step[format.id]) ? step[format.id] : "image";
          const openStep = (id: Step) => setStep((prev) => ({ ...prev, [format.id]: id }));
          return (
            <section key={format.id} className="vb-card vb-format">
              <header className="vb-format-head">
                <h2>{format.label} <span>{format.w}×{format.h}</span></h2>
                <div className="vb-format-actions">
                  <button
                    type="button"
                    className={`icon-text-btn${linked ? "" : " is-active"}`}
                    aria-pressed={!linked}
                    title={linked ? t("Änderungen an Text, Logo und Button gelten auch für die anderen verknüpften Formate.", "Changes to text, logo and button also apply to the other linked formats.") : undefined}
                    onClick={() => setIndividual((prev) => ({ ...prev, [format.id]: !prev[format.id] }))}
                  >
                    {linked ? <Link2 size={15} /> : <Link2Off size={15} />}
                    {linked ? t("Individualisieren", "Customize") : t("Individuell (verknüpfen)", "Individual (link)")}
                  </button>
                </div>
              </header>
              <div className="vb-format-body">
                <div className="vb-stage-col">
                  <div className="vb-stage" style={{ maxWidth: `min(${Math.min(format.w, 600)}px, calc((100vh - 160px) * ${format.w / format.h}))` }}>
                    <div className="vb-stage-inner" style={{ aspectRatio: `${format.w} / ${format.h}` }}>
                      <canvas ref={(element) => { canvasRefs.current[format.id] = element; }} width={format.w} height={format.h} />
                      <TextBoxOverlay
                        safeZone={zones[format.id]}
                        rects={[pair[0].rect, pair[1].rect]}
                        onChange={(index, rect) => moveBlock(format.id, index, rect)}
                        logoRect={logoRectFor(format)}
                        onLogoMove={(x_pct, y_pct) => setLogoPos((prev) => ({ ...prev, [format.id]: { x_pct, y_pct } }))}
                        ctaRect={ctaRectFor(format)}
                        onCtaMove={(x_pct, y_pct) => setCtaPos((prev) => ({ ...prev, [format.id]: { x_pct, y_pct } }))}
                        badges={badges[format.id].map((item) => {
                          const rect = badgeRect(item, format.w, format.h);
                          return { uid: item.uid, rect: { x_pct: (rect.x / format.w) * 100, y_pct: (rect.y / format.h) * 100, w_pct: (rect.w / format.w) * 100, h_pct: (rect.h / format.h) * 100 } };
                        })}
                        onBadgeMove={(uid, x_pct, y_pct) => changeBadge(format.id, uid, { pos: { x_pct, y_pct } })}
                        stickers={stickers[format.id].flatMap((item) => {
                          const url = stickerUrl(item);
                          const image = url ? assetImages[url] : null;
                          if (!image) return [];
                          const size = stickerSize(item, image.width / image.height, format.w, format.h);
                          return [{ uid: item.uid, cx: item.x_pct, cy: item.y_pct, w: (size.w / format.w) * 100, h: (size.h / format.h) * 100, rotate: item.rotate, scale: item.scale }];
                        })}
                        onStickerChange={(uid, patch) => changeSticker(format.id, uid, patch)}
                        figure={figureImage ? box : null}
                        figureWidthFactor={figureImage ? (figureImage.width / figureImage.height) * (format.h / format.w) : 1}
                        onFigureChange={(next) => updateFigure(format.id, next)}
                        onPick={(kind) => openStep(kind === "text" ? "text" : kind === "figure" ? "image" : kind === "logo" || kind === "cta" ? "brand" : "extras")}
                      />
                    </div>
                  </div>
                </div>

                <div className="vb-inspector">
                  <div className="vb-steps" role="tablist" aria-label={`${t("Arbeitsschritte", "Steps")} ${format.label}`}>
                    {steps.map((entry, position) => (
                      <button key={entry.id} type="button" role="tab" aria-selected={current === entry.id} className={`vb-step${current === entry.id ? " is-active" : ""}`} onClick={() => openStep(entry.id)}>
                        <span className={`vb-step-num${entry.done ? " is-done" : ""}`}>{entry.done ? <Check size={11} aria-hidden="true" /> : position + 1}</span>
                        {entry.label}
                      </button>
                    ))}
                  </div>

                  <div role="tabpanel" className="vb-step-panel">
                    {current === "image" && (
                      <>
                        <div className="vb-motifs-head">
                          <strong>{t("Motiv wählen", "Choose image")}</strong>
                          <span className="vb-count">{matching.length} {sourceLabel}</span>
                          <span className="vb-actionbar-spacer" />
                          <button type="button" className={`vb-tool vb-tool-text${showAll[format.id] ? " is-active" : ""}`} aria-pressed={showAll[format.id]}
                            title={t("Auch Bilder anderer Formate zeigen", "Also show images of other formats")} onClick={() => setShowAll((prev) => ({ ...prev, [format.id]: !prev[format.id] }))}>
                            {t("Alle Formate", "All formats")}
                          </button>
                          <button type="button" className="vb-tool" disabled={listingBusy} onClick={() => void refreshListing()} aria-label={t("Aktualisieren", "Refresh")} title={t("Aktualisieren", "Refresh")}>
                            {listingBusy ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}
                          </button>
                          <label className="vb-tool vb-tool-text" title={t("Eigenes Bild nur für dieses Projekt, wird nicht in Google Drive gespeichert", "Own image for this project only, not stored in Google Drive")}>
                            <ImagePlus size={14} /> {t("Vom Rechner", "From computer")}
                            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { void chooseLocalBg(format.id, event.target.files?.[0]); event.target.value = ""; }} />
                          </label>
                        </div>
                        {matching.length === 0 && listing === null ? (
                          <p className="vb-hint"><LoaderCircle className="spin" size={13} /> {t("Google Drive wird geladen…", "Loading Google Drive…")}</p>
                        ) : matching.length === 0 && listing && !listing.configured ? (
                          <p className="vb-hint">{t("Noch keine Bildbibliothek verbunden – nutze „Vom Rechner“.", "No image library connected yet – use “From computer”.")} <InfoTip text={t("Google Drive richtest du in den Einstellungen ein; Motive lassen sich dort auch direkt hochladen.", "Set up Google Drive in Settings; images can also be uploaded there.")} /></p>
                        ) : matching.length === 0 && listing?.error ? (
                          <p className="vb-hint is-error">{listing.error}</p>
                        ) : matching.length === 0 ? (
                          <p className="vb-hint">{t("Kein passendes Motiv.", "No matching image.")}</p>
                        ) : (
                          <div className="vb-motif-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${format.ratio >= 1.5 ? 140 : format.ratio <= 0.7 ? 80 : 110}px, 1fr))` }}>
                            {matching.map((image) => (
                              <div key={image.path} className="vb-motif">
                                <button
                                  type="button"
                                  onClick={() => void chooseMotif(format.id, image.path)}
                                  title={`${image.folder ? `${image.folder}/` : ""}${image.name}`}
                                  aria-pressed={activePath === image.path || figurePaths[format.id] === image.path}
                                  className={`vb-motif-button${activePath === image.path || figurePaths[format.id] === image.path ? " is-active" : ""}${cutouts[image.path] ? " is-cutout" : ""}`}
                                  style={{ aspectRatio: format.ratio }}
                                >
                                  {cutouts[image.path] && <span className="vb-motif-badge">{t("Freisteller", "Cut-out")}</span>}
                                  {/* eslint-disable-next-line @next/next/no-img-element -- Drive preview; falls back to the same-origin proxy. */}
                                  <img
                                    src={image.src}
                                    alt={image.name}
                                    referrerPolicy="no-referrer"
                                    loading="lazy"
                                    onError={(event) => {
                                      if (!image.stored) return;
                                      const fallback = driveImageUrl(image.id);
                                      if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback;
                                    }}
                                  />
                                </button>
                                {image.stored ? (
                                  <select className="vb-select vb-select-tiny vb-motif-assign" value={image.override ?? "auto"} disabled={!caps.create} aria-label={t("Format zuordnen", "Assign format")}
                                    onChange={(event) => void reassign(image.id, event.target.value === "auto" ? null : (event.target.value as Fmt))}>
                                    <option value="auto">Auto ({FORMATS.find((entry) => entry.id === image.auto)!.label})</option>
                                    {FORMATS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                                  </select>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                        {activeImage && (
                          <div className="vb-crop-controls">
                            <div className="vb-figure-head">
                              <strong>{t("Ausschnitt", "Crop")}</strong>
                              <button type="button" className="vb-tool" onClick={() => void chooseBg(format.id, null)}>{t("Hintergrund entfernen", "Remove background")}</button>
                            </div>
                            <label className="vb-field">
                              <span>{t("Horizontal", "Horizontal")}</span>
                              <input type="range" min={0} max={1} step={0.01} disabled={!canPanX} value={crop.x} onChange={(event) => setBgCrop((prev) => ({ ...prev, [format.id]: { ...prev[format.id], x: Number(event.target.value) } }))} />
                            </label>
                            <label className="vb-field">
                              <span>{t("Vertikal", "Vertical")}</span>
                              <input type="range" min={0} max={1} step={0.01} disabled={!canPanY} value={crop.y} onChange={(event) => setBgCrop((prev) => ({ ...prev, [format.id]: { ...prev[format.id], y: Number(event.target.value) } }))} />
                            </label>
                            <label className="vb-field">
                              <span>Zoom: {crop.zoom.toFixed(2)}×</span>
                              <input type="range" min={1} max={3} step={0.01} value={crop.zoom} onChange={(event) => setBgCrop((prev) => ({ ...prev, [format.id]: { ...prev[format.id], zoom: Number(event.target.value) } }))} />
                            </label>
                          </div>
                        )}
                        {figureImage && (
                          <div className="vb-crop-controls">
                            <div className="vb-figure-head">
                              <strong>{t("Freisteller", "Cut-out")}</strong>
                              <button type="button" className={`vb-tool${box.flip ? " is-active" : ""}`} aria-pressed={box.flip} onClick={() => updateFigure(format.id, { ...box, flip: !box.flip })}>{t("Spiegeln", "Flip")}</button>
                              <button type="button" className="vb-tool" title={t("Gleiche Position und Größe in allen drei Formaten", "Same position and size in all three formats")} onClick={() => {
                                updateFigure(format.id, box, true);
                                const path = figurePaths[format.id];
                                placeFigure(FORMAT_IDS.filter((id) => id !== format.id), path, figureImage);
                              }}>{t("Für alle Formate", "All formats")}</button>
                              <button type="button" className="vb-tool" onClick={() => updateFigure(format.id, { ...DEFAULT_FIGURE, flip: box.flip })}>{t("Zurücksetzen", "Reset")}</button>
                              <button type="button" className="vb-tool" onClick={() => placeFigure([format.id, ...linkedTargets(format.id)], null, null)}>{t("Entfernen", "Remove")}</button>
                            </div>
                            <label className="vb-field">
                              <span>{t("Größe", "Size")}: {Math.round(box.h_pct)}% {t("der Bildhöhe", "of the height")}</span>
                              <input type="range" min={10} max={200} step={1} value={box.h_pct} onChange={(event) => updateFigure(format.id, { ...box, h_pct: Number(event.target.value) })} />
                            </label>
                            <label className="vb-field">
                              <span>{t("Horizontal", "Horizontal")}</span>
                              <input type="range" min={-20} max={120} step={0.5} value={box.x_pct} onChange={(event) => updateFigure(format.id, { ...box, x_pct: Number(event.target.value) })} />
                            </label>
                            <label className="vb-field">
                              <span>{t("Vertikal (Unterkante)", "Vertical (bottom edge)")}</span>
                              <input type="range" min={40} max={160} step={0.5} value={box.bottom_pct} onChange={(event) => updateFigure(format.id, { ...box, bottom_pct: Number(event.target.value) })} />
                            </label>
                            <label className="vb-field">
                              <span>{t("Drehung", "Rotation")}: {box.rotate ?? 0}° <InfoTip text={t("Auch direkt im Bild am Kreis über dem Freisteller", "Also directly in the image at the circle above the cut-out")} /></span>
                              <input type="range" min={-180} max={180} step={1} value={box.rotate ?? 0} onChange={(event) => updateFigure(format.id, { ...box, rotate: Number(event.target.value) })} />
                            </label>
                          </div>
                        )}
                        {!activeImage && (
                          <div className="vb-color-row">
                            <strong>{t("Hintergrundfarbe", "Background color")}</strong>
                            {colors.map(({ name, hex }) => (
                              <button key={hex} type="button" className={`vb-tool${shownColor === hex ? " is-active" : ""}`} aria-pressed={shownColor === hex} aria-label={name} title={`${name} ${hex}`} onClick={() => setBgColor(hex)}>
                                <span className="vb-swatch" style={{ background: hex }} />
                              </button>
                            ))}
                            <input type="color" value={bgColor ?? "#000000"} aria-label={t("Eigene Farbe", "Custom color")} onChange={(event) => setBgColor(event.target.value)} />
                          </div>
                        )}
                      </>
                    )}

                    {current === "text" && (
                      <>
                        <div className="vb-text-grid">
                          {([0, 1] as const).map((index) => (
                            <div key={index} className="vb-panel vb-text-panel">
                              <strong className={`vb-text-label is-${index + 1}`}>{index + 1} · {index === 0 ? "Headline" : "Subline"}</strong>
                              <RichTextEditor
                                value={pair[index].html}
                                onChange={(html) => updateBlock(format.id, index, { html })}
                                fontFamily={pair[index].font || fontFamily}
                                fontOptions={fontOptions}
                                colors={colors}
                                label={`${t("Textfenster", "Text box")} ${index + 1} — ${format.label}`}
                              />
                              <div className="vb-toggle-row">
                                {(["left", "center", "right"] as Align[]).map((align) => (
                                  <button key={align} type="button" className={`vb-tool${pair[index].align === align ? " is-active" : ""}`} aria-pressed={pair[index].align === align}
                                    aria-label={align === "left" ? t("Linksbündig", "Align left") : align === "center" ? t("Zentriert", "Center") : t("Rechtsbündig", "Align right")}
                                    onClick={() => updateBlock(format.id, index, { align })}>
                                    {align === "left" ? <AlignLeft size={14} /> : align === "center" ? <AlignCenter size={14} /> : <AlignRight size={14} />}
                                  </button>
                                ))}
                                <span className="vb-divider" />
                                <select className="vb-select vb-select-tiny" value={pair[index].font || fontFamily} aria-label={t("Schrift", "Font")}
                                  onChange={(event) => updateBlock(format.id, index, { font: event.target.value })}>
                                  {fontOptions.map((family) => <option key={family} value={family}>{family}</option>)}
                                </select>
                              </div>
                              <div className="vb-toggle-row">
                                {colors.map(({ name, hex }) => (
                                  <button key={hex} type="button" className={`vb-tool${pair[index].color.toLowerCase() === hex ? " is-active" : ""}`} aria-pressed={pair[index].color.toLowerCase() === hex}
                                    aria-label={name} title={`${name} ${hex}`} onClick={() => updateBlock(format.id, index, { color: hex })}>
                                    <span className="vb-swatch" style={{ background: hex }} />
                                  </button>
                                ))}
                                <input type="color" value={pair[index].color} aria-label={t("Eigene Farbe", "Custom color")} onChange={(event) => updateBlock(format.id, index, { color: event.target.value })} />
                              </div>
                              <div className="vb-frame-row">
                                <button type="button" className={`vb-tool vb-tool-text${pair[index].frame ? " is-active" : ""}`} aria-pressed={Boolean(pair[index].frame)}
                                  title={t("Kasten mit abgerundeten Ecken um den Text", "Rounded box around the text")}
                                  onClick={() => updateBlock(format.id, index, { frame: pair[index].frame ? null : { border: "#ffffff", fill: "#000000" } })}>
                                  <Square size={14} /> {t("Kasten", "Box")}
                                </button>
                                {pair[index].frame && (
                                  <>
                                    <span className="vb-mini-label">{t("Kontur", "Outline")}</span>
                                    {colors.map(({ name, hex }) => (
                                      <button key={`b${hex}`} type="button" className={`vb-tool${pair[index].frame?.border === hex ? " is-active" : ""}`} aria-pressed={pair[index].frame?.border === hex}
                                        title={`${t("Kontur", "Outline")}: ${name}`} aria-label={`${t("Kontur", "Outline")}: ${name}`} onClick={() => updateBlock(format.id, index, { frame: { border: hex, fill: pair[index].frame?.fill ?? null } })}>
                                        <span className="vb-swatch vb-swatch-ring" style={{ borderColor: hex }} />
                                      </button>
                                    ))}
                                    <span className="vb-mini-label">{t("Fläche", "Fill")}</span>
                                    <button type="button" className={`vb-tool vb-tool-text${pair[index].frame?.fill === null ? " is-active" : ""}`} aria-pressed={pair[index].frame?.fill === null}
                                      onClick={() => updateBlock(format.id, index, { frame: { border: pair[index].frame?.border ?? "#ffffff", fill: null } })}>{t("Keine", "None")}</button>
                                    {colors.map(({ name, hex }) => (
                                      <button key={`f${hex}`} type="button" className={`vb-tool${pair[index].frame?.fill === hex ? " is-active" : ""}`} aria-pressed={pair[index].frame?.fill === hex}
                                        title={`${t("Fläche", "Fill")}: ${name}`} aria-label={`${t("Fläche", "Fill")}: ${name}`} onClick={() => updateBlock(format.id, index, { frame: { border: pair[index].frame?.border ?? "#ffffff", fill: hex } })}>
                                        <span className="vb-swatch" style={{ background: hex }} />
                                      </button>
                                    ))}
                                  </>
                                )}
                              </div>
                              <label className="vb-field">
                                <span>{t("Schriftgröße", "Font size")}: {pair[index].sizePct}% <InfoTip text={t("Höchstwert – der Text wird automatisch kleiner, bis er in den Rahmen passt.", "Maximum – the text shrinks automatically until it fits the box.")} /></span>
                                <input type="range" min={2} max={20} step={0.5} value={pair[index].sizePct} onChange={(event) => updateBlock(format.id, index, { sizePct: Number(event.target.value) })} />
                              </label>
                              <label className="vb-field">
                                <span>{t("Zeilenabstand", "Line spacing")}: {(pair[index].lineHeight ?? 1.25).toFixed(2)}×</span>
                                <input type="range" min={0.8} max={2.5} step={0.05} value={pair[index].lineHeight ?? 1.25} onChange={(event) => updateBlock(format.id, index, { lineHeight: Number(event.target.value) })} />
                              </label>
                            </div>
                          ))}
                        </div>
                        <details className="vb-details">
                          <summary>{t("Schriften (gelten für alle Formate)", "Fonts (all formats)")}</summary>
                          {([0, 1] as const).map((index) => (
                            <label key={index} className="vb-field">
                              <span>{index === 0 ? "Headline" : "Subline"}</span>
                              <select className="vb-select" value={blocks["1x1"][index].font || fontFamily} onChange={(event) => setRoleFont(index, event.target.value)}>
                                {fontOptions.map((family) => <option key={family} value={family}>{family}</option>)}
                              </select>
                            </label>
                          ))}
                          <label className="vb-field">
                            <span>{t("Buttons und Störer", "Buttons and badges")}</span>
                            <select className="vb-select" value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}>
                              {fontOptions.map((family) => <option key={family} value={family}>{family}</option>)}
                            </select>
                          </label>
                        </details>
                        <button type="button" className="icon-text-btn vb-self-start" onClick={() => resetBoxes(format.id)}><RotateCcw size={14} /> {t("Textrahmen zurücksetzen", "Reset text boxes")}</button>
                      </>
                    )}

                    {current === "brand" && (
                      <>
                        <fieldset className="vb-panel">
                          <legend>Logo</legend>
                          <AssetTiles
                            label={t("Logo wählen", "Choose logo")}
                            value={logoId[format.id]}
                            noneLabel={t("Kein Logo", "No logo")}
                            onSelect={(id) => forLinked(format.id, setLogoId, id)}
                            // eslint-disable-next-line @next/next/no-img-element -- Same-origin tenant asset.
                            tiles={bootstrap.logos.map((logo) => ({ id: logo.id, label: logo.name, preview: <img src={logo.url} alt="" /> }))}
                          />
                          <label className="vb-field">
                            <span>{t("Position", "Position")} <InfoTip text={t("Oder direkt im Bild verschieben.", "Or drag it directly in the image.")} /></span>
                            <select className="vb-select" value={logoPlacement[format.id]} onChange={(event) => {
                              setLogoPlacement((prev) => ({ ...prev, [format.id]: event.target.value as LogoPlacement }));
                              setLogoPos((prev) => ({ ...prev, [format.id]: null }));
                            }}>
                              {LOGO_PLACEMENTS.map((placement) => <option key={placement} value={placement}>{placementLabel(placement, t)}</option>)}
                            </select>
                          </label>
                          <label className="vb-field">
                            <span>{t("Größe", "Size")}: {logoScale[format.id]}%</span>
                            <input type="range" min={5} max={40} step={1} value={logoScale[format.id]} onChange={(event) => setLogoScale((prev) => ({ ...prev, [format.id]: Number(event.target.value) }))} />
                          </label>
                        </fieldset>

                        <fieldset className="vb-panel">
                          <legend>Button</legend>
                          <AssetTiles
                            label={t("Button wählen", "Choose button")}
                            value={ctaId[format.id]}
                            noneLabel={t("Kein Button", "No button")}
                            onSelect={(id) => setCtaForFormat(format.id, id)}
                            tiles={bootstrap.ctas.map((cta) => ({
                              id: cta.id,
                              label: cta.name,
                              // eslint-disable-next-line @next/next/no-img-element -- Same-origin tenant asset.
                              preview: cta.variant === "graphic" && cta.url ? <img src={cta.url} alt="" /> : <CtaPreview cta={cta} font={fontFamily} fontsReady={fontsReady} height={14} />,
                            }))}
                          />
                          {ctaFor(format.id)?.variant === "text" && (
                            <label className="vb-field">
                              <span>{t("Button-Text", "Button text")} <InfoTip text={t("Wird beim Übersetzen mitübersetzt.", "Translated along with the text.")} /></span>
                              <input className="vb-input" value={ctaText[format.id]} onChange={(event) => forLinked(format.id, setCtaText, event.target.value)} placeholder={t("Jetzt kaufen", "Buy now")} />
                            </label>
                          )}
                          <label className="vb-field">
                            <span>{t("Position", "Position")} <InfoTip text={t("Oder direkt im Bild verschieben.", "Or drag it directly in the image.")} /></span>
                            <select className="vb-select" value={ctaPlacement[format.id]} onChange={(event) => {
                              setCtaPlacement((prev) => ({ ...prev, [format.id]: event.target.value as CtaPlacement }));
                              setCtaPos((prev) => ({ ...prev, [format.id]: null }));
                            }}>
                              {CTA_PLACEMENTS.map((placement) => <option key={placement} value={placement}>{placementLabel(placement, t)}</option>)}
                            </select>
                          </label>
                          <label className="vb-field">
                            <span>{t("Größe", "Size")}: {ctaScale[format.id]}%</span>
                            <input type="range" min={10} max={50} step={1} value={ctaScale[format.id]} onChange={(event) => setCtaScale((prev) => ({ ...prev, [format.id]: Number(event.target.value) }))} />
                          </label>
                        </fieldset>
                      </>
                    )}

                    {current === "extras" && (
                      <>
                        {bootstrap.badges.length > 0 && (
                          <fieldset className="vb-panel">
                            <legend>{t("Störer", "Badges")} <InfoTip align="start" text={t("Kachel antippen fügt einen Störer hinzu; im Bild verschieben.", "Click a tile to add a badge; drag it in the image.")} /></legend>
                            <AssetTiles
                              label={t("Störer hinzufügen", "Add badge")}
                              onSelect={(id) => {
                                const template = bootstrap.badges.find((entry) => entry.id === id);
                                if (template) addBadge(format.id, template);
                              }}
                              tiles={bootstrap.badges.map((entry) => ({ id: entry.id, label: entry.name, preview: <BadgePreview badge={entry} font={fontFamily} fontsReady={fontsReady} width={entry.shape === "price-box" ? 22 : 30} /> }))}
                            />
                            {badges[format.id].map((item) => (
                              <div key={item.uid} className="vb-badge-item">
                                <div className="vb-badge-head">
                                  <strong>{item.name}</strong>
                                  <button type="button" className="vb-tool" aria-label={t("Störer entfernen", "Remove badge")} title={t("Entfernen", "Remove")} onClick={() => removeBadge(format.id, item.uid)}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                <BadgeLinesEditor lines={item.lines} onChange={(lines) => changeBadge(format.id, item.uid, { lines }, true)} />
                                <label className="vb-field">
                                  <span>{t("Größe", "Size")}: {item.scale}%</span>
                                  <input type="range" min={8} max={80} step={1} value={item.scale} onChange={(event) => changeBadge(format.id, item.uid, { scale: Number(event.target.value) })} />
                                </label>
                              </div>
                            ))}
                          </fieldset>
                        )}

                        {bootstrap.stickers.length > 0 && (
                          <fieldset className="vb-panel">
                            <legend>{t("Grafiken", "Graphics")} <InfoTip align="start" text={t("Kachel antippen fügt eine Grafik hinzu. Im Bild verschieben, am Kreis drehen, an der Ecke skalieren.", "Click a tile to add a graphic. Drag it in the image, rotate at the circle, resize at the corner.")} /></legend>
                            <AssetTiles
                              label={t("Grafik hinzufügen", "Add graphic")}
                              onSelect={(id) => {
                                const asset = bootstrap.stickers.find((entry) => entry.id === id);
                                if (asset) addSticker(format.id, asset);
                              }}
                              // eslint-disable-next-line @next/next/no-img-element -- Same-origin tenant asset.
                              tiles={bootstrap.stickers.map((asset) => ({ id: asset.id, label: asset.name, preview: <img src={asset.url} alt="" /> }))}
                            />
                            {stickers[format.id].map((item) => (
                              <div key={item.uid} className="vb-badge-item">
                                <div className="vb-badge-head">
                                  <strong>{item.name}</strong>
                                  <span className="vb-toggle-row">
                                    <button type="button" className={`vb-tool vb-tool-text${item.flip ? " is-active" : ""}`} aria-pressed={item.flip} onClick={() => changeSticker(format.id, item.uid, { flip: !item.flip })}>{t("Spiegeln", "Flip")}</button>
                                    <button type="button" className={`vb-tool vb-tool-text${item.behind ? " is-active" : ""}`} aria-pressed={item.behind}
                                      title={t("Liegt hinter dem Freisteller", "Sits behind the cut-out")} onClick={() => changeSticker(format.id, item.uid, { behind: !item.behind })}>{t("Hinter Freisteller", "Behind cut-out")}</button>
                                    <button type="button" className="vb-tool" aria-label={t("Grafik entfernen", "Remove graphic")} title={t("Entfernen", "Remove")} onClick={() => removeSticker(format.id, item.uid)}>
                                      <Trash2 size={14} />
                                    </button>
                                  </span>
                                </div>
                                <label className="vb-field">
                                  <span>{t("Größe", "Size")}: {item.scale}%</span>
                                  <input type="range" min={3} max={300} step={1} value={item.scale} onChange={(event) => changeSticker(format.id, item.uid, { scale: Number(event.target.value) })} />
                                </label>
                                <label className="vb-field">
                                  <span>{t("Drehung", "Rotation")}: {item.rotate}°</span>
                                  <input type="range" min={-180} max={180} step={1} value={item.rotate} onChange={(event) => changeSticker(format.id, item.uid, { rotate: Number(event.target.value) })} />
                                </label>
                              </div>
                            ))}
                          </fieldset>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}

      {library && (
        <UploadDialog
          open={uploadOpen}
          libraryId={library.id}
          libraryLabel={library.label}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => void refreshListing()}
        />
      )}
    </div>
  );
}

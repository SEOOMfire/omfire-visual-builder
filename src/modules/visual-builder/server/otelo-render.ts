import { randomUUID } from "node:crypto";
import { OTELO_FORMATS } from "../otelo-formats";
import { templateLayout } from "../otelo-templates";
import type { RenderJob } from "../render-protocol";
import type { CreativeState } from "../types";
import { renderInBrowser } from "./browser-pool";
import { listClientFiles, readClientFile, readClientText, type ClientFile } from "./client-volume";
import { resolveMotif } from "./motif";
import { checkHeadlineFont, checkSplitAngle } from "./otelo-rules";
import { storePreview } from "./previews";
import { uniqueFormatLabels } from "./preview-text";

function pair() {
  const block = { html: "", rect: { x_pct: 0, y_pct: 0, w_pct: 10, h_pct: 10 }, align: "left" as const, color: "#ffffff", sizePct: 4, lineHeight: 1 };
  return [block, { ...block }] as [typeof block, typeof block];
}

function every<T>(value: T) {
  return { "1x1": value, "191x1": value, "1x191": value };
}

function emptyState(): CreativeState {
  return {
    v: 1,
    blocks: every(pair()),
    bgPaths: every(null),
    bgCrop: every({ x: 0.5, y: 0.5, zoom: 1 }),
    fontFamily: "Titillium Web",
    logoId: every(null),
    logoPlacement: every("bottom-left"),
    logoPos: every(null),
    logoScale: every(18),
    ctaId: every(null),
    ctaPlacement: every("none"),
    ctaPos: every(null),
    ctaScale: every(42),
    ctaText: every(""),
    selectedLanguage: "de",
    individual: every(false),
  };
}

async function asDataUrl(relative: string): Promise<string> {
  const bytes = await readClientFile("otelo", relative);
  const ext = relative.split(".").pop()?.toLowerCase() ?? "png";
  const mime = ext === "svg" ? "image/svg+xml"
    : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
    : ext === "png" ? "image/png"
    : ext === "ttf" ? "font/ttf"
    : ext === "otf" ? "font/otf"
    : ext === "woff" ? "font/woff"
    : ext === "woff2" ? "font/woff2"
    : "application/octet-stream";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function pick(files: { role: string; name: string; path: string }[], role: string, includes?: string) {
  return files.find((file) => file.role === role && (!includes || file.name.toLowerCase().includes(includes)))
    ?? files.find((file) => file.role === role);
}

export type RenderedFormat = { id: string; label: string; token: string; pngBase64: string };

export type RenderedCreative = {
  name: "young" | "standard" | "hardware";
  motifName: string;
  motifPath: string;
  buttonName: string | null;
  token: string;
  jpeg: string;
  formats: RenderedFormat[];
  hints: string[];
};

function motifPool(files: ClientFile[], name: "young" | "standard" | "hardware"): ClientFile[] {
  if (name !== "hardware") return files.filter((file) => file.role === "figur");
  return files.filter((file) => file.role === "produkt" && file.name.toLowerCase().endsWith(".png") && !file.name.toLowerCase().includes("logo"));
}

export async function renderTemplate(input: { name: "young" | "standard" | "hardware"; motiv: string; headline?: string; subline?: string }): Promise<RenderedCreative> {
  const files = await listClientFiles("otelo");
  if (!files.length) throw new Error("Für otelo liegt noch nichts auf dem Volume.");
  const logo = pick(files, "logo", "wortmarke_weiss") ?? pick(files, "logo", "weiss");
  const cta = pick(files, "button", "jetzt_sichern") ?? pick(files, "button", "rgb") ?? pick(files, "button", "cta");
  const motif = resolveMotif(motifPool(files, input.name), input.motiv, input.name === "hardware" ? "produkt" : "figur");
  const energy = pick(files, "energielabel", "class_arrows_ag_a.svg") ?? pick(files, "energielabel", "_a.");
  const font = pick(files, "schrift", "titillium");
  if (!logo) throw new Error("Die Wortmarke fehlt auf dem Volume.");
  const withProduct = input.name === "hardware";
  const layout = templateLayout(input.name, input.headline ?? "", input.subline ?? "", withProduct);
  const images: Record<string, string> = {};
  if (withProduct) {
    layout.productPath = motif.path;
    images[motif.path] = await asDataUrl(motif.path);
    if (energy) {
      layout.energyPath = energy.path;
      images[energy.path] = await asDataUrl(energy.path);
    }
  } else {
    layout.figurePath = motif.path;
    images[motif.path] = await asDataUrl(motif.path);
  }
  layout.logoId = "wortmarke-weiss";
  const logoUrl = await asDataUrl(logo.path);
  const ctaUrl = cta ? await asDataUrl(cta.path) : null;
  const fonts = font ? [{ family: "Titillium Web", weight: 900, style: "normal" as const, dataUrl: await asDataUrl(font.path) }] : [];
  const job: RenderJob = {
    formats: [],
    canvases: OTELO_FORMATS.map((format) => ({ id: format.id, w: format.w, h: format.h, label: `${format.channel} ${format.token}` })),
    layouts: Object.fromEntries(OTELO_FORMATS.map((format) => [format.id, layout])),
    state: emptyState(),
    images,
    fonts,
    logos: [{ id: "wortmarke-weiss", name: logo.name, variant: "wide", dataUrl: logoUrl }],
    ctas: cta && ctaUrl ? [{ id: "cta", name: cta.name, variant: "graphic", text: null, style: {}, dataUrl: ctaUrl }] : [],
    stickers: [],
    safeZone: { x_pct: 5, y_pct: 5, w_pct: 90, h_pct: 90 },
  };
  const output = await renderInBrowser(job);
  const labels = uniqueFormatLabels(OTELO_FORMATS.map((format) => ({ id: format.id, pixel: `${format.w}x${format.h}`, channel: format.channel })));
  const formats: RenderedFormat[] = [];
  for (const format of output.formats) {
    const token = await storePreview(`${randomUUID()}-${format.format}.png`, Buffer.from(format.pngBase64, "base64"));
    formats.push({ id: format.format, label: labels.get(format.format) ?? format.pixelSize, token, pngBase64: format.pngBase64 });
  }
  const token = await storePreview(`${randomUUID()}-kontakt.jpg`, Buffer.from(output.contactSheetBase64, "base64"));
  const hints = output.formats.flatMap((format) => format.hints.map((hint) => hint.sentence));
  const fontHint = checkHeadlineFont("Titillium Web");
  if (fontHint) hints.push(fontHint);
  if (layout.splitAngle) {
    for (const format of OTELO_FORMATS) {
      const message = checkSplitAngle(layout.splitAngle, format.w, format.h);
      if (message) hints.push(message);
    }
  }
  return { name: input.name, motifName: motif.name, motifPath: motif.path, buttonName: cta?.name ?? null, token, jpeg: output.contactSheetBase64, formats, hints };
}

export async function oteloStatus(): Promise<string> {
  const files = await listClientFiles("otelo").catch(() => []);
  const ci = await readClientText("otelo", "ci-richtlinie.md").catch(() => null);
  const router = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const drive = "Google Drive ist noch nicht verbunden. Das kommt zuletzt und ist kein Fehler.";
  const client = files.length ? `otelo hat ${files.length} Dateien auf dem Volume.` : "otelo ist noch nicht importiert.";
  const rules = ci ? "Die CI-Richtlinie für otelo liegt bereit." : "Die CI-Richtlinie für otelo fehlt noch.";
  const translation = router ? "Übersetzung und Prüfung sind erreichbar." : "Übersetzung und Prüfung sind noch nicht freigeschaltet. Trag OPENROUTER_API_KEY in Coolify ein.";
  return [client, rules, translation, drive].join(" ");
}

export async function brandSummary(): Promise<string> {
  const raw = await readClientText("otelo", "marke.json");
  if (!raw) return "Für otelo liegt noch keine Marke auf dem Volume.";
  const marke = JSON.parse(raw) as { palette?: Array<{ name: string; hex: string }>; logos?: Array<{ name: string }> };
  const colors = (marke.palette ?? []).map((color) => `${color.name} ${color.hex}`).join(", ");
  return `otelo. Farben: ${colors}. Logos: ${(marke.logos ?? []).map((logo) => logo.name).join(", ")}. Vorlagen: young, standard, hardware.`;
}

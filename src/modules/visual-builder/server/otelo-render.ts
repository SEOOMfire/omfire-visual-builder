import { randomUUID } from "node:crypto";
import { OTELO_FORMATS } from "../otelo-formats";
import { type AdjustSnap, type ElementId } from "./adjust-commands";
import { buildScene, defaultHeadline, defaultOrange, defaultStoerer, normalizeVorlage, type HeadlineVariant, type OrangeSide, type OteloScene, type SceneCopy, type StoererTyp, type VorlageName } from "../otelo-scene";
import type { RenderJob } from "../render-protocol";
import type { CreativeState } from "../types";
import { renderInBrowser } from "./browser-pool";
import { listClientFiles, readClientFile, readClientText, type ClientFile } from "./client-volume";
import { resolveMotif } from "./motif";
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
  name: VorlageName;
  motifName: string;
  motifPath: string;
  buttonName: string | null;
  personFile: string;
  deviceFile: string;
  token: string;
  jpeg: string;
  formats: RenderedFormat[];
  hints: string[];
};

export type RenderRequest = {
  name: string;
  motiv: string;
  person?: string;
  headline?: string;
  subline?: string;
  button?: string;
  stoererTyp?: string;
  preis?: string;
  preisZusatz?: string;
  einmalpreis?: string;
  aktionText?: string;
  pflichttext?: string;
  headlineVariante?: string;
  orange?: string;
  produktname?: string;
  layout?: AdjustSnap;
};

function products(files: ClientFile[]) {
  return files.filter((file) => file.role === "produkt" && file.name.toLowerCase().endsWith(".png") && !file.name.toLowerCase().includes("logo"));
}

function asStoerer(value: string | undefined, fallback: StoererTyp): StoererTyp {
  const allowed: StoererTyp[] = ["tarif", "product", "bonus", "stern", "kreis", "ohne_preis"];
  return allowed.includes(value as StoererTyp) ? value as StoererTyp : fallback;
}

function asOrange(value: string | undefined, fallback: OrangeSide): OrangeSide {
  return value === "links" || value === "rechts" ? value : fallback;
}

function asHeadline(value: string | undefined, fallback: HeadlineVariant): HeadlineVariant {
  return value === "direkt" || value === "box" ? value : fallback;
}

export async function renderTemplate(input: RenderRequest): Promise<RenderedCreative> {
  const files = await listClientFiles("otelo");
  if (!files.length) throw new Error("Für otelo liegt noch nichts auf dem Volume.");
  const name = normalizeVorlage(input.name);
  const logo = pick(files, "logo", "wortmarke_weiss") ?? pick(files, "logo", "weiss");
  if (!logo) throw new Error("Die Wortmarke fehlt auf dem Volume.");
  const wantsProduct = name === "product" || name === "product_person";
  const wantsPerson = name !== "product" || Boolean(input.person?.trim());
  const device = wantsProduct ? resolveMotif(products(files), input.motiv, "produkt") : null;
  const personQuery = name === "product_person" ? (input.person?.trim() || "") : input.motiv;
  const person = wantsPerson && personQuery ? resolveMotif(files.filter((file) => file.role === "figur"), personQuery, "figur") : null;
  if (name === "product_person" && !person) throw new Error("Für product_person fehlt die Person. Nenne sie im Feld person.");
  const energy = pick(files, "energielabel", "class_arrows_ag_a.svg") ?? pick(files, "energielabel", "_a.");
  const copy: SceneCopy = {
    headline: input.headline?.trim() || "Unlimited on demand",
    subline: input.subline?.trim() || "100 GB monatlich\ninkl. unendlich oft 1 GB abrufen",
    button: input.button?.trim() || "Jetzt sichern auf **otelo.de**",
    stoererTyp: asStoerer(input.stoererTyp, defaultStoerer(name)),
    preis: input.preis?.trim() || "29,99 €",
    preisZusatz: input.preisZusatz?.trim() || "monatlich",
    einmalpreis: input.einmalpreis?.trim() || "1 €",
    aktionText: input.aktionText?.trim() || "",
    pflichttext: input.pflichttext?.trim() ?? "",
    headlineVariante: asHeadline(input.headlineVariante, defaultHeadline(name)),
    orange: asOrange(input.orange, defaultOrange(name)),
    produktname: input.produktname?.trim() || (device ? device.name.replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ") : ""),
  };
  const images: Record<string, string> = {};
  images[logo.path] = await asDataUrl(logo.path);
  if (person) images[person.path] = await asDataUrl(person.path);
  if (device) images[device.path] = await asDataUrl(device.path);
  if (energy && wantsProduct) images[energy.path] = await asDataUrl(energy.path);
  const fonts = [];
  const used = new Set<string>();
  for (const spec of [
    [/titillium/i, "Titillium Web", 900],
    [/geist-regular/i, "Geist", 400],
    [/geist-medium/i, "Geist", 500],
    [/geist-semibold/i, "Geist", 600],
    [/geist-extrabold/i, "Geist", 800],
    [/geist-bold/i, "Geist", 700],
  ] as const) {
    const file = files.find((item) => item.role === "schrift" && spec[0].test(item.name) && !used.has(item.path));
    if (!file) continue;
    used.add(file.path);
    fonts.push({ family: spec[1], weight: spec[2], style: "normal" as const, dataUrl: await asDataUrl(file.path) });
  }
  const otelo: Record<string, OteloScene> = {};
  for (const format of OTELO_FORMATS) {
    const elements: ElementId[] = ["headline", "subline", "stoerer", "person", "geraet", "cta", "logo", "pflichttext", "energielabel", "schraege"];
    const shifts = Object.fromEntries(elements.map((element) => {
      const parts = ["*", format.id, format.token, `${format.w}x${format.h}`].map((key) => input.layout?.nudges[key]?.[element]).filter((item) => item);
      return [element, {
        dx: parts.reduce((sum, item) => sum + (item?.dx ?? 0), 0),
        dy: parts.reduce((sum, item) => sum + (item?.dy ?? 0), 0),
        scale: parts.reduce((product, item) => product * (item?.scale ?? 1), 1),
        flip: parts.some((item) => item?.flip),
        hidden: parts.some((item) => item?.hidden),
      }];
    }));
    const scene = buildScene(format, name, copy, shifts);
    scene.logoKey = logo.path;
    if (person) scene.figureKey = person.path;
    if (device) scene.productKey = device.path;
    if (energy && wantsProduct) scene.energyKey = energy.path;
    otelo[format.id] = scene;
  }
  const job: RenderJob = {
    formats: [],
    canvases: OTELO_FORMATS.map((format) => ({ id: format.id, w: format.w, h: format.h, label: `${format.channel} ${format.token}` })),
    layouts: {},
    state: emptyState(),
    images,
    fonts,
    logos: [],
    ctas: [],
    stickers: [],
    safeZone: { x_pct: 5, y_pct: 5, w_pct: 90, h_pct: 90 },
    otelo,
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
  const motifName = [person?.name, device?.name].filter(Boolean).join(" + ");
  return {
    name,
    motifName,
    motifPath: (person ?? device)?.path ?? "",
    buttonName: "Geist",
    personFile: person?.name ?? "",
    deviceFile: device?.name ?? "",
    token,
    jpeg: output.contactSheetBase64,
    formats,
    hints,
  };
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
  return `otelo. Farben: ${colors}. Logos: ${(marke.logos ?? []).map((logo) => logo.name).join(", ")}. Vorlagen: tarif, product, product_person, young.`;
}

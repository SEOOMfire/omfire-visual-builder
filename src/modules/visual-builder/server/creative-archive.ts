import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { OTELO_FORMATS } from "../otelo-formats";
import { clientRoot } from "./client-volume";
import { namePart, nextVersion, oteloFileName, oteloFolder, type OteloName } from "./naming";
import { applyToBook, newBook, type AdjustBook } from "./adjust-commands";
import { normalizeVorlage, type HeadlineVariant, type OrangeSide, type StoererTyp, type VorlageName } from "../otelo-scene";
import { renderTemplate, type RenderedCreative } from "./otelo-render";
import { signPreview } from "./previews";
import { previewUrl } from "./public-url";

export type { VorlageName };

export type CreativeDraft = {
  id: string;
  vorlage: VorlageName;
  motiv: string;
  person: string;
  headline: string;
  subline: string;
  button: string;
  kampagne: string;
  hints: string[];
  stoererTyp: StoererTyp;
  preis: string;
  preisZusatz: string;
  einmalpreis: string;
  aktionText: string;
  pflichttext: string;
  headlineVariante: HeadlineVariant;
  orange: OrangeSide;
  produktname: string;
  datenmenge?: string;
  datenmengeAlt?: string;
  einmalpreisZusatz?: string;
  preisAlt?: string;
  energielabel?: string;
  sternText?: string;
  deko?: string;
  geraetName?: string;
  layoutBook?: AdjustBook;
  glance?: string;
  summary?: string;
};

const BLOCKING = /überlappt|unteren Rand|Orange-Anteil|Schräge|CTA-Leiste|CTA-Text|Fußnote|Ersatzschrift|mehr als|auf Orange|zu klein|zu weit|sicheren Zone|Kopf ist nicht|zu kurz|Stern überdeckt|Wellen überlagern/;

export function blockingHints(hints: readonly string[]): string[] {
  return hints.filter((hint) => !hint.startsWith("Hinweis:") && BLOCKING.test(hint));
}

export function archivePeriod(now = new Date()): { quarter: string; monthYear: string } {
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear() % 100;
  return {
    quarter: `Q${Math.floor((month - 1) / 3) + 1}`,
    monthYear: `${String(month).padStart(2, "0")}${String(year).padStart(2, "0")}`,
  };
}

function audience(name: VorlageName): string {
  if (name === "young") return "Young";
  if (name === "product" || name === "product_person") return "Hardware-Standard";
  return "Standard";
}

function textOf(args: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/** One reading of the tool arguments, shared by the first render and the saved draft. */
export function creativeInput(args: Record<string, unknown>) {
  const deko = textOf(args, "deko");
  return {
    headline: textOf(args, "headline"),
    subline: textOf(args, "subline", "unterzeile"),
    button: typeof args.button === "string" ? args.button.trim() : undefined,
    person: textOf(args, "person"),
    kampagne: textOf(args, "kampagne"),
    stoererTyp: textOf(args, "stoerer_typ", "stoererTyp"),
    preis: textOf(args, "preis"),
    preisZusatz: textOf(args, "preis_zusatz", "preisZusatz"),
    einmalpreis: textOf(args, "einmalpreis"),
    einmalpreisZusatz: textOf(args, "einmalpreis_zusatz", "einmalpreisZusatz"),
    preisAlt: textOf(args, "preis_alt", "preisAlt"),
    energielabel: textOf(args, "energielabel"),
    aktionText: textOf(args, "aktion_text", "aktionText"),
    pflichttext: textOf(args, "pflichttext"),
    headlineVariante: textOf(args, "headline_variante", "headlineVariante"),
    orange: textOf(args, "orange"),
    produktname: textOf(args, "produktname", "geraet_name", "geraetName"),
    datenmenge: textOf(args, "datenmenge"),
    datenmengeAlt: textOf(args, "datenmenge_alt", "datenmengeAlt"),
    sternText: textOf(args, "stern_text", "sternText"),
    deko: deko === "bw_wellen" || deko === "fruehling_blaetter" || deko === "keine" ? deko : undefined,
    geraetName: textOf(args, "geraet_name", "geraetName"),
  };
}

export function fieldsForRender(draft: CreativeDraft) {
  return {
    name: draft.vorlage,
    motiv: draft.motiv,
    person: draft.person,
    headline: draft.layoutBook?.snap.fields?.headline ?? draft.headline,
    subline: draft.layoutBook?.snap.fields?.subline ?? draft.subline,
    button: draft.layoutBook?.snap.fields?.button ?? draft.button,
    stoererTyp: draft.stoererTyp,
    preis: draft.preis,
    preisZusatz: draft.preisZusatz,
    einmalpreis: draft.einmalpreis,
    aktionText: draft.aktionText,
    pflichttext: draft.pflichttext,
    headlineVariante: draft.headlineVariante,
    orange: draft.layoutBook?.snap.orange ?? draft.orange,
    produktname: draft.produktname,
    datenmenge: draft.layoutBook?.snap.fields?.datenmenge ?? draft.datenmenge,
    datenmengeAlt: draft.layoutBook?.snap.fields?.datenmengeAlt !== undefined ? draft.layoutBook.snap.fields.datenmengeAlt : draft.datenmengeAlt,
    einmalpreisZusatz: draft.einmalpreisZusatz,
    preisAlt: draft.preisAlt,
    energielabel: draft.layoutBook?.snap.fields?.energielabel ?? draft.energielabel,
    sternText: draft.layoutBook?.snap.fields?.sternText ?? draft.sternText,
    deko: draft.layoutBook?.snap.fields?.deko ?? draft.deko,
    geraetName: draft.layoutBook?.snap.fields?.geraetName ?? draft.geraetName,
    kampagne: draft.kampagne,
    sublineColor: draft.layoutBook?.snap.fields?.sublineColor,
    sternColor: draft.layoutBook?.snap.fields?.sternColor,
    headlineColor: draft.layoutBook?.snap.fields?.headlineColor,
    layout: draft.layoutBook?.snap,
  };
}

function campaignToken(value: string): string {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return namePart(trimmed);
}

function motifToken(filename: string): string {
  return filename.replace(/\.[a-z0-9]+$/i, "");
}

function draftPath(id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Die Entwurfs-ID ist ungültig.");
  return join(clientRoot("otelo"), "entwuerfe", `${id}.json`);
}

export async function writeDraft(draft: CreativeDraft): Promise<void> {
  const path = draftPath(draft.id);
  await mkdir(join(clientRoot("otelo"), "entwuerfe"), { recursive: true });
  await writeFile(path, JSON.stringify(draft));
}

export async function readDraft(id: string): Promise<CreativeDraft | null> {
  try {
    return JSON.parse(await readFile(draftPath(id), "utf8")) as CreativeDraft;
  } catch {
    return null;
  }
}

export async function adjustCreative(id: string, change: Record<string, unknown>): Promise<{ draft: CreativeDraft; rendered: RenderedCreative }> {
  const draft = await readDraft(id);
  if (!draft) throw new Error("Diesen Entwurf kenne ich nicht. Ruf zuerst compose_creative auf.");
  if (typeof change.headline === "string") draft.headline = change.headline;
  if (typeof change.subline === "string") draft.subline = change.subline;
  if (typeof change.motiv === "string") draft.motiv = change.motiv;
  if (typeof change.kampagne === "string") draft.kampagne = change.kampagne;
  if (typeof change.person === "string") draft.person = change.person;
  if (typeof change.vorlage === "string") draft.vorlage = normalizeVorlage(change.vorlage);
  if (change.orange === "links" || change.orange === "rechts") draft.orange = change.orange;
  if (change.headline_variante === "direkt" || change.headline_variante === "box") draft.headlineVariante = change.headline_variante;
  if (typeof change.stoerer_typ === "string") draft.stoererTyp = change.stoerer_typ as CreativeDraft["stoererTyp"];
  if (typeof change.preis === "string") draft.preis = change.preis;
  if (typeof change.preis_zusatz === "string") draft.preisZusatz = change.preis_zusatz;
  if (typeof change.einmalpreis === "string") draft.einmalpreis = change.einmalpreis;
  if (typeof change.aktion_text === "string") draft.aktionText = change.aktion_text;
  if (typeof change.pflichttext === "string") draft.pflichttext = change.pflichttext;
  if (typeof change.produktname === "string") draft.produktname = change.produktname;
  if (typeof change.button === "string") draft.button = change.button;
  if (typeof change.unterzeile === "string" && change.unterzeile.trim() && typeof change.subline !== "string") draft.subline = change.unterzeile.trim();
  if (typeof change.datenmenge === "string") draft.datenmenge = change.datenmenge;
  if (typeof change.datenmenge_alt === "string") draft.datenmengeAlt = change.datenmenge_alt;
  if (typeof change.stern_text === "string") draft.sternText = change.stern_text;
  if (typeof change.einmalpreis_zusatz === "string") draft.einmalpreisZusatz = change.einmalpreis_zusatz;
  if (typeof change.preis_alt === "string") draft.preisAlt = change.preis_alt;
  if (typeof change.energielabel === "string") draft.energielabel = change.energielabel;
  if (typeof change.geraet_name === "string") draft.geraetName = change.geraet_name;
  if (change.deko === "bw_wellen" || change.deko === "fruehling_blaetter" || change.deko === "keine") draft.deko = change.deko;
  const spoken = typeof change.text === "string" ? change.text : typeof change.satz === "string" ? change.satz : "";
  if (!spoken && !Array.isArray(change.befehle)) {
    const result = applyToBook(draft.layoutBook ?? newBook(draft.orange), { befehle: [] });
    draft.layoutBook = result.book;
    draft.summary = "Felder des Entwurfs geändert.";
  }
  if (spoken || Array.isArray(change.befehle)) {
    const result = applyToBook(draft.layoutBook ?? newBook(draft.orange), spoken || { befehle: change.befehle });
    if (result.question) throw new Error(result.question);
    if (result.compare) {
      const left = result.book.history.find((entry) => entry.n === result.compare?.links);
      const right = result.book.history.find((entry) => entry.n === result.compare?.rechts);
      if (!left || !right) throw new Error(`Version ${result.compare.links} oder ${result.compare.rechts} kenne ich nicht.`);
      const renderSnap = (snap: typeof left.snap) => renderTemplate(fieldsForRender({ ...draft, layoutBook: { ...result.book, snap } }));
      const [first, second] = await Promise.all([renderSnap(left.snap), renderSnap(right.snap)]);
      draft.summary = `Version ${left.n}: ${previewUrl(first.token)}\nVersion ${right.n}: ${previewUrl(second.token)}`;
      await writeDraft(draft);
      return { draft, rendered: second };
    }
    draft.layoutBook = result.book;
    draft.orange = result.book.snap.orange;
    const patch = result.book.snap.fields ?? {};
    if (patch.headline) draft.headline = patch.headline;
    if (patch.subline) draft.subline = patch.subline;
    if (patch.button) draft.button = patch.button;
    if (patch.sternText) draft.sternText = patch.sternText;
    if (patch.datenmenge) draft.datenmenge = patch.datenmenge;
    if (patch.datenmengeAlt !== undefined) draft.datenmengeAlt = patch.datenmengeAlt;
    if (patch.preis) draft.preis = patch.preis;
    if (patch.preisZusatz) draft.preisZusatz = patch.preisZusatz;
    if (patch.einmalpreis) draft.einmalpreis = patch.einmalpreis;
    if (patch.einmalpreisZusatz) draft.einmalpreisZusatz = patch.einmalpreisZusatz;
    if (patch.geraetName) draft.geraetName = patch.geraetName;
    if (patch.pflichttext) draft.pflichttext = patch.pflichttext;
    if (patch.deko) draft.deko = patch.deko;
    if (patch.vorlage) draft.vorlage = normalizeVorlage(patch.vorlage);
    if (patch.motiv) draft.motiv = patch.motiv;
    if (patch.energielabel) draft.energielabel = patch.energielabel;
    if (patch.headlineVariante) draft.headlineVariante = patch.headlineVariante;
    draft.summary = result.summary;
  }
  const rendered = await renderTemplate(fieldsForRender(draft));
  if (rendered.deviceFile) draft.motiv = rendered.deviceFile;
  else if (rendered.personFile) draft.motiv = rendered.personFile;
  if (rendered.personFile && draft.vorlage === "product_person") draft.person = rendered.personFile;
  draft.hints = rendered.hints;
  const notes = [...new Set(rendered.hints.filter((hint) => hint.includes("Maximum vergrößert")).map((hint) => hint.replace(/^Hinweis: /, "").replace(/\.$/, "")))];
  if (notes.length) {
    const base = (draft.summary ?? "").replace(/\.\s*$/, "");
    draft.summary = `${base}${base ? ", " : ""}${notes.join(", ")}.`;
  }
  await writeDraft(draft);
  return { draft, rendered };
}

export async function storeRenderedDraft(rendered: RenderedCreative, fields: Omit<CreativeDraft, "id" | "vorlage" | "motiv" | "person" | "hints"> & { motiv: string; person?: string }): Promise<CreativeDraft> {
  const draft: CreativeDraft = {
    id: randomUUID(),
    vorlage: rendered.name,
    motiv: rendered.deviceFile || rendered.personFile || fields.motiv,
    person: rendered.personFile,
    headline: fields.headline,
    subline: fields.subline,
    button: fields.button,
    kampagne: fields.kampagne,
    hints: rendered.hints,
    stoererTyp: fields.stoererTyp,
    preis: fields.preis,
    preisZusatz: fields.preisZusatz,
    einmalpreis: fields.einmalpreis,
    aktionText: fields.aktionText,
    pflichttext: fields.pflichttext,
    headlineVariante: fields.headlineVariante,
    orange: fields.orange,
    produktname: fields.produktname,
    datenmenge: fields.datenmenge,
    datenmengeAlt: fields.datenmengeAlt,
    einmalpreisZusatz: fields.einmalpreisZusatz,
    preisAlt: fields.preisAlt,
    energielabel: fields.energielabel,
    sternText: fields.sternText,
    deko: fields.deko,
    geraetName: fields.geraetName,
    layoutBook: newBook(fields.orange),
  };
  await writeDraft(draft);
  return draft;
}

export function versionFor(existing: readonly string[], stem: string): number {
  const names = existing.map((name) => name.split("/").pop() ?? name);
  const taken = names.some((name) => name === `${stem}.png` || name.startsWith(`${stem}_v`));
  if (!taken) return 1;
  return Math.max(2, nextVersion(names, stem));
}

export async function saveCreative(id: string, now = new Date()): Promise<{
  draft: CreativeDraft;
  files: Array<{ name: string; label: string; relative: string }>;
  zipName: string;
  zipRelative: string;
  quarter: string;
  monthYear: string;
}> {
  const draft = await readDraft(id);
  if (!draft) throw new Error("Diesen Entwurf kenne ich nicht. Ruf zuerst compose_creative auf.");
  if (!draft.kampagne.trim()) throw new Error("Die Kampagne fehlt. Nenne sie, dann kann ich ablegen.");
  const rendered = await renderTemplate(fieldsForRender(draft));
  const blocked = blockingHints(rendered.hints);
  if (blocked.length) throw new Error(`Nicht gespeichert. ${blocked.join(" ")}`);
  const { quarter, monthYear } = archivePeriod(now);
  const campaign = campaignToken(draft.kampagne);
  const motif = motifToken(rendered.motifName);
  const root = process.env.FILE_STORAGE_ROOT?.trim();
  if (!root) throw new Error("FILE_STORAGE_ROOT fehlt.");
  const zip = new JSZip();
  const files: Array<{ name: string; label: string; relative: string }> = [];
  for (const format of OTELO_FORMATS) {
    const renderedFormat = rendered.formats.find((item) => item.id === format.id);
    if (!renderedFormat) continue;
    const input: OteloName = {
      channel: format.channel,
      quarter,
      monthYear,
      campaign,
      motif,
      format: format.token,
      audience: audience(draft.vorlage),
    };
    const folder = oteloFolder(input);
    const directory = join(clientRoot("otelo"), folder);
    await mkdir(directory, { recursive: true });
    const existing = await readdir(directory).catch(() => [] as string[]);
    const stem = oteloFileName(input, 1).replace(/\.png$/, "");
    const filename = oteloFileName(input, versionFor(existing, stem));
    const bytes = Buffer.from(renderedFormat.pngBase64, "base64");
    await writeFile(join(directory, filename), bytes);
    zip.file(filename, bytes);
    files.push({ name: filename, label: renderedFormat.label, relative: `clients/otelo/${folder}/${filename}` });
  }
  const zipName = `${quarter}_${monthYear}_${campaign}_${motif}.zip`;
  const zipDirectory = join(clientRoot("otelo"), "ausgabe");
  await mkdir(zipDirectory, { recursive: true });
  const zipBytes = await zip.generateAsync({ type: "nodebuffer" });
  await writeFile(join(zipDirectory, zipName), zipBytes);
  draft.hints = rendered.hints;
  draft.motiv = rendered.motifName;
  await writeDraft(draft);
  return { draft, files, zipName, zipRelative: `clients/otelo/ausgabe/${zipName}`, quarter, monthYear };
}

export function signedPath(relative: string): string {
  return signPreview(relative);
}

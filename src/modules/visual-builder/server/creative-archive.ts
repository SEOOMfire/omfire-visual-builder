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
  sternText?: string;
  deko?: string;
  geraetName?: string;
  layoutBook?: AdjustBook;
  glance?: string;
  summary?: string;
};

const BLOCKING = /überlappt|unteren Rand|Orange-Anteil|Schräge|CTA-Leiste|CTA-Text|Fußnote|Ersatzschrift|mehr als|auf Orange|zu klein|zu weit|sicheren Zone/;

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

function requestFrom(draft: CreativeDraft) {
  return {
    name: draft.vorlage,
    motiv: draft.motiv,
    person: draft.person,
    headline: draft.headline,
    subline: draft.subline,
    button: draft.button,
    stoererTyp: draft.stoererTyp,
    preis: draft.preis,
    preisZusatz: draft.preisZusatz,
    einmalpreis: draft.einmalpreis,
    aktionText: draft.aktionText,
    pflichttext: draft.pflichttext,
    headlineVariante: draft.headlineVariante,
    orange: draft.layoutBook?.snap.orange ?? draft.orange,
    produktname: draft.produktname,
    datenmenge: draft.datenmenge,
    datenmengeAlt: draft.datenmengeAlt,
    einmalpreisZusatz: draft.einmalpreisZusatz,
    sternText: draft.sternText,
    deko: draft.deko,
    geraetName: draft.geraetName,
    kampagne: draft.kampagne,
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
  const spoken = typeof change.text === "string" ? change.text : typeof change.satz === "string" ? change.satz : "";
  if (!spoken && !Array.isArray(change.befehle)) {
    const result = applyToBook(draft.layoutBook ?? newBook(draft.orange), { befehle: [] });
    draft.layoutBook = result.book;
    draft.summary = "Felder des Entwurfs geändert.";
  }
  if (spoken || Array.isArray(change.befehle)) {
    const result = applyToBook(draft.layoutBook ?? newBook(draft.orange), spoken || { befehle: change.befehle });
    if (result.question) throw new Error(result.question);
    draft.layoutBook = result.book;
    draft.orange = result.book.snap.orange;
    draft.summary = result.summary;
  }
  const rendered = await renderTemplate(requestFrom(draft));
  if (rendered.deviceFile) draft.motiv = rendered.deviceFile;
  else if (rendered.personFile) draft.motiv = rendered.personFile;
  if (rendered.personFile && draft.vorlage === "product_person") draft.person = rendered.personFile;
  draft.hints = rendered.hints;
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
  const rendered = await renderTemplate(requestFrom(draft));
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

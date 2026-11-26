import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { OTELO_FORMATS } from "../otelo-formats";
import { clientRoot } from "./client-volume";
import { namePart, nextVersion, oteloFileName, oteloFolder, type OteloName } from "./naming";
import { PNG } from "pngjs";
import { encode as encodeJpeg } from "jpeg-js";
import { applyToBook, correctStarStep, finishAdjustSummary, holdStarScale, interpretCommands, newBook, parseAdjustText, seedBook, type AdjustBook, type AdjustCommand, type AdjustSnap, type FieldPatch } from "./adjust-commands";
import { applyEdits, applyMeasuredSizes, editsFromArgs, freshProblems, hintsForEdit, judgeEdits, planCreativeEdits, proposeLayoutFixes, type LayoutProblem, type LayoutStand } from "./edit-creative";
import { normalizeDeko, normalizeVorlage, type HeadlineVariant, type OrangeSide, type StoererTyp, type VorlageName } from "../otelo-scene";
import { layoutFrames, layoutStars, renderTemplate, type RenderedCreative } from "./otelo-render";
import { signPreview, storePreview } from "./previews";
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
  preisMonatAlt?: string;
  energielabel?: string;
  sternText?: string;
  deko?: string;
  geraetName?: string;
  motivWinkel?: string;
  layoutBook?: AdjustBook;
  glance?: string;
  summary?: string;
};

const BLOCKING = /überlappt|unteren Rand|Orange-Anteil|Schräge|CTA-Leiste|CTA-Text|CTA fehlt|Fußnote|Ersatzschrift|mehr als|auf Orange|zu klein|zu weit|sicheren Zone|Kopf ist nicht|zu kurz|Stern überdeckt|Pillentext|Wellen überlagern|nicht vollständig in der|außerhalb der Ränder|rechts angeschnitten|Geräteanteil/;

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
    deko: normalizeDeko(deko),
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
    preisAlt: draft.layoutBook?.snap.fields?.preisAlt ?? draft.preisAlt,
    preisMonatAlt: draft.layoutBook?.snap.fields?.preisMonatAlt ?? draft.preisMonatAlt,
    energielabel: draft.layoutBook?.snap.fields?.energielabel ?? draft.energielabel,
    sternText: draft.layoutBook?.snap.fields?.sternText ?? draft.sternText,
    deko: draft.layoutBook?.snap.fields?.deko ?? draft.deko,
    geraetName: draft.layoutBook?.snap.fields?.geraetName ?? draft.geraetName,
    motivWinkel: draft.layoutBook?.snap.fields?.motivWinkel ?? draft.motivWinkel,
    kampagne: draft.kampagne,
    sublineColor: draft.layoutBook?.snap.fields?.sublineColor,
    sternColor: draft.layoutBook?.snap.fields?.sternColor,
    headlineColor: draft.layoutBook?.snap.fields?.headlineColor,
    ctaColor: draft.layoutBook?.snap.fields?.ctaColor,
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

const FIELD_DIFF: Array<[keyof FieldPatch, string]> = [
  ["deko", "Deko"],
  ["datenmengeAlt", "Altwert"],
  ["datenmenge", "Datenmenge"],
  ["button", "CTA"],
  ["sternText", "Stern"],
  ["headline", "Headline"],
  ["subline", "Unterzeile"],
  ["sublineColor", "Unterzeilenfarbe"],
  ["geraetName", "Gerätename"],
  ["einmalpreis", "Einmalpreis"],
  ["preisAlt", "statt-Preis"],
  ["vorlage", "Vorlage"],
  ["motiv", "Motiv"],
];

export function versionDifference(left: AdjustSnap, right: AdjustSnap): string {
  const parts: string[] = [];
  for (const [key, label] of FIELD_DIFF) {
    const before = left.fields?.[key] ?? "";
    const after = right.fields?.[key] ?? "";
    if (before !== after) parts.push(`${label} „${before || "leer"}“ statt „${after || "leer"}“`);
  }
  if (left.orange !== right.orange) parts.push("die Seite");
  if (JSON.stringify(left.nudges) !== JSON.stringify(right.nudges)) parts.push("Größen oder Lagen");
  return parts.length ? `Unterschied: ${parts.join(", ")}.` : "Die Versionen sind gleich.";
}

function paintComparison(pairs: Array<{ left: Buffer; right: Buffer }>): Buffer {
  const rowH = 280;
  const gap = 12;
  const rows = pairs.map((pair) => {
    const left = PNG.sync.read(pair.left);
    const right = PNG.sync.read(pair.right);
    const lw = Math.round(rowH * left.width / left.height);
    const rw = Math.round(rowH * right.width / right.height);
    return { left, right, lw, rw };
  });
  const width = Math.max(...rows.map((row) => row.lw + gap + row.rw), 32);
  const height = rows.length * rowH + Math.max(0, rows.length - 1) * gap;
  const sheet = new PNG({ width, height });
  sheet.data.fill(0);
  const blit = (src: PNG, dx: number, dy: number, dw: number, dh: number) => {
    for (let y = 0; y < dh; y += 1) {
      const sy = Math.min(src.height - 1, Math.floor(y * src.height / dh));
      for (let x = 0; x < dw; x += 1) {
        const sx = Math.min(src.width - 1, Math.floor(x * src.width / dw));
        const to = ((dy + y) * width + dx + x) * 4;
        const from = (sy * src.width + sx) * 4;
        sheet.data[to] = src.data[from] ?? 0;
        sheet.data[to + 1] = src.data[from + 1] ?? 0;
        sheet.data[to + 2] = src.data[from + 2] ?? 0;
        sheet.data[to + 3] = 255;
      }
    }
  };
  rows.forEach((row, index) => {
    const y = index * (rowH + gap);
    blit(row.left, 0, y, row.lw, rowH);
    blit(row.right, row.lw + gap, y, row.rw, rowH);
  });
  return Buffer.from(encodeJpeg({ data: sheet.data, width, height }, 80).data);
}

function rememberMotifChoice(draft: CreativeDraft, rendered: RenderedCreative) {
  if (draft.motivWinkel || draft.layoutBook?.snap.fields?.motivWinkel || !rendered.motifNote) return;
  const angle = rendered.deviceFile?.match(/(?:^|[^0-9])(45|90|180)(?:[^0-9]|$)/)?.[1] ?? "45";
  draft.motivWinkel = angle;
  if (!draft.layoutBook) return;
  draft.layoutBook.snap.fields ??= {};
  draft.layoutBook.snap.fields.motivWinkel = angle;
  const entry = draft.layoutBook.history.find((item) => item.n === draft.layoutBook?.version);
  if (entry) {
    entry.snap.fields ??= {};
    entry.snap.fields.motivWinkel = angle;
  }
}

function applySnapFields(draft: CreativeDraft, fields: FieldPatch) {
  if (fields.headline !== undefined) draft.headline = fields.headline;
  if (fields.subline !== undefined) draft.subline = fields.subline;
  if (fields.button !== undefined) draft.button = fields.button;
  if (fields.sternText !== undefined) draft.sternText = fields.sternText;
  if (fields.datenmenge !== undefined) draft.datenmenge = fields.datenmenge;
  if (fields.datenmengeAlt !== undefined) draft.datenmengeAlt = fields.datenmengeAlt;
  if (fields.preis !== undefined) draft.preis = fields.preis;
  if (fields.preisZusatz !== undefined) draft.preisZusatz = fields.preisZusatz;
  if (fields.einmalpreis !== undefined) draft.einmalpreis = fields.einmalpreis;
  if (fields.einmalpreisZusatz !== undefined) draft.einmalpreisZusatz = fields.einmalpreisZusatz;
  if (fields.preisAlt !== undefined) draft.preisAlt = fields.preisAlt;
  if (fields.preisMonatAlt !== undefined) draft.preisMonatAlt = fields.preisMonatAlt;
  if (fields.geraetName !== undefined) draft.geraetName = fields.geraetName;
  if (fields.motivWinkel !== undefined) draft.motivWinkel = fields.motivWinkel;
  if (fields.pflichttext !== undefined) draft.pflichttext = fields.pflichttext;
  if (fields.deko !== undefined) draft.deko = fields.deko;
  if (fields.vorlage !== undefined) draft.vorlage = normalizeVorlage(fields.vorlage);
  if (fields.motiv !== undefined) draft.motiv = fields.motiv;
  if (fields.energielabel !== undefined) draft.energielabel = fields.energielabel;
  if (fields.headlineVariante !== undefined) draft.headlineVariante = fields.headlineVariante;
}

export async function adjustCreative(id: string, change: Record<string, unknown>): Promise<{ draft: CreativeDraft; rendered: RenderedCreative }> {
  const draft = await readDraft(id);
  if (!draft) throw new Error("Diesen Entwurf kenne ich nicht. Ruf zuerst compose_creative auf.");
  const fingerprint = () => JSON.stringify([draft.headline, draft.subline, draft.button, draft.motiv, draft.vorlage, draft.orange, draft.sternText, draft.datenmenge, draft.datenmengeAlt, draft.deko, draft.preis, draft.energielabel, draft.geraetName]);
  const beforeFields = fingerprint();
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
  const namedDeko = normalizeDeko(typeof change.deko === "string" ? change.deko : undefined);
  if (namedDeko) draft.deko = namedDeko;
  const decoBefore = draft.layoutBook?.snap.fields?.deko ?? draft.deko;
  const spoken = [change.text, change.anweisung, change.satz].find((value) => typeof value === "string" && value.trim()) as string | undefined ?? "";
  const versionBefore = draft.layoutBook?.version ?? 1;
  if (spoken || (Array.isArray(change.befehle) && change.befehle.length > 0)) {
    const preview = spoken ? parseAdjustText(spoken, draft.layoutBook?.snap.fields ?? {}) : { unknown: [] as string[] };
    const resolved: Array<{ clause: string; command: AdjustCommand }> = preview.unknown.length
      ? (await interpretCommands(spoken)).map((command) => ({ clause: "*", command }))
      : [];
    const beforeSnap = draft.layoutBook ? structuredClone(draft.layoutBook.snap) : undefined;
    const result = applyToBook(draft.layoutBook ?? newBook(draft.orange), spoken || { befehle: change.befehle }, resolved);
    if (result.starFactor && result.starFactor !== 1 && beforeSnap && result.book.version !== versionBefore) {
      const line = await settleStarGrowth(draft, result.book, beforeSnap, result.starFactor);
      if (line) {
        result.summary = result.summary.split("\n").map((row) => /umgesetzt: Störer \d+ % (größer|kleiner)|nicht möglich: Stern schon/.test(row) ? line : row).join("\n");
        const entry = result.book.history[result.book.history.length - 1];
        if (entry) result.book.history[result.book.history.length - 1] = { ...entry, summary: result.summary };
      }
    }
    if (result.question && result.book.version === versionBefore) {
      draft.summary = result.summary || `nicht verstanden: ${result.question}`;
      const rendered = await renderTemplate(fieldsForRender(draft));
      draft.hints = rendered.hints;
      rememberMotifChoice(draft, rendered);
      await writeDraft(draft);
      return { draft, rendered };
    }
    if (result.compare) {
      const left = result.book.history.find((entry) => entry.n === result.compare?.links);
      const right = result.book.history.find((entry) => entry.n === result.compare?.rechts);
      if (!left || !right) throw new Error(`Version ${result.compare.links} oder ${result.compare.rechts} kenne ich nicht.`);
      const renderSnap = (snap: typeof left.snap) => renderTemplate(fieldsForRender({ ...draft, layoutBook: { ...result.book, snap } }));
      const [first, second] = await Promise.all([renderSnap(left.snap), renderSnap(right.snap)]);
      const paired = first.formats.map((format, index) => ({
        left: Buffer.from(format.pngBase64, "base64"),
        right: Buffer.from(second.formats[index]?.pngBase64 ?? format.pngBase64, "base64"),
      }));
      const sheet = paintComparison(paired);
      const token = await storePreview(`${randomUUID()}-vergleich.jpg`, sheet);
      draft.summary = `Links Version ${left.n}, rechts Version ${right.n}. ${versionDifference(left.snap, right.snap)}`;
      await writeDraft(draft);
      return { draft, rendered: { ...second, token, jpeg: sheet.toString("base64") } };
    }
    draft.layoutBook = result.book;
    draft.orange = result.book.snap.orange;
    applySnapFields(draft, result.book.snap.fields ?? {});
    draft.summary = result.summary;
    if (result.book.version === versionBefore) {
      const rendered = await renderTemplate(fieldsForRender(draft));
      draft.hints = rendered.hints;
      rememberMotifChoice(draft, rendered);
      await writeDraft(draft);
      return { draft, rendered };
    }
  } else if (fingerprint() === beforeFields) {
    draft.summary = "nicht verstanden: Welches Element soll ich ändern?";
    const rendered = await renderTemplate(fieldsForRender(draft));
    draft.hints = rendered.hints;
    rememberMotifChoice(draft, rendered);
    await writeDraft(draft);
    return { draft, rendered };
  } else {
    draft.summary = "umgesetzt: Felder geschrieben.";
    if (draft.layoutBook) draft.layoutBook = { ...draft.layoutBook, version: draft.layoutBook.version + 1 };
  }
  const rendered = await renderTemplate(fieldsForRender(draft));
  if (rendered.deviceFile) draft.motiv = rendered.deviceFile;
  else if (rendered.personFile) draft.motiv = rendered.personFile;
  if (rendered.personFile && draft.vorlage === "product_person") draft.person = rendered.personFile;
  const decoNow = draft.layoutBook?.snap.fields?.deko ?? draft.deko;
  if (decoNow === decoBefore) rendered.hints = hintsForEdit(rendered.hints, []);
  draft.summary = finishAdjustSummary(draft.summary ?? "", rendered.hints);
  draft.hints = rendered.hints.filter((hint) => !/schon maximal groß|schon minimal klein/.test(hint));
  if (rendered.motifNote) draft.summary = `${draft.summary ?? ""} ${rendered.motifNote}`.trim();
  rememberMotifChoice(draft, rendered);
  const notes = [...new Set(rendered.hints.filter((hint) => hint.includes("Maximum vergrößert")).map((hint) => hint.replace(/^Hinweis: /, "").replace(/\.$/, "")))];
  if (notes.length) {
    const base = (draft.summary ?? "").replace(/\.\s*$/, "");
    draft.summary = `${base}${base ? ", " : ""}${notes.join(", ")}.`;
  }
  await writeDraft(draft);
  return { draft, rendered };
}

async function settleStarGrowth(draft: CreativeDraft, book: AdjustBook, beforeSnap: AdjustSnap, starFactor: number): Promise<string | undefined> {
  if (!starFactor || starFactor === 1) return undefined;
  const measure = (snap: AdjustSnap) => layoutStars({ ...fieldsForRender({ ...draft, layoutBook: { ...book, snap } }), layout: snap });
  const before = await measure(beforeSnap);
  let after = await measure(book.snap);
  const percent = Math.round((starFactor - 1) * 100);
  const first = correctStarStep(before, after, percent);
  if (first.holdIds.length) {
    for (const id of first.holdIds) holdStarScale(book.snap, id, starFactor);
    after = await measure(book.snap);
  }
  const line = correctStarStep(before, after, percent).line;
  const entry = book.history[book.history.length - 1];
  if (entry) book.history[book.history.length - 1] = { ...entry, snap: structuredClone(book.snap) };
  return line;
}

export async function editCreative(
  id: string,
  args: Record<string, unknown>,
  review?: (draft: CreativeDraft, rendered: RenderedCreative) => Promise<string>,
): Promise<{ draft: CreativeDraft; rendered: RenderedCreative; lines: string[]; corrections: string[]; stand: LayoutStand; glance: string }> {
  const draft = await readDraft(id);
  if (!draft) throw new Error("Diesen Entwurf kenne ich nicht. Ruf zuerst compose_creative auf.");
  const { edits, errors } = editsFromArgs(args);
  const book = draft.layoutBook ?? newBook(draft.orange);
  const beforeSnap = structuredClone(book.snap);
  const baseline = await layoutFrames({ ...fieldsForRender({ ...draft, layoutBook: { ...book, snap: beforeSnap } }), layout: beforeSnap });
  baseline.stand.felder.vorlage ||= draft.vorlage;
  baseline.stand.felder.kampagne ||= draft.kampagne;
  const planned = await planCreativeEdits(book, edits, async (current) => layoutFrames({ ...fieldsForRender({ ...draft, layoutBook: { ...current, snap: current.snap } }), layout: current.snap }));
  const applied = { book: planned.book, starFactor: undefined as number | undefined, notes: planned.notes };
  if (applied.starFactor && applied.starFactor !== 1 && applied.book.version !== book.version) {
    await settleStarGrowth(draft, applied.book, beforeSnap, applied.starFactor);
  }
  draft.layoutBook = applied.book;
  draft.orange = applied.book.snap.orange;
  applySnapFields(draft, applied.book.snap.fields ?? {});
  const paint = async (current: AdjustBook) => {
    draft.layoutBook = current;
    draft.orange = current.snap.orange;
    applySnapFields(draft, current.snap.fields ?? {});
    const rendered = await renderTemplate(fieldsForRender(draft));
    if (rendered.stand) {
      rendered.stand.version = current.version;
      rendered.stand.felder.version = String(current.version);
      rendered.stand.felder.kampagne ||= draft.kampagne;
      rendered.stand.felder.vorlage ||= draft.vorlage;
      if (rendered.measured) applyMeasuredSizes(current, rendered.stand, rendered.measured, edits, draft.vorlage);
    }
    return rendered;
  };
  let rendered = await paint(applied.book);
  const measuredProblems = (picture: RenderedCreative) => freshProblems(picture.layoutProblems ?? [], baseline.problems);
  const imageProblems = (note: string): LayoutProblem[] => note.split("\n").flatMap((row) => {
    const match = row.match(/^([^:\n]+):\s*nicht bestanden\b/i);
    return match?.[1] ? [{ format: match[1].trim(), text: row.trim() }] : [];
  });
  let problems = measuredProblems(rendered);
  const corrections: string[] = [];
  let glance = "";
  const propose = (liste: LayoutProblem[], picture: RenderedCreative) => proposeLayoutFixes({
    probleme: liste,
    stand: picture.stand ?? baseline.stand,
    bildBase64: picture.jpeg,
  });
  for (let round = 0; round < 3; round += 1) {
    if (!problems.length && review && !glance) {
      glance = await review(draft, rendered);
      problems = imageProblems(glance);
    }
    if (!problems.length) break;
    const proposal = await propose(problems, rendered);
    if (!proposal.length) break;
    const kept = { book: draft.layoutBook ?? applied.book, rendered, problems, glance };
    const next = applyEdits(kept.book, proposal);
    const again = await paint(next.book);
    const againMeasured = measuredProblems(again);
    const againGlance = againMeasured.length || !review ? "" : await review(draft, again);
    const againProblems = againMeasured.length ? againMeasured : imageProblems(againGlance);
    if (againProblems.length >= kept.problems.length) {
      draft.layoutBook = kept.book;
      rendered = await paint(kept.book);
      glance = kept.glance;
      break;
    }
    corrections.push(`Korrektur: ${judgeEdits(proposal, kept.rendered.stand ?? baseline.stand, again.stand ?? baseline.stand).join(" ")}`);
    rendered = again;
    problems = againProblems;
    glance = againGlance;
  }
  const afterStand: LayoutStand = rendered.stand ?? { ...baseline.stand, version: draft.layoutBook?.version ?? 1 };
  if (draft.layoutBook && JSON.stringify(draft.layoutBook.snap) === JSON.stringify(beforeSnap)) draft.layoutBook = book;
  afterStand.version = draft.layoutBook?.version ?? book.version;
  afterStand.felder.version = String(afterStand.version);
  const lines = [...errors, ...planned.lines, ...planned.hints.filter((hint) => !draft.hints.includes(hint))];
  const starSized = edits.some((edit) => edit.ziel === "stern" && (edit.aktion === "groesser" || edit.aktion === "kleiner" || (edit.aktion === "setzen" && typeof edit.wert === "object" && edit.wert.groesse !== undefined)));
  if (starSized) corrections.push(...(rendered.clampNotes ?? []).filter((note) => !corrections.includes(note)));
  else if ((rendered.clampNotes ?? []).length && !draft.hints.some((hint) => /kleiner machen/.test(hint))) lines.push("Hinweis: Stern überlappt Kachel, kleiner machen?");
  rendered.hints = hintsForEdit(rendered.hints ?? [], edits);
  if ((draft.layoutBook?.version ?? book.version) === book.version) lines.push(`Die Version bleibt ${book.version}, keine Änderung wurde umgesetzt.`);
  const entry = draft.layoutBook?.history.find((item) => item.n === draft.layoutBook?.version);
  if (entry) {
    entry.summary = [...lines, ...corrections].filter(Boolean).join("\n");
    entry.snap = structuredClone(draft.layoutBook?.snap);
  }
  draft.summary = [...lines, ...corrections].filter(Boolean).join("\n");
  draft.hints = (rendered.hints ?? []).filter((hint) => !/schon maximal groß|schon minimal klein/.test(hint));
  if (rendered.deviceFile) draft.motiv = rendered.deviceFile;
  else if (rendered.personFile) draft.motiv = rendered.personFile;
  await writeDraft(draft);
  return { draft, rendered, lines, corrections, stand: afterStand, glance };
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
    preisMonatAlt: fields.preisMonatAlt,
    energielabel: fields.energielabel,
    sternText: fields.sternText,
    deko: fields.deko,
    geraetName: fields.geraetName,
    layoutBook: seedBook(fields.orange, {
      headline: fields.headline,
      subline: fields.subline,
      button: fields.button,
      sternText: fields.sternText ?? "",
      datenmenge: fields.datenmenge ?? "",
      datenmengeAlt: fields.datenmengeAlt ?? "",
      preis: fields.preis,
      preisZusatz: fields.preisZusatz,
      einmalpreis: fields.einmalpreis,
      einmalpreisZusatz: fields.einmalpreisZusatz,
      preisAlt: fields.preisAlt ?? "",
      preisMonatAlt: fields.preisMonatAlt ?? "",
      geraetName: fields.geraetName ?? "",
      pflichttext: fields.pflichttext,
      deko: fields.deko === "bw_wellen" || fields.deko === "fruehling_blaetter" || fields.deko === "keine" ? fields.deko : undefined,
      vorlage: rendered.name,
      motiv: rendered.deviceFile || rendered.personFile || fields.motiv,
      energielabel: fields.energielabel ?? "",
      headlineVariante: fields.headlineVariante,
    }),
  };
  rememberMotifChoice(draft, rendered);
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

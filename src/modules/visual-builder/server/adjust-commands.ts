import { OTELO_FORMATS } from "../otelo-formats";
import { openRouterComplete, openRouterConfig } from "../../../platform/ai/openrouter";
import { buildScene, elementRelation, sceneFormatLabel, type OrangeSide, type SceneCopy, type SquareFollow, type VorlageName } from "../otelo-scene";

export type ElementId = "headline" | "subline" | "stoerer" | "person" | "geraet" | "cta" | "logo" | "pflichttext" | "energielabel" | "schraege" | "deko" | "kachel" | "pfeile" | "altwert" | "datenmenge" | "stattpreis" | "zusatz" | "einmalig" | "geraetename";

export type Nudge = { dx: number; dy: number; scale: number; flip: boolean; hidden: boolean; z?: number; color?: string };

/** Stacking order of the template. A stored z is the deviation from this number. */
export const ELEMENT_LAYER: Record<ElementId, number> = {
  deko: 1,
  person: 2,
  geraet: 2,
  schraege: 2,
  kachel: 3,
  datenmenge: 3,
  altwert: 3,
  einmalig: 3,
  stattpreis: 3,
  zusatz: 4,
  energielabel: 4,
  geraetename: 4,
  headline: 5,
  pfeile: 5,
  subline: 6,
  cta: 7,
  stoerer: 8,
  logo: 9,
  pflichttext: 9,
};

export type FieldPatch = {
  headline?: string;
  subline?: string;
  button?: string;
  sternText?: string;
  datenmenge?: string;
  datenmengeAlt?: string;
  preis?: string;
  preisZusatz?: string;
  einmalpreis?: string;
  einmalpreisZusatz?: string;
  preisAlt?: string;
  preisMonatAlt?: string;
  geraetName?: string;
  pflichttext?: string;
  deko?: "bw_wellen" | "fruehling_blaetter" | "keine";
  vorlage?: string;
  motiv?: string;
  energielabel?: string;
  headlineVariante?: "direkt" | "box";
  sublineColor?: string;
  sternColor?: string;
  headlineColor?: string;
  ctaColor?: string;
  motivWinkel?: string;
  kampagne?: string;
};

export type AdjustSnap = {
  orange: OrangeSide;
  nudges: Record<string, Partial<Record<ElementId, Nudge>>>;
  fields: FieldPatch;
  follows?: SquareFollow[];
};

export type VersionEntry = { n: number; summary: string; snap: AdjustSnap };

export type AdjustBook = { version: number; snap: AdjustSnap; history: VersionEntry[] };

export type AdjustCommand =
  | { op: "verschieben"; element: ElementId; richtung: "oben" | "unten" | "links" | "rechts"; prozent: number; formate?: string[] }
  | { op: "abstand"; von: ElementId; nach: ElementId; mehr: boolean; formate?: string[] }
  | { op: "groesse"; element: ElementId; faktor: number; formate?: string[] }
  | { op: "spiegeln"; element: ElementId; formate?: string[] }
  | { op: "seite_tauschen"; formate?: string[] }
  | { op: "sichtbarkeit"; element: ElementId; sichtbar: boolean; formate?: string[] }
  | { op: "text"; element: ElementId; text: string; formate?: string[] }
  | { op: "farbe"; element: ElementId; farbe: string; hinweis?: string; formate?: string[] }
  | { op: "deko_setzen"; name: "bw_wellen" | "fruehling_blaetter" | "keine" }
  | { op: "vorlage_setzen"; vorlage: string; motiv?: string; hinweis?: string }
  | { op: "feld"; key: keyof FieldPatch; value: string; hinweis?: string }
  | { op: "wie_format"; quelle: string; element?: ElementId; formate?: string[] }
  | { op: "zuruecksetzen"; element: ElementId; formate?: string[] }
  | { op: "parameter"; element: ElementId; formate?: string[]; x?: number; y?: number; groesse?: number; ebene?: number }
  | { op: "rueckgaengig" }
  | { op: "version"; nummer: number }
  | { op: "vergleichen"; links: number; rechts: number };

const WORDS: Array<[RegExp, ElementId]> = [
  [/statt[-\s]?preis/i, "stattpreis"],
  [/preis[-\s]?zusatz/i, "zusatz"],
  [/ger[äa]tename/i, "geraetename"],
  [/\beinmalig\b/i, "einmalig"],
  [/altwert|alter wert/i, "altwert"],
  [/datenmenge/i, "datenmenge"],
  [/pfeile|chevron/i, "pfeile"],
  [/\bkachel\b/i, "kachel"],
  [/stern/i, "stoerer"],
  [/st[öo]rer|preis|raute/i, "stoerer"],
  [/frau|model|person|figur/i, "person"],
  [/ger[äa]t|handy|produkt(?!name)/i, "geraet"],
  [/headline|[üu]berschrift/i, "headline"],
  [/subline|unterzeile/i, "subline"],
  [/button|cta|leiste/i, "cta"],
  [/logo|wortmarke/i, "logo"],
  [/pflichttext|kleingedruckt/i, "pflichttext"],
  [/energielabel|energie/i, "energielabel"],
  [/schr[äa]ge|slant|teilung/i, "schraege"],
  [/deko|wellen|bl[äa]tter/i, "deko"],
];

const PALETTE: Record<string, string> = {
  lime: "#D7EB00",
  orange: "#FA5A14",
  schwarz: "#000000",
  weiß: "#FFFFFF",
  weiss: "#FFFFFF",
};

const FIELD_LABEL: Record<string, keyof FieldPatch> = {
  headline: "headline",
  unterzeile: "subline",
  subline: "subline",
  cta: "button",
  button: "button",
  leiste: "button",
  stern: "sternText",
  störer: "sternText",
  stoerer: "sternText",
  datenmenge: "datenmenge",
  altwert: "datenmengeAlt",
  preis: "preis",
  zusatz: "preisZusatz",
  einmalpreis: "einmalpreis",
  gerätename: "geraetName",
  geraetename: "geraetName",
  pflichttext: "pflichttext",
};

export const ADJUST_HELP = [
  "Elemente: Headline, Unterzeile, CTA, Stern, Kachel, Datenmenge, Altwert, Preis, Zusatz, Einmalpreis, Gerätename, Pflichttext, Frau, Gerät, Logo, Energielabel, Pfeile, Deko, Schräge.",
  "Texte: „CTA: Jetzt wechseln“, „Stern: NUR BIS SONNTAG“, „Unterzeile: gleicher Preis“.",
  "Sichtbar: „Stern weg“, „Stern wieder rein mit NUR BIS SONNTAG“, „Altwert weg“, „Logo weg“, „Energielabel B dazu“, „Pfeile weg“.",
  "Varianten: „nimm Blätter statt Wellen“, „Deko keine“, „Gerät statt Person: Galaxy A56, Energielabel B“, „Headline als Box“.",
  "Lage: „Kachel etwas höher“, „Frau deutlich größer“, „Frau spiegeln“, „auf die andere Seite“, „mehr Luft zwischen Headline und Kachel“, „Stern im 9x16 wie im Quadrat“.",
  "Kleintexte: „statt-Preis größer“, „Altwert größer“, „Preiszusatz größer“, „Gerätename größer“, „Einmalig größer“.",
  "Farben nur Lime, Orange, Schwarz, Weiß: „Unterzeile in Lime“, „Stern in Lime“.",
  "Geltung: alle Formate, „nur 9x16“, „nur PMax“, „nur TikTok“, „außer 1200x628“.",
  "Versionen: „rückgängig“, „zurück zu Version 2“, „vergleiche Version 2 und 4“.",
].join(" ");

export function emptyNudge(): Nudge {
  return { dx: 0, dy: 0, scale: 1, flip: false, hidden: false };
}

export function emptySnap(orange: OrangeSide = "rechts"): AdjustSnap {
  return { orange, nudges: {}, fields: {} };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const LABEL: Record<ElementId, string> = {
  headline: "Headline",
  subline: "Subline",
  stoerer: "Störer",
  person: "Frau",
  geraet: "Gerät",
  cta: "Leiste",
  logo: "Logo",
  pflichttext: "Pflichttext",
  energielabel: "Energielabel",
  schraege: "Schräge",
  deko: "Deko",
  kachel: "Kachel",
  pfeile: "Pfeile",
  altwert: "Altwert",
  datenmenge: "Datenmenge",
  stattpreis: "statt-Preis",
  zusatz: "Zusatz",
  einmalig: "Einmalig",
  geraetename: "Gerätename",
};

function elementIn(text: string): ElementId | undefined {
  return WORDS.find(([pattern]) => pattern.test(text))?.[1];
}

function windowAmount(text: string, verb: RegExp, kind: "move" | "size"): number {
  const at = text.search(verb);
  const before = at < 0 ? text : text.slice(Math.max(0, at - 28), at);
  const after = at < 0 ? "" : text.slice(at, at + 14);
  const percent = after.match(/(\d+(?:[.,]\d+)?)\s*(?:%|prozent)/i) ?? before.match(/(\d+(?:[.,]\d+)?)\s*(?:%|prozent)/i);
  if (percent) return Number(percent[1].replace(",", "."));
  const slice = before;
  if (kind === "move") {
    if (/etwas/i.test(slice)) return 3;
    if (/deutlich/i.test(slice)) return 12;
    return 6;
  }
  if (/deutlich/i.test(slice)) return 30;
  return 15;
}

function splitClauses(text: string): string[] {
  const out: string[] = [];
  const chunks = text.replace(/(\d),(\d)/g, "$1\u0001$2").split(/\s*,\s*/).map((chunk) => chunk.replace(/\u0001/g, ","));
  for (const chunk of chunks) {
    const held = chunk.replace(/zwischen\s+.+?\s+und\s+[^\s,]+/gi, (match) => match.replace(/\s+und\s+/i, " \u0000und\u0000 "));
    const bits = held.split(/\s+und\s+/i).map((bit) => bit.replace(/\u0000und\u0000/g, "und").replace(/\s+/g, " ").trim());
    let current = bits[0] ?? "";
    for (const bit of bits.slice(1)) {
      const next = elementIn(bit);
      const currentElement = elementIn(current);
      const closed = /(?:hei[sß]en|lauten|sein)$/i.test(current.trim());
      if (closed || (next && next !== currentElement) || /^auf die andere seite/i.test(bit.trim())) {
        out.push(current.trim());
        current = bit;
      } else current = `${current} und ${bit}`;
    }
    if (current.trim()) out.push(current.trim());
  }
  return out;
}

const FORMAT_IDS = ["pmax-1200x1200", "pmax-1200x628", "pmax-960x1200", "meta-1x1", "meta-9x16", "tiktok-9x16"];

function formatsIn(text: string): string[] | undefined {
  if (/nur\s+tiktok/i.test(text)) return ["tiktok-9x16"];
  if (/nur\s+pmax/i.test(text)) return ["pmax-1200x1200", "pmax-1200x628", "pmax-960x1200"];
  if (/nur\s+meta/i.test(text)) return ["meta-1x1", "meta-9x16"];
  const except = text.match(/außer\s+(?:dem\s+)?(\d{3,4}\s*x\s*\d{3,4}|9x16|1x1)/i);
  if (except) {
    const token = except[1].replace(/\s+/g, "").toLowerCase();
    return FORMAT_IDS.filter((id) => !id.includes(token));
  }
  if (/\b9\s*x\s*16\b/i.test(text)) return ["9x16"];
  if (/\b1\s*x\s*1\b/i.test(text)) return ["1x1"];
  const found = [...text.matchAll(/(\d{3,4})\s*x\s*(\d{3,4})/gi)].map((match) => `${match[1]}x${match[2]}`);
  return found.length ? found : undefined;
}

function money(value: string): number | undefined {
  const match = value.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?/);
  if (!match) return undefined;
  const raw = match[0].includes(",") ? match[0].replace(/\./g, "").replace(",", ".") : match[0];
  const number = Number(raw);
  return Number.isFinite(number) ? number : undefined;
}

function splitStatt(value: string): { neu: string; alt?: string } {
  const match = value.trim().match(/^(.*?)\s+statt\s+(.+)$/i);
  if (!match?.[1] || !match[2]) return { neu: value.trim() };
  return { neu: match[1].trim(), alt: match[2].trim() };
}

function fieldKey(label: string): keyof FieldPatch | undefined {
  return FIELD_LABEL[label.toLowerCase()];
}

function unquote(value: string): string {
  return value.trim().replace(/^[„“"'«»]+|[“”"'«»]+$/g, "").replace(/\s+/g, " ").trim();
}

function dekoToken(value: string): "bw_wellen" | "fruehling_blaetter" | "keine" | undefined {
  if (/bl[äa]tter|laub/i.test(value)) return "fruehling_blaetter";
  if (/wellen/i.test(value)) return "bw_wellen";
  if (/keine|ohne|weg/i.test(value)) return "keine";
  return undefined;
}

type TextField = "button" | "headline" | "subline" | "sternText" | "preis" | "datenmenge";

function textField(label: string): TextField | undefined {
  if (/datenmenge/i.test(label)) return "datenmenge";
  if (/stern|st[öo]rer/i.test(label)) return "sternText";
  if (/unterzeile|subline/i.test(label)) return "subline";
  if (/headline|[üu]berschrift/i.test(label)) return "headline";
  if (/button|cta|leiste/i.test(label)) return "button";
  if (/^preis\b|monatspreis/i.test(label)) return "preis";
  return undefined;
}

function cleanSpokenValue(raw: string): string {
  return unquote(raw).replace(/[.!]+$/g, "").replace(/\s+(?:hei[sß]en|lauten|sein)$/i, "").trim();
}

/** A banner text must not still contain the rest of the instruction. */
export function plausibleText(value: string): boolean {
  return !/\b(?:mach|ändere|aendere|änder|aender|setze|setzen|nimm|hei[sß]en|lauten|soll|und dann)\b/i.test(value)
    && !/\b(?:cta|button|stern|st[öo]rer|unterzeile|headline|datenmenge|deko|preis)\b/i.test(value);
}

function commandsForText(field: TextField, raw: string, element: ElementId | undefined, formate?: string[]): AdjustCommand[] {
  const text = cleanSpokenValue(raw);
  if (!text || /^(?:etwas|deutlich)?\s*(?:gr[öo]ßer|kleiner)$/i.test(text) || !plausibleText(text)) return [];
  if (field === "datenmenge") {
    const parts = splitStatt(text);
    const commands: AdjustCommand[] = [{ op: "feld", key: "datenmenge", value: parts.neu }];
    if (parts.alt) commands.push({ op: "feld", key: "datenmengeAlt", value: parts.alt });
    return commands;
  }
  if (field === "preis") {
    const parts = splitStatt(text);
    const alt = parts.alt;
    const higher = alt ? (money(alt) ?? 0) > (money(parts.neu) ?? 0) : false;
    const commands: AdjustCommand[] = [{ op: "feld", key: "preis", value: parts.neu, hinweis: alt && !higher ? `${alt} ist nicht höher, kein statt.` : undefined }];
    if (alt && higher) commands.push({ op: "feld", key: "preisMonatAlt", value: alt });
    return commands;
  }
  const who: ElementId = field === "button" ? "cta" : field === "sternText" ? "stoerer" : field === "subline" ? "subline" : "headline";
  return [{ op: "text", element: element ?? who, text, formate }];
}

function fieldByValue(fields: FieldPatch, raw: string): keyof FieldPatch | undefined {
  const needle = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const pairs: Array<[keyof FieldPatch, string | undefined]> = [
    ["datenmenge", fields.datenmenge],
    ["datenmengeAlt", fields.datenmengeAlt],
    ["preis", fields.preis],
    ["subline", fields.subline],
    ["headline", fields.headline],
    ["button", fields.button],
    ["sternText", fields.sternText],
    ["einmalpreis", fields.einmalpreis],
    ["geraetName", fields.geraetName],
  ];
  return pairs.find(([, value]) => value && value.trim().toLowerCase().replace(/\s+/g, " ") === needle)?.[0];
}

function replaceCurrent(fields: FieldPatch, from: string, to: string): AdjustCommand | undefined {
  const key = fieldByValue(fields, from);
  if (!key) return undefined;
  const value = cleanSpokenValue(to);
  if (!value || !plausibleText(value)) return undefined;
  if (key === "headline" || key === "subline" || key === "button" || key === "sternText") {
    const element: ElementId = key === "button" ? "cta" : key === "sternText" ? "stoerer" : key === "headline" ? "headline" : "subline";
    return { op: "text", element, text: value };
  }
  return { op: "feld", key, value };
}

function commandsFromClause(clause: string, inherited: ElementId | undefined, formate: string[] | undefined, fields: FieldPatch): { commands: AdjustCommand[]; element?: ElementId; question?: string } {
  const commands: AdjustCommand[] = [];
  const labeled = clause.match(/^([a-zäöü0-9-]+)\s*:\s*(.+)$/i);
  if (labeled) {
    const key = fieldKey(labeled[1] ?? "");
    const element = elementIn(labeled[1] ?? "") ?? inherited;
    if (key) {
      const text = cleanSpokenValue(labeled[2] ?? "");
      if (!plausibleText(text)) return { commands, element };
      commands.push({ op: "text", element: element ?? "headline", text, formate });
      return { commands, element };
    }
  }
  const quoted = clause.match(/[„“"']([^„“”"']+)[”"']/);
  const auf = clause.match(/(?:ändern|aendern|setzen)\s+auf\s+(.+)$/i);
  const replacement = unquote(quoted?.[1] ?? auf?.[1] ?? "");
  const named = elementIn(clause) ?? inherited;
  if (replacement && named && /ändern|aendern|setzen|text/i.test(clause)) {
    commands.push({ op: "text", element: named, text: replacement, formate });
    return { commands, element: named };
  }
  if (/wie im quadrat/i.test(clause)) {
    const element = elementIn(clause) ?? inherited;
    if (!element) return { commands, question: "Welches Element soll wie im Quadrat sitzen? Zum Beispiel der Stern." };
    commands.push({ op: "wie_format", quelle: "1200x1200", element, formate: formatsIn(clause) });
    return { commands, element };
  }
  const angle = clause.match(/^(?:nimm\s+(?:die\s+)?)?(45|90|180)\s*(?:°|grad)?$/i);
  if (angle?.[1]) {
    commands.push({ op: "feld", key: "motivWinkel", value: angle[1] });
    return { commands, element: "geraet" };
  }
  if (/ohne\s+deko|deko\s+(?:weg|keine)|keine\s+deko/i.test(clause)) {
    commands.push({ op: "deko_setzen", name: "keine" });
    return { commands, element: "deko" };
  }
  const durch = clause.match(/(.+?)\s+durch\s+(.+?)\s+ersetzen/i);
  const stattDeko = clause.match(/(.+?)\s+statt\s+(.+)/i);
  const dekoPick = durch ? dekoToken(durch[2] ?? "") : stattDeko ? dekoToken(stattDeko[1] ?? "") : undefined;
  if (dekoPick && (durch || (stattDeko && dekoToken(stattDeko[2] ?? "")))) {
    commands.push({ op: "deko_setzen", name: dekoPick });
    return { commands, element: "deko" };
  }
  const takeDeko = clause.match(/^(?:nimm|deko)\s+(.+)$/i);
  const taken = takeDeko ? dekoToken(takeDeko[1] ?? "") : undefined;
  if (taken) {
    commands.push({ op: "deko_setzen", name: taken });
    return { commands, element: "deko" };
  }
  const spokenText = clause.match(/^(?:(?:ändere|aendere|änder|aender)\s+(?:den|die|das)\s+)?(headline|[üu]berschrift|unterzeile|subline|cta|button|leiste|stern(?:-?\s?text)?|st[öo]rer|preis|datenmenge)\s+(?:auf|in|zu|soll)\s+(.+)$/i);
  if (spokenText) {
    const field = textField(spokenText[1] ?? "");
    const value = cleanSpokenValue(spokenText[2] ?? "");
    const colorWord = /^(?:lime|orange|schwarz|wei[ßs]|rot|blau|gr[üu]n)$/i.test(unquote(value));
    if (field && !colorWord && !/^(?:etwas\s+|deutlich\s+)?(?:gr[öo]ßer|kleiner)$/i.test(value)) {
      commands.push(...commandsForText(field, value, named, formate));
      if (commands.length) return { commands, element: field === "button" ? "cta" : field === "sternText" ? "stoerer" : field === "subline" ? "subline" : field === "preis" ? "stoerer" : "headline" };
    }
  }
  if (/ger[äa]t\s+statt\s+person/i.test(clause)) {
    const motiv = clause.split(":").slice(1).join(":").split(/,|energielabel/i)[0]?.trim();
    commands.push({ op: "vorlage_setzen", vorlage: "kachel_geraet", motiv: motiv || undefined });
    return { commands, element: "geraet" };
  }
  const fromCurrent = clause.match(/^mach\s+aus\s+(?:den|der|dem|die)?\s*(.+?)\s+(\d+(?:[.,]\d+)?\s*(?:gb|€))\s*$/i)
    ?? clause.match(/^aus\s+(.+?)\s+wird\s+(.+)$/i);
  if (fromCurrent?.[1] && fromCurrent[2]) {
    const command = replaceCurrent(fields, fromCurrent[1], fromCurrent[2]);
    if (command) {
      commands.push(command);
      return { commands, element: command.op === "text" ? command.element : "datenmenge" };
    }
  }
  const sizeWord = /^(?:deutlich\s+|etwas\s+)?(?:gr[öo]ßer|groesser|kleiner)\b/i;
  const deviceName = clause.match(/^(?:ger[äa]tename|modell)\s+(.+)$/i) ?? (/^name\s+\S*\d/i.test(clause) ? clause.match(/^name\s+(.+)$/i) : null);
  if (deviceName?.[1] && !sizeWord.test(deviceName[1])) {
    commands.push({ op: "feld", key: "geraetName", value: deviceName[1].trim() });
    return { commands, element: "geraet" };
  }
  const onceExtra = clause.match(/^(?:einmalpreis[- ]zusatz|zuzahlung zusatz)\s+(.+)$/i);
  if (onceExtra?.[1]) {
    commands.push({ op: "feld", key: "einmalpreisZusatz", value: onceExtra[1].trim() });
    return { commands, element: "geraet" };
  }
  const once = clause.match(/^(?:einmalig|einmalpreis|zuzahlung)\s+(.+)$/i);
  if (once?.[1] && !sizeWord.test(once[1])) {
    const parts = splitStatt(once[1]);
    const alt = parts.alt;
    const higher = alt ? (money(alt) ?? 0) > (money(parts.neu) ?? 0) : false;
    commands.push({ op: "feld", key: "einmalpreis", value: parts.neu, hinweis: alt && !higher ? `${alt} ist nicht höher, kein statt.` : undefined });
    if (alt && higher) commands.push({ op: "feld", key: "preisAlt", value: alt });
    return { commands, element: "geraet" };
  }
  const data = clause.match(/^(?:datenmenge\s+)?(\d+(?:[.,]\d+)?\s*gb(?:\s+statt\s+\d+(?:[.,]\d+)?\s*gb)?)$/i);
  if (data?.[1]) {
    const parts = splitStatt(data[1]);
    commands.push({ op: "feld", key: "datenmenge", value: parts.neu });
    if (parts.alt) commands.push({ op: "feld", key: "datenmengeAlt", value: parts.alt });
    return { commands, element: "datenmenge" };
  }
  const monthly = clause.match(/^(?:preis|monatlich|monatspreis)\s+(.+)$/i);
  if (monthly?.[1]) {
    const parts = splitStatt(monthly[1]);
    const alt = parts.alt;
    const higher = alt ? (money(alt) ?? 0) > (money(parts.neu) ?? 0) : false;
    commands.push({ op: "feld", key: "preis", value: parts.neu, hinweis: alt && !higher ? `${alt} ist nicht höher, kein statt.` : undefined });
    if (alt && higher) commands.push({ op: "feld", key: "preisMonatAlt", value: alt });
    return { commands, element: "geraet" };
  }
  const oldPrice = clause.match(/^statt\s+(.+)$/i);
  if (oldPrice?.[1]) {
    commands.push({ op: "feld", key: "preisAlt", value: oldPrice[1].trim() });
    return { commands, element: "geraet" };
  }
  if (/person\s+statt\s+ger[äa]t/i.test(clause)) {
    const motiv = clause.split(":").slice(1).join(":").trim();
    commands.push({ op: "vorlage_setzen", vorlage: "kachel_person", motiv: motiv || undefined });
    return { commands, element: "person" };
  }
  const energy = clause.match(/energielabel\s+([a-g])\b/i);
  if (energy && !/luft/i.test(clause)) {
    commands.push({ op: "feld", key: "energielabel", value: (energy[1] ?? "A").toUpperCase() });
    return { commands, element: "energielabel" };
  }
  const air = clause.match(/(mehr|weniger)\s+luft\s+zwischen\s+(.+?)\s+und\s+(.+)/i);
  if (air || /luft/i.test(clause)) {
    const from = elementIn(air?.[2] ?? "");
    const to = elementIn(air?.[3] ?? "");
    if (!air || !from || !to) return { commands, question: "Vorschlag: mehr Luft zwischen Headline und Kachel." };
    commands.push({ op: "abstand", von: from, nach: to, mehr: /^mehr/i.test(air[1] ?? ""), formate });
    return { commands, element: to };
  }
  const element = elementIn(clause) ?? inherited;
  const again = clause.match(/wieder rein(?:\s+mit\s+(.+))?/i);
  if (again) {
    const who = element ?? "stoerer";
    commands.push({ op: "sichtbarkeit", element: who, sichtbar: true, formate });
    if (again[1]) commands.push({ op: "text", element: who, text: again[1].trim(), formate });
    return { commands, element: who };
  }
  const color = clause.match(/\bin\s+(lime|orange|schwarz|wei[ßs]|rot|blau|gr[üu]n)\b/i);
  if (color) {
    const asked = (color[1] ?? "").toLowerCase();
    const hex = PALETTE[asked] ?? PALETTE[asked.replace("ß", "ss")];
    if (!hex) return { commands, question: `${color[1]} ist nicht in der Markenpalette. Möglich sind Lime, Orange, Schwarz und Weiß.` };
    if (!element) return { commands, question: "Welches Element soll die Farbe bekommen? Zum Beispiel die Unterzeile oder der Stern." };
    const bad = hex === "#000000" && (element === "subline" || element === "headline");
    commands.push({ op: "farbe", element, farbe: bad ? "#FFFFFF" : hex, hinweis: bad ? "Schwarz auf Schwarz wäre unlesbar, ich nehme Weiß." : undefined, formate });
    return { commands, element };
  }
  if (/auf die andere seite/i.test(clause)) commands.push({ op: "seite_tauschen", formate });
  if (/spiegel/i.test(clause)) {
    if (!element) return { commands, question: "Welches Element soll ich spiegeln?" };
    commands.push({ op: "spiegeln", element, formate });
  }
  if (/kleiner/i.test(clause)) {
    if (!element) return { commands, question: "Welches Element soll kleiner werden?" };
    commands.push({ op: "groesse", element, faktor: 1 - windowAmount(clause, /kleiner/i, "size") / 100, formate });
  } else if (/gr[öo]ßer|groesser/i.test(clause)) {
    if (!element) return { commands, question: "Welches Element soll größer werden?" };
    commands.push({ op: "groesse", element, faktor: 1 + windowAmount(clause, /gr[öo]ßer|groesser/i, "size") / 100, formate });
  } else if (element === "deko" && /st[äa]rker|\bmehr\b/i.test(clause)) {
    commands.push({ op: "groesse", element, faktor: 1.25, formate });
  } else if (element === "deko" && /schw[äa]cher|\bweniger\b/i.test(clause)) {
    commands.push({ op: "groesse", element, faktor: 0.75, formate });
  }
  const down = /tiefer|nach unten|runter/i;
  const up = /h[öo]her|nach oben/i;
  const left = /nach links/i;
  const right = /nach rechts/i;
  if (down.test(clause) || up.test(clause) || left.test(clause) || right.test(clause)) {
    if (!element) return { commands, question: "Welches Element soll ich verschieben?" };
    const richtung = down.test(clause) ? "unten" : up.test(clause) ? "oben" : left.test(clause) ? "links" : "rechts";
    const verb = richtung === "unten" ? down : richtung === "oben" ? up : richtung === "links" ? left : right;
    commands.push({ op: "verschieben", element, richtung, prozent: windowAmount(clause, verb, "move"), formate });
  }
  if (/ausblenden|verstecken|\bweg\b/i.test(clause)) {
    if (!element) return { commands, question: "Welches Element soll ich ausblenden?" };
    commands.push({ op: "sichtbarkeit", element, sichtbar: false, formate });
  }
  if (/einblenden/i.test(clause)) {
    if (!element) return { commands, question: "Welches Element soll ich einblenden?" };
    commands.push({ op: "sichtbarkeit", element, sichtbar: true, formate });
  }
  return { commands, element };
}

export function parseAdjustText(text: string, fields: FieldPatch = {}): { commands: AdjustCommand[]; question?: string; unknown: string[] } {
  const raw = text.trim();
  if (!raw) return { commands: [], unknown: [], question: "Welches Element soll ich ändern?" };
  if (/^r[üu]ckg[äa]ngig\.?$/i.test(raw) || /\br[üu]ckg[äa]ngig\b/i.test(raw) && raw.split(/\s+/).length < 4) return { commands: [{ op: "rueckgaengig" }], unknown: [] };
  const backTo = raw.match(/zur[üu]ck zu version\s+(\d+)/i);
  if (backTo) return { commands: [{ op: "version", nummer: Number(backTo[1]) }], unknown: [] };
  const compare = raw.match(/vergleiche version\s+(\d+)\s+und\s+(\d+)/i);
  if (compare) return { commands: [{ op: "vergleichen", links: Number(compare[1]), rechts: Number(compare[2]) }], unknown: [] };
  const restore = raw.match(/version\s+(\d+)/i);
  if (restore && /wiederherstell/i.test(raw)) return { commands: [{ op: "version", nummer: Number(restore[1]) }], unknown: [] };
  const commands: AdjustCommand[] = [];
  const unknown: string[] = [];
  const questions: string[] = [];
  let carried: ElementId | undefined;
  for (const clause of splitClauses(raw)) {
    const parsed = commandsFromClause(clause, carried, formatsIn(clause), fields);
    if (parsed.question) questions.push(parsed.question);
    if (!parsed.commands.length && !parsed.question) unknown.push(clause);
    commands.push(...parsed.commands);
    if (parsed.element) carried = parsed.element;
  }
  if (!commands.length) return { commands: [], unknown, question: questions[0] ?? "Welches Element ist gemeint? Zum Beispiel Störer, Frau, Headline oder Leiste." };
  return { commands, unknown, question: questions[0] };
}

export function describeAdjust(commands: readonly AdjustCommand[]): string {
  const parts: string[] = [];
  let last = "";
  const add = (who: string, phrase: string) => {
    if (who && who === last) parts[parts.length - 1] += ` und ${phrase}`;
    else {
      parts.push(who ? `${who} ${phrase}` : phrase);
      last = who;
    }
  };
  for (const command of commands) {
    if (command.op === "seite_tauschen") add("", "Layout getauscht");
    else if (command.op === "rueckgaengig" || command.op === "version") add("", `Version ${"nummer" in command ? command.nummer : ""} wiederhergestellt`.replace("  ", " "));
    else if (command.op === "abstand") add("", `${command.mehr ? "mehr" : "weniger"} Luft zwischen ${LABEL[command.von]} und ${LABEL[command.nach]}`);
    else if (command.op === "verschieben") {
      const word = command.richtung === "unten" ? "tiefer" : command.richtung === "oben" ? "höher" : command.richtung === "links" ? "nach links" : "nach rechts";
      add(LABEL[command.element], `${command.prozent} % ${word}`);
    } else if (command.op === "groesse") {
      const percent = Math.round(Math.abs(command.faktor - 1) * 100);
      if (command.element === "deko") add("Wellen", `${percent} % ${command.faktor >= 1 ? "stärker" : "schwächer"}`);
      else add(LABEL[command.element], `${percent} % ${command.faktor >= 1 ? "größer" : "kleiner"}`);
    } else if (command.op === "spiegeln") add(LABEL[command.element], "gespiegelt");
    else if (command.op === "sichtbarkeit") add(LABEL[command.element], command.sichtbar ? "eingeblendet" : "ausgeblendet");
    else if (command.op === "text") add(LABEL[command.element], `ist jetzt „${command.text}“`);
    else if (command.op === "farbe") add(LABEL[command.element], command.hinweis ? command.hinweis : "neu gefärbt");
    else if (command.op === "deko_setzen") add("Deko", command.name === "fruehling_blaetter" ? "Blätter" : command.name === "bw_wellen" ? "Wellen" : "keine");
    else if (command.op === "vorlage_setzen") {
      add("", command.vorlage === "kachel_geraet" ? `Gerät statt Person${command.motiv ? `: ${command.motiv}` : ""}` : `Person statt Gerät${command.motiv ? `: ${command.motiv}` : ""}`);
      if (command.hinweis) add("", command.hinweis);
    }     else if (command.op === "feld") add(command.key === "preisAlt" ? "statt-Preis" : command.key === "preisMonatAlt" ? "alter Monatspreis" : command.key === "datenmengeAlt" ? "Altwert" : command.key === "geraetName" ? "Gerätename" : command.key === "einmalpreis" ? "Einmalpreis" : command.key === "energielabel" ? "Energielabel" : command.key === "motivWinkel" ? "Blickwinkel" : String(command.key), `ist jetzt ${command.value}${command.hinweis ? `. ${command.hinweis}` : ""}`);
    else if (command.op === "wie_format") add(command.element === "stoerer" ? "Stern" : command.element ? LABEL[command.element] : "", "wie im Quadrat");
    else if (command.op === "zuruecksetzen") add(LABEL[command.element], "auf die Vorlage zurückgesetzt");
    else if (command.op === "parameter") add(LABEL[command.element], "auf die genannten Layout-Parameter gesetzt");
    else if (command.op === "vergleichen") add("", `Version ${command.links} und ${command.rechts}`);
  }
  const sentence = parts.join(", ");
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

/** The sentence Langdock sends, whether it arrives as anweisung or aenderung.text. */
export function adjustRequest(args: Record<string, unknown> | string | undefined): string {
  if (typeof args === "string") return args.trim();
  if (!args) return "";
  const pick = (value: unknown) => typeof value === "string" ? value.trim() : "";
  const direct = pick(args.anweisung) || pick(args.text) || pick(args.satz) || pick(args.instruktion);
  if (direct) return direct;
  if (typeof args.aenderung === "string") return args.aenderung.trim();
  if (args.aenderung && typeof args.aenderung === "object") {
    const nested = args.aenderung as Record<string, unknown>;
    return pick(nested.anweisung) || pick(nested.text) || pick(nested.satz);
  }
  return "";
}

export function parseAdjust(input: unknown, fields: FieldPatch = {}): { commands: AdjustCommand[]; question?: string; unknown: string[] } {
  if (typeof input === "string") return parseAdjustText(input, fields);
  if (!input || typeof input !== "object") return { commands: [], unknown: [], question: "Ich habe den Änderungswunsch nicht verstanden." };
  const record = input as Record<string, unknown>;
  const spoken = adjustRequest(record);
  if (spoken) return parseAdjustText(spoken, fields);
  if (Array.isArray(record.befehle)) return { commands: record.befehle as AdjustCommand[], unknown: [] };
  return { commands: [], unknown: [], question: "Welches Element soll ich ändern?" };
}

export function holdStarScale(snap: AdjustSnap, formatId: string, faktor: number): void {
  const nudge = slot(snap, formatId, "stoerer");
  nudge.scale /= faktor;
}

function slot(snap: AdjustSnap, format: string, element: ElementId): Nudge {
  snap.nudges[format] ??= {};
  snap.nudges[format][element] ??= emptyNudge();
  return snap.nudges[format][element];
}

function formatsOf(command: { formate?: string[] }): string[] {
  return command.formate?.length ? command.formate : ["*"];
}

export function mergedNudge(snap: AdjustSnap | undefined, formatId: string, element: ElementId): Nudge {
  const base = emptyNudge();
  const star = snap?.nudges["*"]?.[element];
  const own = snap?.nudges[formatId]?.[element];
  return { ...base, ...star, ...own, scale: (star?.scale ?? 1) * (own?.scale ?? 1), dx: (star?.dx ?? 0) + (own?.dx ?? 0), dy: (star?.dy ?? 0) + (own?.dy ?? 0), flip: Boolean(own?.flip ?? star?.flip), hidden: Boolean(own?.hidden ?? star?.hidden), z: (star?.z ?? 0) + (own?.z ?? 0), color: own?.color ?? star?.color };
}

function copyOf(snap: AdjustSnap): SceneCopy {
  const fields = snap.fields;
  return {
    headline: fields.headline || "BLACK WEEK",
    subline: fields.subline || "",
    button: fields.button ?? "Jetzt sichern",
    stoererTyp: "stern",
    preis: fields.preis || "19,99 €",
    preisZusatz: fields.preisZusatz || "pro Monat",
    einmalpreis: fields.einmalpreis || "",
    aktionText: "",
    pflichttext: fields.pflichttext || "",
    headlineVariante: fields.headlineVariante || "direkt",
    orange: snap.orange,
    produktname: "",
    datenmenge: fields.datenmenge,
    datenmengeAlt: fields.datenmengeAlt,
    sternText: fields.sternText,
    deko: fields.deko,
    geraetName: fields.geraetName,
    preisAlt: fields.preisAlt,
    einmalpreisZusatz: fields.einmalpreisZusatz,
    preisMonatAlt: fields.preisMonatAlt,
    sublineColor: fields.sublineColor,
    sternColor: fields.sternColor,
    headlineColor: fields.headlineColor,
    ctaColor: fields.ctaColor,
  };
}

function vorlageOf(name: string | undefined): VorlageName {
  if (name === "kachel_geraet" || name === "kachel_geraet_person" || name === "kachel_person") return name;
  return "kachel_person";
}

function shiftsOf(snap: AdjustSnap, format: { id: string; token: string; w: number; h: number }) {
  const keys = ["*", format.id, format.token, `${format.w}x${format.h}`];
  const elements: ElementId[] = ["headline", "subline", "stoerer", "person", "geraet", "cta", "logo", "deko", "kachel", "pfeile", "stattpreis", "altwert", "zusatz", "einmalig", "geraetename"];
  return Object.fromEntries(elements.map((element) => {
    const parts = keys.map((key) => snap.nudges[key]?.[element]).filter((item) => item);
    return [element, {
      dx: parts.reduce((sum, item) => sum + (item?.dx ?? 0), 0),
      dy: parts.reduce((sum, item) => sum + (item?.dy ?? 0), 0),
      scale: parts.reduce((product, item) => product * (item?.scale ?? 1), 1),
      flip: parts.some((item) => item?.flip),
      hidden: parts.some((item) => item?.hidden),
      color: parts.reduce<string | undefined>((picked, item) => item?.color ?? picked, undefined),
    }];
  }));
}

function targetsOf(formate: string[] | undefined) {
  const tokens = formate?.length ? formate : OTELO_FORMATS.map((format) => format.id).filter((id) => id !== "pmax-1200x1200");
  return OTELO_FORMATS.filter((format) => format.id !== "pmax-1200x1200" && tokens.some((token) => token === format.id || token === format.token || token === `${format.w}x${format.h}`));
}

function elementBox(snap: AdjustSnap, element: ElementId, format: (typeof OTELO_FORMATS)[number]): { x: number; y: number; w: number; h: number } | undefined {
  const scene = buildScene(format, vorlageOf(snap.fields.vorlage), copyOf(snap), shiftsOf(snap, format), undefined, snap.follows);
  if (element === "stoerer") return scene.stern?.box;
  if (element === "person") return scene.figure;
  if (element === "geraet") return scene.productPaint?.opaque ?? scene.product;
  if (element === "headline") return scene.headline.box;
  if (element === "subline") return scene.subline.box;
  if (element === "cta") return scene.cta.box;
  if (element === "kachel") return scene.kachel?.box;
  if (element === "logo") return scene.logo.box.w > 2 ? scene.logo.box : undefined;
  if (element === "deko") return scene.deko?.box;
  if (element === "energielabel") return scene.energy;
  return undefined;
}

function renderedSpan(snap: AdjustSnap, element: ElementId, format: (typeof OTELO_FORMATS)[number]): number {
  const scene = buildScene(format, vorlageOf(snap.fields.vorlage), copyOf(snap), shiftsOf(snap, format), undefined, snap.follows);
  const box = element === "stoerer" ? scene.stern?.box
    : element === "person" ? scene.figure
    : element === "headline" ? scene.headline.box
    : element === "subline" ? scene.subline.box
    : element === "cta" ? scene.cta.box
    : element === "kachel" ? scene.kachel?.box
    : undefined;
  return Math.max(box?.w ?? 0, box?.h ?? 0);
}

export function applyToBook(book: AdjustBook, input: unknown, resolved: Array<{ clause: string; command: AdjustCommand }> = []): { book: AdjustBook; summary: string; question?: string; compare?: { links: number; rechts: number }; starFactor?: number } {
  const parsed = parseAdjust(input, book.snap.fields ?? {});
  if (resolved.length) {
    for (const item of resolved) parsed.commands.push(item.command);
    if (resolved.some((item) => item.clause === "*")) parsed.unknown = [];
    else parsed.unknown = parsed.unknown.filter((clause) => !resolved.some((item) => item.clause === clause));
  }
  if (parsed.question && !parsed.commands.length) return { book, summary: `nicht verstanden: ${parsed.question}`, question: parsed.question };
  const history = book.history.some((entry) => entry.n === book.version)
    ? book.history
    : [...book.history, { n: book.version, summary: "", snap: clone(book.snap) }];
  const snap = clone(book.snap);
  snap.fields ??= {};
  const bits: AdjustCommand[] = [];
  const noop: string[] = [];
  let starFactor: number | undefined;
  if (parsed.commands.length === 1 && parsed.commands[0]?.op === "vergleichen") {
    const command = parsed.commands[0];
    return { book, summary: `Version ${command.links} und ${command.rechts}.`, compare: { links: command.links, rechts: command.rechts } };
  }
  for (const command of parsed.commands) {
    if (command.op === "vergleichen") continue;
    if (command.op === "rueckgaengig") {
      const prev = [...history].reverse().find((entry) => entry.n < book.version);
      if (!prev) return { book, summary: "", question: "Es gibt keine frühere Version." };
      snap.orange = prev.snap.orange;
      snap.nudges = clone(prev.snap.nudges);
      snap.fields = clone(prev.snap.fields ?? {});
      bits.push(command);
      continue;
    }
    if (command.op === "version") {
      const found = history.find((entry) => entry.n === command.nummer);
      if (!found) return { book, summary: "", question: `Version ${command.nummer} kenne ich nicht.` };
      snap.orange = found.snap.orange;
      snap.nudges = clone(found.snap.nudges);
      snap.fields = clone(found.snap.fields ?? {});
      snap.follows = found.snap.follows ? clone(found.snap.follows) : undefined;
      bits.push(command);
      continue;
    }
    if (command.op === "wie_format") {
      const element = command.element;
      const label = element === "stoerer" ? "Stern" : element ? LABEL[element] : "Element";
      if (!element || (element !== "stoerer" && element !== "headline" && element !== "subline" && element !== "cta")) {
        noop.push(`nicht umgesetzt: ${label} wie im Quadrat kann ich für Stern, Headline, Unterzeile und Leiste.`);
        continue;
      }
      const square = OTELO_FORMATS[0];
      const name = vorlageOf(snap.fields.vorlage);
      const rel = square ? elementRelation(buildScene(square, name, copyOf(snap), shiftsOf(snap, square)), element) : undefined;
      if (!rel) {
        noop.push(`nicht umgesetzt: Im Quadrat hat ${label} keine Fläche.`);
        continue;
      }
      const targets = targetsOf(command.formate);
      const changes = targets.some((format) => {
        const current = elementRelation(buildScene(format, name, copyOf(snap), shiftsOf(snap, format)), element);
        if (!current) return true;
        return Math.abs(current.x - rel.x) > 0.03 || Math.abs(current.y - rel.y) > 0.03 || Math.abs(current.w - rel.w) > 0.03 || Math.abs(current.h - rel.h) > 0.03;
      });
      if (!changes) {
        noop.push(`nicht umgesetzt: ${label} wie im Quadrat ändert nichts.`);
        continue;
      }
      snap.follows = [...(snap.follows ?? []), { element, targets: command.formate?.length ? command.formate : targets.map((format) => format.id), rel }];
      bits.push(command);
      continue;
    }
    if (command.op === "abstand") {
      for (const format of formatsOf(command)) slot(snap, format, command.nach).dy += command.mehr ? 6 : -6;
      bits.push(command);
      continue;
    }
    if (command.op === "deko_setzen") {
      snap.fields.deko = command.name;
      bits.push(command);
      continue;
    }
    if (command.op === "vorlage_setzen") {
      snap.fields.vorlage = command.vorlage;
      if (command.motiv) {
        snap.fields.motiv = command.motiv;
        if (!snap.fields.geraetName && command.vorlage === "kachel_geraet") snap.fields.geraetName = command.motiv;
      }
      const notes: string[] = [];
      if (command.vorlage === "kachel_geraet" && snap.fields.datenmengeAlt) {
        snap.fields.datenmengeAlt = "";
        notes.push("Datenmenge-Altwert verworfen, er gehört nicht in den Geräte-Stern");
      }
      if (command.vorlage === "kachel_person") {
        const dropped = [
          snap.fields.einmalpreis ? "Einmalpreis" : "",
          snap.fields.geraetName ? "Gerätename" : "",
          snap.fields.energielabel ? "Energielabel" : "",
          snap.fields.preisAlt ? "statt-Preis" : "",
        ].filter(Boolean);
        snap.fields.einmalpreis = snap.fields.einmalpreis ? "" : snap.fields.einmalpreis;
        snap.fields.geraetName = snap.fields.geraetName ? "" : snap.fields.geraetName;
        snap.fields.energielabel = snap.fields.energielabel ? "" : snap.fields.energielabel;
        snap.fields.preisAlt = snap.fields.preisAlt ? "" : snap.fields.preisAlt;
        if (dropped.length) notes.push(`${dropped.join(", ")} verworfen, das gehört zur Geräte-Vorlage`);
      }
      const drop = command.vorlage === "kachel_geraet" ? ["person", "kachel"] : command.vorlage === "kachel_person" ? ["geraet", "kachel"] : [];
      for (const bucket of Object.values(snap.nudges)) {
        for (const key of drop) delete bucket[key as ElementId];
      }
      bits.push({ ...command, hinweis: notes.join(". ") || undefined });
      continue;
    }
    if (command.op === "feld") {
      snap.fields[command.key] = command.value as never;
      bits.push(command);
      continue;
    }
    if (command.op === "text") {
      const key = command.element === "cta" ? "button"
        : command.element === "stoerer" ? "sternText"
        : command.element === "subline" ? "subline"
        : command.element === "headline" ? "headline"
        : command.element === "datenmenge" ? "datenmenge"
        : command.element === "altwert" ? "datenmengeAlt"
        : command.element === "pflichttext" ? "pflichttext"
        : command.element === "geraet" ? "geraetName"
        : undefined;
      if (key) snap.fields[key] = command.text;
      bits.push(command);
      continue;
    }
    if (command.op === "farbe") {
      if (command.formate?.length) {
        for (const id of command.formate) slot(snap, id, command.element).color = command.farbe;
      } else {
        if (command.element === "subline") snap.fields.sublineColor = command.farbe;
        else if (command.element === "stoerer") snap.fields.sternColor = command.farbe;
        else if (command.element === "cta") snap.fields.ctaColor = command.farbe;
        else snap.fields.headlineColor = command.farbe;
        for (const bucket of Object.values(snap.nudges)) {
          const nudge = bucket[command.element];
          if (nudge?.color) delete nudge.color;
        }
      }
      bits.push(command);
      continue;
    }
    if (command.op === "seite_tauschen") {
      snap.orange = snap.orange === "links" ? "rechts" : "links";
      bits.push(command);
      continue;
    }
    if (command.op === "zuruecksetzen") {
      if (command.formate?.length) {
        for (const key of command.formate) delete snap.nudges[key]?.[command.element];
      } else {
        for (const bucket of Object.values(snap.nudges)) delete bucket[command.element];
      }
      bits.push(command);
      continue;
    }
    if (command.op === "parameter") {
      const element = command.element;
      const positioned = command.x !== undefined || command.y !== undefined;
      const ids = command.formate?.length ? command.formate : positioned ? OTELO_FORMATS.map((format) => format.id) : ["*"];
      for (const id of ids) {
        const shared = id === "*" ? 1 : snap.nudges["*"]?.[element]?.scale ?? 1;
        const nudge = slot(snap, id, element);
        if (command.groesse !== undefined && command.groesse > 0) {
          if (id === "*") {
            for (const [key, bucket] of Object.entries(snap.nudges)) {
              if (key !== "*" && bucket[element]) bucket[element].scale = 1;
            }
          }
          nudge.scale = (command.groesse / 100) / (shared || 1);
        }
        if (command.ebene !== undefined) nudge.z = command.ebene - ELEMENT_LAYER[element];
        const format = OTELO_FORMATS.find((item) => item.id === id);
        if (!format || (command.x === undefined && command.y === undefined)) continue;
        const cleared = clone(snap);
        for (const key of ["*", id]) {
          const item = cleared.nudges[key]?.[element];
          if (item) {
            item.dx = 0;
            item.dy = 0;
          }
        }
        const base = elementBox(cleared, element, format);
        if (!base) continue;
        const sharedDx = id === "*" ? 0 : snap.nudges["*"]?.[element]?.dx ?? 0;
        const sharedDy = id === "*" ? 0 : snap.nudges["*"]?.[element]?.dy ?? 0;
        if (command.x !== undefined) nudge.dx = command.x - (base.x / format.w) * 100 - sharedDx;
        if (command.y !== undefined) nudge.dy = command.y - (base.y / format.h) * 100 - sharedDy;
      }
      bits.push(command);
      continue;
    }
    if (command.op === "groesse" && (command.element === "stoerer" || command.element === "headline" || command.element === "subline" || command.element === "person" || command.element === "kachel" || command.element === "cta")) {
      const before = OTELO_FORMATS.map((format) => renderedSpan(snap, command.element, format));
      for (const format of formatsOf(command)) slot(snap, format, command.element).scale *= command.faktor;
      const after = OTELO_FORMATS.map((format) => ({ label: sceneFormatLabel(format), size: renderedSpan(snap, command.element, format) }));
      const stuck = after.filter((item, index) => (before[index] ?? 0) > 2 && Math.abs(item.size - (before[index] ?? 0)) < Math.max(1.5, (before[index] ?? 0) * 0.04));
      const visible = after.filter((_, index) => (before[index] ?? 0) > 2);
      const who = command.element === "stoerer" ? "Stern" : LABEL[command.element];
      const word = command.faktor >= 1 ? "maximal groß" : "minimal klein";
      if (visible.length > 0 && stuck.length === visible.length) {
        for (const format of formatsOf(command)) slot(snap, format, command.element).scale /= command.faktor;
        noop.push(stuck.length >= LIMIT_LABELS.length && command.element === "stoerer"
          ? `nicht möglich: Stern schon ${word}`
          : `${who} schon ${word} im ${stuck.map((item) => item.label).join(", ")}.`);
        continue;
      }
      if (stuck.length && command.element !== "stoerer") noop.push(`${who} schon ${word} im ${stuck.map((item) => item.label).join(", ")}.`);
      if (command.element === "stoerer") starFactor = command.faktor;
      bits.push(command);
      continue;
    }
    for (const format of formatsOf(command)) {
      const nudge = slot(snap, format, command.element);
      if (command.op === "verschieben") {
        if (command.richtung === "unten") nudge.dy += command.prozent;
        if (command.richtung === "oben") nudge.dy -= command.prozent;
        if (command.richtung === "links") nudge.dx -= command.prozent;
        if (command.richtung === "rechts") nudge.dx += command.prozent;
      } else if (command.op === "groesse") nudge.scale *= command.faktor;
      else if (command.op === "spiegeln") nudge.flip = !nudge.flip;
      else if (command.op === "sichtbarkeit") {
        nudge.hidden = !command.sichtbar;
        if (command.element === "altwert" && !command.sichtbar) snap.fields.datenmengeAlt = "";
      }
    }
    bits.push(command);
  }
  const same = JSON.stringify(snap) === JSON.stringify(book.snap);
  const done = bits.map((command) => {
    const base = describeAdjust([command]).replace(/\.\s*$/, "");
    const scope = "formate" in command && command.formate?.length ? ` (nur ${command.formate.join(", ")})` : "";
    return `umgesetzt: ${base}${scope}`;
  });
  const missed = parsed.unknown.map((clause) => `nicht verstanden: ${clause}${parsed.question ? ` (Vorschlag: ${parsed.question})` : ""}`);
  if (same) {
    const summary = finishAdjustSummary([...noop, ...missed].filter(Boolean).join("\n") || (parsed.question ? `nicht verstanden: ${parsed.question}` : "Die Anweisung ändert keine Eigenschaft."));
    return { book, summary, question: parsed.commands.length ? undefined : parsed.question, starFactor };
  }
  const namesOf = (command: AdjustCommand) => "element" in command && command.element ? LABEL[command.element] : command.op === "abstand" ? LABEL[command.nach] : "";
  const scoped = bits.some((command) => "formate" in command && command.formate?.length);
  const open = bits.filter((command) => ("element" in command || command.op === "abstand") && !("formate" in command && command.formate?.length));
  const scopeNote = scoped && open.length ? ` ${[...new Set(open.map(namesOf).filter(Boolean))].join("/")}: alle Formate – sag „nur 9x16“, wenn anders gemeint.` : "";
  const summary = finishAdjustSummary(`${[...done, ...noop, ...missed].join("\n")}${scopeNote}`);
  history.push({ n: book.version + 1, summary, snap: clone(snap) });
  return {
    book: { version: book.version + 1, snap, history },
    summary,
    question: parsed.commands.length ? undefined : parsed.question,
    compare: undefined,
    starFactor,
  };
}

const LIMIT_LABELS = ["1200x1200", "1200x628", "960x1200", "1080x1080", "1080x1920 Meta", "1080x1920 Tiktok"];

function limitFormats(hints: readonly string[]): string[] {
  const found: string[] = [];
  for (const hint of hints) {
    if (!/schon maximal groß|schon minimal klein/.test(hint)) continue;
    const list = hint.match(/\(([^)]+)\)/);
    const labels = list ? list[1].split(",").map((item) => item.trim()) : [];
    if (!labels.length) {
      const single = hint.match(/im\s+(.+?)\.?\s*$/);
      if (single?.[1]) labels.push(single[1].trim());
    }
    for (const label of labels) if (!found.includes(label)) found.push(label);
  }
  return found;
}

export type StarSample = { id: string; label: string; diameter: number; blocked: boolean };

/** The reply follows the measured diameters, not the planned scale. */
export function correctStarStep(before: StarSample[], after: StarSample[], percent: number): { holdIds: string[]; line: string } {
  const tolerance = (size: number) => Math.max(1.5, size * 0.04);
  const holdIds = after.flatMap((item, index) => {
    const prior = before[index];
    if (!prior || prior.id !== item.id) return [];
    const grew = item.diameter > prior.diameter + tolerance(prior.diameter);
    const shrunk = item.diameter + tolerance(item.diameter) < prior.diameter;
    const newBlock = item.blocked && !prior.blocked;
    return shrunk || newBlock || (grew && newBlock) ? [item.id] : [];
  });
  const final = after.map((item, index) => holdIds.includes(item.id) ? before[index] ?? item : item);
  const stuck = final.filter((item, index) => {
    const prior = before[index];
    return !prior || item.diameter <= prior.diameter + tolerance(prior.diameter);
  });
  const word = percent >= 0 ? "maximal" : "minimal";
  const line = !final.some((item, index) => {
    const prior = before[index];
    return prior && item.diameter > prior.diameter + tolerance(prior.diameter);
  })
    ? `nicht möglich: Stern schon ${percent >= 0 ? "maximal groß" : "minimal klein"}`
    : stuck.length
      ? `umgesetzt: Störer ${Math.abs(percent)} % ${percent >= 0 ? "größer" : "kleiner"} (außer ${stuck.map((item) => item.label).join(", ")}: schon ${word})`
      : `umgesetzt: Störer ${Math.abs(percent)} % ${percent >= 0 ? "größer" : "kleiner"}`;
  return { holdIds, line };
}

/** One line per result. Identical lines are dropped. */
export function finishAdjustSummary(summary: string, hints: readonly string[] = []): string {
  const limited = limitFormats(hints);
  let lines = summary.split("\n").map((line) => line.trim()).filter(Boolean);
  if (limited.length) lines = lines.filter((line) => !/^Stern schon (maximal groß|minimal klein)/.test(line));
  const seen = new Set<string>();
  return lines.filter((line) => {
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  }).join("\n");
}

const MODEL_FIELDS = ["button", "headline", "subline", "sternText", "preis", "datenmenge", "deko"] as const;

function oneModelCommand(feld: string, wert: string): AdjustCommand | undefined {
  const value = cleanSpokenValue(wert);
  if (!MODEL_FIELDS.includes(feld as (typeof MODEL_FIELDS)[number]) || !value || !plausibleText(value)) return undefined;
  if (feld === "deko") {
    const name = dekoToken(value);
    return name ? { op: "deko_setzen", name } : undefined;
  }
  const field = textField(feld);
  if (!field) return undefined;
  return commandsForText(field, value, undefined)[0];
}

/** Turns model JSON into commands. Unknown fields are dropped. */
export function commandFromModel(raw: string): AdjustCommand | undefined {
  return commandsFromModel(raw)[0];
}

export function commandsFromModel(raw: string): AdjustCommand[] {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  let payload: { feld?: unknown; wert?: unknown; aenderungen?: unknown };
  try {
    payload = JSON.parse(match[0]) as { feld?: unknown; wert?: unknown; aenderungen?: unknown };
  } catch {
    return [];
  }
  const rows = Array.isArray(payload.aenderungen) ? payload.aenderungen : [payload];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as { feld?: unknown; wert?: unknown };
    const command = oneModelCommand(String(record.feld ?? ""), String(record.wert ?? ""));
    return command ? [command] : [];
  });
}

/** The whole instruction, when a clause did not match a fixed rule. */
export async function interpretCommands(text: string): Promise<AdjustCommand[]> {
  const config = openRouterConfig("VISUAL_BUILDER_OPENROUTER_MODEL", "anthropic/claude-sonnet-5.5");
  if (!config.configured) return [];
  const raw = await openRouterComplete({
    messages: [
      {
        role: "system",
        content: `Du liest eine Layout-Anweisung und antwortest nur mit JSON {"aenderungen":[{"feld":"button|headline|subline|sternText|preis|datenmenge|deko","wert":"…"}]}. deko ist nur blätter, wellen oder keine. Werte enthalten keine Befehlswörter. Wenn nichts zu setzen ist, antworte {"aenderungen":[]}.`,
      },
      { role: "user", content: text },
    ],
    config,
    appTitle: "Visual Builder",
    temperature: 0,
    maxTokens: 300,
    timeoutMs: 20000,
    responseFormat: { type: "json_object" },
  }).catch(() => "");
  return commandsFromModel(raw);
}

export function newBook(orange: OrangeSide = "rechts"): AdjustBook {
  const snap = emptySnap(orange);
  return { version: 1, snap, history: [{ n: 1, summary: "Neu angelegt.", snap: clone(snap) }] };
}

/** Version 1 keeps every field, so a later restore can put the whole state back. */
export function seedBook(orange: OrangeSide, fields: FieldPatch): AdjustBook {
  const book = newBook(orange);
  book.snap.fields = { ...fields };
  book.history = [{ n: 1, summary: "Neu angelegt.", snap: clone(book.snap) }];
  return book;
}

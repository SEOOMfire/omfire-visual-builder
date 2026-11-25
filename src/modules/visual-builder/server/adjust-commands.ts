import type { OrangeSide } from "../otelo-scene";

export type ElementId = "headline" | "subline" | "stoerer" | "person" | "geraet" | "cta" | "logo" | "pflichttext" | "energielabel" | "schraege" | "deko" | "kachel" | "pfeile" | "altwert" | "datenmenge";

export type Nudge = { dx: number; dy: number; scale: number; flip: boolean; hidden: boolean };

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
};

export type AdjustSnap = {
  orange: OrangeSide;
  nudges: Record<string, Partial<Record<ElementId, Nudge>>>;
  fields: FieldPatch;
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
  | { op: "vorlage_setzen"; vorlage: string; motiv?: string }
  | { op: "feld"; key: keyof FieldPatch; value: string }
  | { op: "wie_format"; quelle: string }
  | { op: "rueckgaengig" }
  | { op: "version"; nummer: number }
  | { op: "vergleichen"; links: number; rechts: number };

const WORDS: Array<[RegExp, ElementId]> = [
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
  "Lage: „Kachel etwas höher“, „Frau deutlich größer“, „Frau spiegeln“, „auf die andere Seite“, „mehr Luft zwischen Headline und Kachel“, „wie im Quadrat“.",
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
  if (/etwas/i.test(slice)) return 5;
  if (/deutlich/i.test(slice)) return 25;
  return 15;
}

function splitClauses(text: string): string[] {
  const out: string[] = [];
  for (const chunk of text.split(/\s*,\s*/)) {
    const held = chunk.replace(/zwischen\s+.+?\s+und\s+[^\s,]+/gi, (match) => match.replace(/\s+und\s+/i, " \u0000und\u0000 "));
    const bits = held.split(/\s+und\s+/i).map((bit) => bit.replace(/\u0000und\u0000/g, "und").replace(/\s+/g, " ").trim());
    let current = bits[0] ?? "";
    for (const bit of bits.slice(1)) {
      const next = elementIn(bit);
      const currentElement = elementIn(current);
      if ((next && next !== currentElement) || /^auf die andere seite/i.test(bit.trim())) {
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

function fieldKey(label: string): keyof FieldPatch | undefined {
  return FIELD_LABEL[label.toLowerCase()];
}

function commandsFromClause(clause: string, inherited: ElementId | undefined, formate?: string[]): { commands: AdjustCommand[]; element?: ElementId; question?: string } {
  const commands: AdjustCommand[] = [];
  const labeled = clause.match(/^([a-zäöü0-9-]+)\s*:\s*(.+)$/i);
  if (labeled) {
    const key = fieldKey(labeled[1] ?? "");
    const element = elementIn(labeled[1] ?? "") ?? inherited;
    if (key) {
      commands.push({ op: "text", element: element ?? "headline", text: (labeled[2] ?? "").trim().replace(/^[„"]|[”"]$/g, ""), formate });
      return { commands, element };
    }
  }
  const quoted = clause.match(/[„"]([^„"”]+)[”"]/);
  const auf = clause.match(/(?:ändern|aendern|setzen)\s+auf\s+(.+)$/i);
  const replacement = (quoted?.[1] ?? auf?.[1] ?? "").trim().replace(/^[„"]|[”"]$/g, "");
  const named = elementIn(clause) ?? inherited;
  if (replacement && named && /ändern|aendern|setzen|text/i.test(clause)) {
    commands.push({ op: "text", element: named, text: replacement, formate });
    return { commands, element: named };
  }
  if (/wie im quadrat/i.test(clause)) {
    commands.push({ op: "wie_format", quelle: "1x1" });
    return { commands, element: inherited };
  }
  if (/bl[äa]tter\s+statt\s+wellen/i.test(clause)) {
    commands.push({ op: "deko_setzen", name: "fruehling_blaetter" });
    return { commands, element: "deko" };
  }
  if (/wellen\s+statt\s+bl[äa]tter/i.test(clause)) {
    commands.push({ op: "deko_setzen", name: "bw_wellen" });
    return { commands, element: "deko" };
  }
  if (/ger[äa]t\s+statt\s+person/i.test(clause)) {
    const motiv = clause.split(":").slice(1).join(":").split(/,|energielabel/i)[0]?.trim();
    commands.push({ op: "vorlage_setzen", vorlage: "kachel_geraet", motiv: motiv || undefined });
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

export function parseAdjustText(text: string): { commands: AdjustCommand[]; question?: string; unknown: string[] } {
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
    const parsed = commandsFromClause(clause, carried, formatsIn(clause));
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
    else if (command.op === "vorlage_setzen") add("", command.vorlage === "kachel_geraet" ? `Gerät statt Person${command.motiv ? `: ${command.motiv}` : ""}` : `Person statt Gerät${command.motiv ? `: ${command.motiv}` : ""}`);
    else if (command.op === "feld") add(String(command.key), `ist jetzt ${command.value}`);
    else if (command.op === "wie_format") add("", "Lage wie im Quadrat");
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

export function parseAdjust(input: unknown): { commands: AdjustCommand[]; question?: string; unknown: string[] } {
  if (typeof input === "string") return parseAdjustText(input);
  if (!input || typeof input !== "object") return { commands: [], unknown: [], question: "Ich habe den Änderungswunsch nicht verstanden." };
  const record = input as Record<string, unknown>;
  const spoken = adjustRequest(record);
  if (spoken) return parseAdjustText(spoken);
  if (Array.isArray(record.befehle)) return { commands: record.befehle as AdjustCommand[], unknown: [] };
  return { commands: [], unknown: [], question: "Welches Element soll ich ändern?" };
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
  return { ...base, ...star, ...own, scale: (star?.scale ?? 1) * (own?.scale ?? 1), dx: (star?.dx ?? 0) + (own?.dx ?? 0), dy: (star?.dy ?? 0) + (own?.dy ?? 0), flip: Boolean(own?.flip ?? star?.flip), hidden: Boolean(own?.hidden ?? star?.hidden) };
}

export function applyToBook(book: AdjustBook, input: unknown): { book: AdjustBook; summary: string; question?: string; compare?: { links: number; rechts: number } } {
  const parsed = parseAdjust(input);
  if (parsed.question && !parsed.commands.length) return { book, summary: `nicht verstanden: ${parsed.question}`, question: parsed.question };
  const history = book.history.some((entry) => entry.n === book.version)
    ? book.history
    : [...book.history, { n: book.version, summary: "", snap: clone(book.snap) }];
  const snap = clone(book.snap);
  snap.fields ??= {};
  const bits: AdjustCommand[] = [];
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
      bits.push(command);
      continue;
    }
    if (command.op === "wie_format") {
      const source = snap.nudges["1x1"] ?? snap.nudges["1080x1080"] ?? snap.nudges["meta-1x1"];
      if (source) {
        for (const id of FORMAT_IDS) {
          if (id === "meta-1x1") continue;
          snap.nudges[id] = clone(source);
        }
      }
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
      if (command.motiv) snap.fields.motiv = command.motiv;
      bits.push(command);
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
      if (command.element === "subline") snap.fields.sublineColor = command.farbe;
      else if (command.element === "stoerer") snap.fields.sternColor = command.farbe;
      else snap.fields.headlineColor = command.farbe;
      bits.push(command);
      continue;
    }
    if (command.op === "seite_tauschen") {
      snap.orange = snap.orange === "links" ? "rechts" : "links";
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
    const summary = done.length
      ? `${done.join(" ")} Die Anweisung ändert keine Eigenschaft.`
      : missed.join(" ") || (parsed.question ? `nicht verstanden: ${parsed.question}` : "nicht verstanden: Die Anweisung ändert keine Eigenschaft.");
    return { book, summary, question: parsed.commands.length ? undefined : parsed.question };
  }
  const namesOf = (command: AdjustCommand) => "element" in command ? LABEL[command.element] : command.op === "abstand" ? LABEL[command.nach] : "";
  const scoped = bits.some((command) => "formate" in command && command.formate?.length);
  const open = bits.filter((command) => ("element" in command || command.op === "abstand") && !("formate" in command && command.formate?.length));
  const scopeNote = scoped && open.length ? ` ${[...new Set(open.map(namesOf).filter(Boolean))].join("/")}: alle Formate – sag „nur 9x16“, wenn anders gemeint.` : "";
  const summary = `${[...done, ...missed].join(" ")}${scopeNote}`;
  history.push({ n: book.version + 1, summary, snap: clone(snap) });
  return {
    book: { version: book.version + 1, snap, history },
    summary,
    question: parsed.commands.length ? undefined : parsed.question,
    compare: undefined,
  };
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

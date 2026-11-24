import type { OrangeSide } from "../otelo-scene";

export type ElementId = "headline" | "subline" | "stoerer" | "person" | "geraet" | "cta" | "logo" | "pflichttext" | "energielabel" | "schraege" | "deko";

export type Nudge = { dx: number; dy: number; scale: number; flip: boolean; hidden: boolean };

export type AdjustSnap = {
  orange: OrangeSide;
  nudges: Record<string, Partial<Record<ElementId, Nudge>>>;
};

export type VersionEntry = { n: number; summary: string; snap: AdjustSnap };

export type AdjustBook = { version: number; snap: AdjustSnap; history: VersionEntry[] };

export type AdjustCommand =
  | { op: "verschieben"; element: ElementId; richtung: "oben" | "unten" | "links" | "rechts"; prozent: number; formate?: string[] }
  | { op: "groesse"; element: ElementId; faktor: number; formate?: string[] }
  | { op: "spiegeln"; element: ElementId; formate?: string[] }
  | { op: "seite_tauschen"; formate?: string[] }
  | { op: "sichtbarkeit"; element: ElementId; sichtbar: boolean; formate?: string[] }
  | { op: "rueckgaengig" }
  | { op: "version"; nummer: number };

const WORDS: Array<[RegExp, ElementId]> = [
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

export function emptyNudge(): Nudge {
  return { dx: 0, dy: 0, scale: 1, flip: false, hidden: false };
}

export function emptySnap(orange: OrangeSide = "rechts"): AdjustSnap {
  return { orange, nudges: {} };
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
    const bits = chunk.split(/\s+und\s+/i);
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

function formatsIn(text: string): string[] | undefined {
  const found = [...text.matchAll(/(\d{3,4})\s*x\s*(\d{3,4})/gi)].map((match) => `${match[1]}x${match[2]}`);
  return found.length ? found : undefined;
}

function commandsFromClause(clause: string, inherited: ElementId | undefined, formate?: string[]): { commands: AdjustCommand[]; element?: ElementId; question?: string } {
  const element = elementIn(clause) ?? inherited;
  const commands: AdjustCommand[] = [];
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

export function parseAdjustText(text: string): { commands: AdjustCommand[]; question?: string } {
  const raw = text.trim();
  if (!raw) return { commands: [], question: "Welches Element soll ich ändern?" };
  if (/^r[üu]ckg[äa]ngig\.?$/i.test(raw) || /\br[üu]ckg[äa]ngig\b/i.test(raw) && raw.split(/\s+/).length < 4) return { commands: [{ op: "rueckgaengig" }] };
  const restore = raw.match(/version\s+(\d+)/i);
  if (restore && /wiederherstell/i.test(raw)) return { commands: [{ op: "version", nummer: Number(restore[1]) }] };
  const formate = formatsIn(raw);
  const commands: AdjustCommand[] = [];
  let carried: ElementId | undefined;
  for (const clause of splitClauses(raw)) {
    const parsed = commandsFromClause(clause, carried, formate);
    if (parsed.question && !parsed.commands.length) return { commands: [], question: parsed.question };
    commands.push(...parsed.commands);
    if (parsed.element) carried = parsed.element;
  }
  if (!commands.length) return { commands: [], question: "Welches Element ist gemeint? Zum Beispiel Störer, Frau, Headline oder Leiste." };
  return { commands };
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
    else if (command.op === "verschieben") {
      const word = command.richtung === "unten" ? "tiefer" : command.richtung === "oben" ? "höher" : command.richtung === "links" ? "nach links" : "nach rechts";
      add(LABEL[command.element], `${command.prozent} % ${word}`);
    } else if (command.op === "groesse") {
      const percent = Math.round(Math.abs(command.faktor - 1) * 100);
      add(LABEL[command.element], `${percent} % ${command.faktor >= 1 ? "größer" : "kleiner"}`);
    } else if (command.op === "spiegeln") add(LABEL[command.element], "gespiegelt");
    else if (command.op === "sichtbarkeit") add(LABEL[command.element], command.sichtbar ? "eingeblendet" : "ausgeblendet");
  }
  const sentence = parts.join(", ");
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

export function parseAdjust(input: unknown): { commands: AdjustCommand[]; question?: string } {
  if (typeof input === "string") return parseAdjustText(input);
  if (!input || typeof input !== "object") return { commands: [], question: "Ich habe den Änderungswunsch nicht verstanden." };
  const record = input as Record<string, unknown>;
  if (typeof record.text === "string") return parseAdjustText(record.text);
  if (typeof record.satz === "string") return parseAdjustText(record.satz);
  if (Array.isArray(record.befehle)) return { commands: record.befehle as AdjustCommand[] };
  return { commands: [] };
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

export function applyToBook(book: AdjustBook, input: unknown): { book: AdjustBook; summary: string; question?: string } {
  const parsed = parseAdjust(input);
  if (parsed.question) return { book, summary: "", question: parsed.question };
  const history = book.history.some((entry) => entry.n === book.version)
    ? book.history
    : [...book.history, { n: book.version, summary: "", snap: clone(book.snap) }];
  const snap = clone(book.snap);
  const bits: AdjustCommand[] = [];
  for (const command of parsed.commands) {
    if (command.op === "rueckgaengig") {
      const prev = [...history].reverse().find((entry) => entry.n < book.version);
      if (!prev) return { book, summary: "", question: "Es gibt keine frühere Version." };
      snap.orange = prev.snap.orange;
      snap.nudges = clone(prev.snap.nudges);
      bits.push(command);
      continue;
    }
    if (command.op === "version") {
      const found = history.find((entry) => entry.n === command.nummer);
      if (!found) return { book, summary: "", question: `Version ${command.nummer} kenne ich nicht.` };
      snap.orange = found.snap.orange;
      snap.nudges = clone(found.snap.nudges);
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
      else if (command.op === "sichtbarkeit") nudge.hidden = !command.sichtbar;
    }
    bits.push(command);
  }
  const summary = describeAdjust(bits);
  return {
    book: { version: book.version + 1, snap, history },
    summary,
  };
}

export function newBook(orange: OrangeSide = "rechts"): AdjustBook {
  const snap = emptySnap(orange);
  return { version: 1, snap, history: [{ n: 1, summary: "Neu angelegt.", snap: clone(snap) }] };
}

import type { OrangeSide } from "../otelo-scene";

export type ElementId = "headline" | "subline" | "stoerer" | "person" | "geraet" | "cta" | "logo" | "pflichttext" | "energielabel" | "schraege";

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

function elementIn(text: string): ElementId | undefined {
  return WORDS.find(([pattern]) => pattern.test(text))?.[1];
}

function amount(text: string, fallback: number): number {
  const percent = text.match(/(\d+(?:[.,]\d+)?)\s*(?:%|prozent)/i);
  if (percent) return Number(percent[1].replace(",", "."));
  if (/deutlich/i.test(text)) return 10;
  if (/etwas/i.test(text)) return 3;
  return fallback;
}

function formatsIn(text: string): string[] | undefined {
  const found = [...text.matchAll(/(\d{3,4})\s*x\s*(\d{3,4})/gi)].map((match) => `${match[1]}x${match[2]}`);
  return found.length ? found : undefined;
}

export function parseAdjustText(text: string): { commands: AdjustCommand[]; question?: string } {
  const raw = text.trim();
  if (!raw) return { commands: [], question: "Welches Element soll ich ändern?" };
  if (/r[üu]ckg[äa]ngig/i.test(raw)) return { commands: [{ op: "rueckgaengig" }] };
  const restore = raw.match(/version\s+(\d+)/i);
  if (restore && /wiederherstell/i.test(raw)) return { commands: [{ op: "version", nummer: Number(restore[1]) }] };
  const formate = formatsIn(raw);
  const element = elementIn(raw);
  const commands: AdjustCommand[] = [];
  if (/auf die andere seite/i.test(raw)) commands.push({ op: "seite_tauschen", formate });
  if (/spiegel/i.test(raw)) {
    if (!element) return { commands: [], question: "Welches Element soll ich spiegeln?" };
    commands.push({ op: "spiegeln", element, formate });
  }
  if (/tiefer|nach unten|runter/i.test(raw)) {
    if (!element) return { commands: [], question: "Welches Element soll nach unten?" };
    commands.push({ op: "verschieben", element, richtung: "unten", prozent: amount(raw, 10), formate });
  } else if (/h[öo]her|nach oben/i.test(raw)) {
    if (!element) return { commands: [], question: "Welches Element soll nach oben?" };
    commands.push({ op: "verschieben", element, richtung: "oben", prozent: amount(raw, 10), formate });
  } else if (/nach links/i.test(raw)) {
    if (!element) return { commands: [], question: "Welches Element soll nach links?" };
    commands.push({ op: "verschieben", element, richtung: "links", prozent: amount(raw, 10), formate });
  } else if (/nach rechts/i.test(raw)) {
    if (!element) return { commands: [], question: "Welches Element soll nach rechts?" };
    commands.push({ op: "verschieben", element, richtung: "rechts", prozent: amount(raw, 10), formate });
  }
  if (/kleiner/i.test(raw)) {
    if (!element) return { commands: [], question: "Welches Element soll kleiner werden?" };
    commands.push({ op: "groesse", element, faktor: 1 - amount(raw, 10) / 100, formate });
  } else if (/gr[öo]ßer|groesser/i.test(raw)) {
    if (!element) return { commands: [], question: "Welches Element soll größer werden?" };
    commands.push({ op: "groesse", element, faktor: 1 + amount(raw, 10) / 100, formate });
  }
  if (/ausblenden|verstecken|weg/i.test(raw) && element) commands.push({ op: "sichtbarkeit", element, sichtbar: false, formate });
  if (/einblenden|zeigen/i.test(raw) && element) commands.push({ op: "sichtbarkeit", element, sichtbar: true, formate });
  if (!commands.length) return { commands: [], question: "Welches Element ist gemeint? Zum Beispiel Störer, Frau, Headline oder Leiste." };
  return { commands };
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
  const bits: string[] = [];
  for (const command of parsed.commands) {
    if (command.op === "rueckgaengig") {
      const prev = [...history].reverse().find((entry) => entry.n < book.version);
      if (!prev) return { book, summary: "", question: "Es gibt keine frühere Version." };
      snap.orange = prev.snap.orange;
      snap.nudges = clone(prev.snap.nudges);
      bits.push(`Version ${prev.n} wiederhergestellt`);
      continue;
    }
    if (command.op === "version") {
      const found = history.find((entry) => entry.n === command.nummer);
      if (!found) return { book, summary: "", question: `Version ${command.nummer} kenne ich nicht.` };
      snap.orange = found.snap.orange;
      snap.nudges = clone(found.snap.nudges);
      bits.push(`Version ${command.nummer} wiederhergestellt`);
      continue;
    }
    if (command.op === "seite_tauschen") {
      snap.orange = snap.orange === "links" ? "rechts" : "links";
      bits.push("Person oder Gerät und die Schräge wechseln die Seite");
      continue;
    }
    for (const format of formatsOf(command)) {
      const nudge = slot(snap, format, command.element);
      if (command.op === "verschieben") {
        if (command.richtung === "unten") nudge.dy += command.prozent;
        if (command.richtung === "oben") nudge.dy -= command.prozent;
        if (command.richtung === "links") nudge.dx -= command.prozent;
        if (command.richtung === "rechts") nudge.dx += command.prozent;
        bits.push(`${command.element} ${command.prozent} Prozent nach ${command.richtung}`);
      } else if (command.op === "groesse") {
        nudge.scale *= command.faktor;
        bits.push(`${command.element} auf ${Math.round(command.faktor * 100)} Prozent`);
      } else if (command.op === "spiegeln") {
        nudge.flip = !nudge.flip;
        bits.push(`${command.element} gespiegelt`);
      } else if (command.op === "sichtbarkeit") {
        nudge.hidden = !command.sichtbar;
        bits.push(command.sichtbar ? `${command.element} eingeblendet` : `${command.element} ausgeblendet`);
      }
    }
  }
  const summary = `${bits.join(", ")}.`;
  return {
    book: { version: book.version + 1, snap, history },
    summary,
  };
}

export function newBook(orange: OrangeSide = "rechts"): AdjustBook {
  const snap = emptySnap(orange);
  return { version: 1, snap, history: [{ n: 1, summary: "Neu angelegt.", snap: clone(snap) }] };
}

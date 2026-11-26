import { OTELO_FORMATS } from "../otelo-formats";
import { openRouterComplete, openRouterConfig } from "../../../platform/ai/openrouter";
import { normalizeDeko, renderedStarTextSize, sceneFormatLabel, type OteloScene } from "../otelo-scene";
import {
  applyToBook,
  ELEMENT_LAYER,
  mergedNudge,
  type AdjustBook,
  type AdjustCommand,
  type AdjustSnap,
  type ElementId,
  type FieldPatch,
} from "./adjust-commands";

export const EDIT_ZIELE = [
  "headline", "unterzeile", "cta", "preis", "preis_zusatz", "preis_alt", "einmalpreis",
  "datenmenge", "datenmenge_alt", "stern", "stern_text", "deko", "motiv", "geraet_name",
  "energielabel", "kachel", "figur", "version",
] as const;

export const EDIT_AKTIONEN = [
  "setzen", "ausblenden", "einblenden", "groesser", "kleiner", "verschieben", "farbe", "zuruecksetzen", "version_laden",
] as const;

export type EditZiel = (typeof EDIT_ZIELE)[number] | "handy" | "geraet" | "gerät";
export type EditAktion = (typeof EDIT_AKTIONEN)[number];

export type EditValue = string | number | {
  links?: number;
  rechts?: number;
  oben?: number;
  unten?: number;
  x?: number;
  y?: number;
  groesse?: number;
  ebene?: number;
};

export type EditChange = {
  ziel: EditZiel;
  aktion: EditAktion;
  wert?: EditValue;
  formate?: string[];
};

export type LayoutParam = {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  groesse: number;
  ebene: number;
  versteckt: boolean;
  farbe?: string;
  grund?: string;
};

export type LayoutStand = {
  version: number;
  felder: Record<string, string>;
  layout: Record<string, Record<string, LayoutParam>>;
};

export type LayoutProblem = { format: string; text: string };

const MODEL_VARIABLE = "VISUAL_BUILDER_OPENROUTER_MODEL";

const COLORS: Record<string, string> = {
  lime: "#D7EB00",
  orange: "#FA5A14",
  schwarz: "#000000",
  weiß: "#FFFFFF",
  weiss: "#FFFFFF",
  "#d7eb00": "#D7EB00",
  "#fa5a14": "#FA5A14",
  "#000000": "#000000",
  "#ffffff": "#FFFFFF",
};

const ZIEL_ELEMENT: Partial<Record<EditZiel, ElementId>> = {
  headline: "headline",
  unterzeile: "subline",
  cta: "cta",
  stern: "stoerer",
  stern_text: "stoerer",
  kachel: "kachel",
  figur: "person",
  deko: "deko",
  datenmenge: "datenmenge",
  datenmenge_alt: "altwert",
  preis_alt: "stattpreis",
  preis_zusatz: "zusatz",
  einmalpreis: "einmalig",
  geraet_name: "geraetename",
  energielabel: "energielabel",
};

const FIELD_OF: Partial<Record<EditZiel, keyof FieldPatch>> = {
  headline: "headline",
  unterzeile: "subline",
  cta: "button",
  preis: "preis",
  preis_zusatz: "preisZusatz",
  preis_alt: "preisAlt",
  einmalpreis: "einmalpreis",
  datenmenge: "datenmenge",
  datenmenge_alt: "datenmengeAlt",
  stern: "sternText",
  stern_text: "sternText",
  motiv: "motiv",
  geraet_name: "geraetName",
  energielabel: "energielabel",
};

const LAYOUT_BOX: Array<{ ziel: string; element: ElementId; box: (scene: OteloScene) => { x: number; y: number; w: number; h: number } | undefined }> = [
  { ziel: "headline", element: "headline", box: (scene) => scene.headline.box },
  { ziel: "unterzeile", element: "subline", box: (scene) => scene.subline.box },
  { ziel: "cta", element: "cta", box: (scene) => scene.cta.box },
  { ziel: "stern", element: "stoerer", box: (scene) => scene.stern?.box },
  { ziel: "kachel", element: "kachel", box: (scene) => scene.kachel?.box },
  { ziel: "figur", element: "person", box: (scene) => scene.figure },
  { ziel: "geraet", element: "geraet", box: (scene) => scene.productPaint?.opaque ?? scene.product },
  { ziel: "logo", element: "logo", box: (scene) => scene.logo.box.w > 2 ? scene.logo.box : undefined },
  { ziel: "deko", element: "deko", box: (scene) => scene.deko?.box },
  { ziel: "preis", element: "zusatz", box: (scene) => scene.pill?.box },
  { ziel: "energielabel", element: "energielabel", box: (scene) => scene.energy },
];

function isZiel(value: string): value is EditZiel {
  return (EDIT_ZIELE as readonly string[]).includes(value) || value === "handy" || value === "geraet" || value === "gerät";
}

function imageElement(vorlage?: string): ElementId {
  return vorlage === "kachel_geraet" || vorlage === "kachel_geraet_person" || vorlage === "product" || vorlage === "product_person" ? "geraet" : "person";
}

function isAktion(value: string): value is EditAktion {
  return (EDIT_AKTIONEN as readonly string[]).includes(value);
}

export function formatIds(formate?: string[]): string[] | undefined {
  if (!formate?.length) return undefined;
  const ids: string[] = [];
  for (const label of formate) {
    const text = label.trim();
    if (!text) continue;
    if (text === "9x16") {
      ids.push("meta-9x16", "tiktok-9x16");
      continue;
    }
    const found = OTELO_FORMATS.find((format) => format.id === text || sceneFormatLabel(format) === text || format.token === text || `${format.w}x${format.h}` === text);
    ids.push(found?.id ?? text);
  }
  return [...new Set(ids)];
}

function textOf(value: EditValue | undefined): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function percentOf(value: EditValue | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace("%", "").replace(",", ".").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function colorOf(value: EditValue | undefined): string | undefined {
  const text = textOf(value).toLowerCase();
  return text ? COLORS[text] : undefined;
}

function dekoOf(value: string): "bw_wellen" | "fruehling_blaetter" | "keine" | undefined {
  return normalizeDeko(value) ?? (/keine|ohne|weg/i.test(value) ? "keine" : /bl[aä]tt|fruehling|sommer/i.test(value) ? "fruehling_blaetter" : /well/i.test(value) ? "bw_wellen" : undefined);
}

function directionCommands(element: ElementId, value: EditValue | undefined, formate?: string[]): AdjustCommand[] {
  if (!value || typeof value !== "object") return [];
  const steps: Array<[keyof typeof value, AdjustCommand["op"] extends never ? never : "oben" | "unten" | "links" | "rechts"]> = [
    ["oben", "oben"],
    ["unten", "unten"],
    ["links", "links"],
    ["rechts", "rechts"],
  ];
  return steps.flatMap(([key, richtung]) => {
    const amount = value[key];
    if (typeof amount !== "number" || !amount) return [];
    return [{ op: "verschieben" as const, element, richtung, prozent: Math.abs(amount), formate }];
  });
}

/** One structured change becomes commands. Unknown combinations stay as an error line. */
export function commandsForEdit(edit: EditChange, vorlage?: string): { commands: AdjustCommand[]; error?: string } {
  const formate = formatIds(edit.formate);
  const layoutAlias = edit.ziel === "motiv" || edit.ziel === "handy" || edit.ziel === "geraet" || edit.ziel === "gerät" || edit.ziel === "figur";
  const element = layoutAlias && !(edit.ziel === "motiv" && typeof edit.wert !== "object") ? imageElement(vorlage) : ZIEL_ELEMENT[edit.ziel];
  const who = edit.ziel;
  if (edit.aktion === "version_laden" || (edit.ziel === "version" && edit.aktion === "setzen")) {
    const nummer = Math.round(percentOf(edit.wert, NaN));
    if (!Number.isFinite(nummer)) return { commands: [], error: "Version braucht eine Nummer." };
    return { commands: [{ op: "version", nummer }] };
  }
  if (edit.ziel === "version" && edit.aktion === "zuruecksetzen") return { commands: [{ op: "rueckgaengig" }] };
  if (edit.aktion === "zuruecksetzen") {
    if (!element) return { commands: [], error: `${who} hat kein Layout, das ich zurücksetzen kann.` };
    return { commands: [{ op: "zuruecksetzen", element, formate }] };
  }
  if (edit.aktion === "farbe") {
    const farbe = colorOf(edit.wert);
    if (!farbe) return { commands: [], error: "Farbe nur Lime, Orange, Schwarz oder Weiß." };
    if (edit.ziel !== "headline" && edit.ziel !== "unterzeile" && edit.ziel !== "stern" && edit.ziel !== "stern_text" && edit.ziel !== "cta") {
      return { commands: [], error: `${who} hat keine Farbe. Ein Formatfilter ohne Wirkung wird nicht als umgesetzt gemeldet.` };
    }
    return { commands: [{ op: "farbe", element: element ?? "headline", farbe, formate }] };
  }
  if (edit.ziel === "deko" && (edit.aktion === "setzen" || edit.aktion === "ausblenden")) {
    const name = edit.aktion === "ausblenden" ? "keine" : dekoOf(textOf(edit.wert));
    if (!name) return { commands: [], error: "Deko ist Wellen, Blätter oder keine." };
    return { commands: [{ op: "deko_setzen", name }] };
  }
  if (edit.aktion === "setzen" && edit.wert && typeof edit.wert === "object") {
    if (!element) return { commands: [], error: `${who} hat keine Layout-Parameter.` };
    const { x, y, groesse, ebene } = edit.wert;
    if (x === undefined && y === undefined && groesse === undefined && ebene === undefined) {
      return { commands: [], error: `${who} braucht x, y, groesse oder ebene.` };
    }
    return { commands: [{ op: "parameter", element, formate, x, y, groesse, ebene }] };
  }
  if (edit.aktion === "setzen") {
    const text = textOf(edit.wert);
    if (!text && edit.ziel !== "datenmenge_alt") return { commands: [], error: `${who} braucht einen Text.` };
    const key = FIELD_OF[edit.ziel];
    if (!key) return { commands: [], error: `${who} kann ich nicht als Text setzen.` };
    if (edit.ziel === "deko") return { commands: [], error: "Deko ist Wellen, Blätter oder keine." };
    return { commands: [{ op: "feld", key, value: text }] };
  }
  if (edit.aktion === "ausblenden" || edit.aktion === "einblenden") {
    if (!element) return { commands: [], error: `${who} kann ich nicht ausblenden.` };
    return { commands: [{ op: "sichtbarkeit", element, sichtbar: edit.aktion === "einblenden", formate }] };
  }
  if (edit.aktion === "groesser" || edit.aktion === "kleiner") {
    if (!element) return { commands: [], error: `${who} hat keine Größe.` };
    const percent = percentOf(edit.wert, 15);
    const faktor = edit.aktion === "groesser" ? 1 + percent / 100 : 1 - percent / 100;
    if (faktor <= 0.05) return { commands: [], error: `${who} würde dabei verschwinden.` };
    return { commands: [{ op: "groesse", element, faktor, formate }] };
  }
  if (edit.aktion === "verschieben") {
    if (!element) return { commands: [], error: `${who} hat keine Position.` };
    const commands = directionCommands(element, edit.wert, formate);
    if (!commands.length) return { commands: [], error: `${who} braucht eine Richtung, zum Beispiel { "oben": 5 }.` };
    return { commands };
  }
  return { commands: [], error: `${who} und ${edit.aktion} passen nicht zusammen.` };
}

export function editsFromArgs(args: Record<string, unknown>): { edits: EditChange[]; errors: string[] } {
  const raw = args.aenderungen ?? args.änderungen;
  if (!Array.isArray(raw) || !raw.length) return { edits: [], errors: ["nicht möglich: Die Liste aenderungen ist leer."] };
  const edits: EditChange[] = [];
  const errors: string[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      errors.push("nicht möglich: Eine Änderung ist kein Objekt.");
      continue;
    }
    const record = item as Record<string, unknown>;
    const ziel = String(record.ziel ?? "").trim();
    const aktion = String(record.aktion ?? "").trim();
    if (!isZiel(ziel)) {
      errors.push(`nicht möglich (unbekanntes Ziel ${ziel || "?"}, gültig: ${EDIT_ZIELE.join(", ")})`);
      continue;
    }
    if (!isAktion(aktion)) {
      errors.push(`nicht möglich (unbekannte Aktion ${aktion || "?"}, gültig: ${EDIT_AKTIONEN.join(", ")})`);
      continue;
    }
    const formate = Array.isArray(record.formate) ? record.formate.map((entry) => String(entry)) : undefined;
    const wert = record.wert as EditValue | undefined;
    edits.push({ ziel, aktion, wert, formate });
  }
  return { edits, errors };
}

export function editsFromModel(raw: string): EditChange[] {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const payload = JSON.parse(match[0]) as { aenderungen?: unknown };
    return editsFromArgs({ aenderungen: payload.aenderungen }).edits;
  } catch {
    return [];
  }
}

export function applyEdits(book: AdjustBook, edits: readonly EditChange[]): { book: AdjustBook; errors: string[]; starFactor?: number } {
  const commands: AdjustCommand[] = [];
  const errors: string[] = [];
  let starFactor: number | undefined;
  for (const edit of edits) {
    const mapped = commandsForEdit(edit, book.snap.fields.vorlage);
    if (mapped.error) errors.push(`nicht möglich: ${mapped.error}`);
    commands.push(...mapped.commands);
    const grown = mapped.commands.find((command) => command.op === "groesse" && command.element === "stoerer" && command.faktor > 1);
    if (grown && grown.op === "groesse") starFactor = grown.faktor;
  }
  if (!commands.length) return { book, errors, starFactor };
  const result = applyToBook(book, { befehle: commands });
  return { book: result.book, errors, starFactor: starFactor ?? result.starFactor };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function paramOf(scene: OteloScene, box: { x: number; y: number; w: number; h: number } | undefined, element: ElementId, snap: AdjustSnap | undefined, hidden: boolean, farbe = "", grund = ""): LayoutParam {
  const frame = box && box.w > 2 ? box : { x: 0, y: 0, w: 0, h: 0 };
  const nudge = mergedNudge(snap, scene.id, element);
  const rendered = element === "stoerer" ? scene.renderedGroesse?.stern : undefined;
  return {
    x: round1((frame.x / Math.max(1, scene.width)) * 100),
    y: round1((frame.y / Math.max(1, scene.height)) * 100),
    breite: round1((frame.w / Math.max(1, scene.width)) * 100),
    hoehe: round1((frame.h / Math.max(1, scene.height)) * 100),
    groesse: rendered ?? round1(nudge.scale * 100),
    ebene: (ELEMENT_LAYER[element] ?? 3) + (nudge.z ?? 0),
    versteckt: hidden || nudge.hidden,
    farbe,
    grund,
  };
}

export function standFromScenes(scenes: Record<string, OteloScene>, snap: AdjustSnap | undefined, version = 1, extra?: { vorlage?: string; kampagne?: string }): LayoutStand {
  const fields = snap?.fields ?? {};
  const cta = fields.button ?? "";
  const felder: Record<string, string> = {
    headline: fields.headline ?? "",
    unterzeile: fields.subline ?? "",
    cta,
    button: cta,
    preis: fields.preis ?? "",
    preis_zusatz: fields.preisZusatz ?? "",
    preis_alt: fields.preisAlt ?? "",
    einmalpreis: fields.einmalpreis ?? "",
    datenmenge: fields.datenmenge ?? "",
    datenmenge_alt: fields.datenmengeAlt ?? "",
    stern_text: fields.sternText ?? "",
    deko: fields.deko ?? "",
    motiv: fields.motiv ?? "",
    geraet_name: fields.geraetName ?? "",
    energielabel: fields.energielabel ?? "",
    vorlage: extra?.vorlage || fields.vorlage || "",
    kampagne: extra?.kampagne || fields.kampagne || "",
    version: String(version),
    farbe_unterzeile: fields.sublineColor ?? "",
    farbe_stern: fields.sternColor ?? "",
    farbe_headline: fields.headlineColor ?? "",
    farbe_cta: fields.ctaColor ?? "",
  };
  const layout: LayoutStand["layout"] = {};
  for (const format of OTELO_FORMATS) {
    const scene = scenes[format.id];
    if (!scene) continue;
    const label = sceneFormatLabel(format);
    const grund = scene.hints.find((hint) => hint.startsWith("Korrektur:") && hint.includes(label))?.match(/begrenzt, (.+) im /)?.[1] ?? "";
    const row: Record<string, LayoutParam> = {};
    for (const item of LAYOUT_BOX) {
      const hidden = mergedNudge(snap, format.id, item.element).hidden;
      const farbe = item.ziel === "headline" ? scene.headlineColor || ""
        : item.ziel === "unterzeile" ? scene.subline.lines[0]?.color || ""
        : item.ziel === "stern" ? scene.sternColor || "#FA5A14"
        : item.ziel === "cta" ? scene.ctaColor || "#D7EB00"
        : "";
      row[item.ziel] = paramOf(scene, item.box(scene), item.element, snap, hidden, farbe, item.ziel === "stern" ? grund : "");
    }
    const present = (ziel: string, element: ElementId, box: { x: number; y: number; w: number; h: number } | undefined) => {
      row[ziel] = paramOf(scene, box, element, snap, mergedNudge(snap, format.id, element).hidden);
    };
    present("preis", "zusatz", scene.pill?.box);
    present("datenmenge", "datenmenge", scene.kachel?.box);
    present("datenmenge_alt", "altwert", scene.kachel?.box);
    present("stern_text", "stoerer", scene.stern?.box);
    present("geraet_name", "geraetename", scene.deviceLabel?.box);
    present("preis_alt", "stattpreis", scene.kachel?.box);
    present("einmalpreis", "einmalig", scene.kachel?.box);
    layout[label] = row;
  }
  return { version, felder, layout };
}

/** Writes the scale the picture actually reached, so the stored size matches the render. */
export function syncStoredScale(book: AdjustBook, stand: LayoutStand): void {
  for (const [label, row] of Object.entries(stand.layout)) {
    const format = OTELO_FORMATS.find((item) => sceneFormatLabel(item) === label);
    const got = row.stern?.groesse;
    if (!format || got === undefined) continue;
    const stored = mergedNudge(book.snap, format.id, "stoerer").scale * 100;
    if (Math.abs(stored - got) <= 3) continue;
    const shared = book.snap.nudges["*"]?.stoerer?.scale ?? 1;
    book.snap.nudges[format.id] ??= {};
    const nudge = book.snap.nudges[format.id].stoerer ?? { dx: 0, dy: 0, scale: 1, flip: false, hidden: false };
    nudge.scale = (got / 100) / (shared || 1);
    book.snap.nudges[format.id].stoerer = nudge;
  }
}

function intersects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, air: number): boolean {
  return a.x < b.x + b.w + air && b.x - air < a.x + a.w && a.y < b.y + b.h + air && b.y - air < a.y + a.h;
}

/** A star whose letters would fall below 2 percent of the format height. */
export function starTextTooWide(boxWidth: number, text: string, formatHeight: number): boolean {
  const value = text.trim();
  if (!value || boxWidth < 2) return false;
  return renderedStarTextSize(boxWidth, value) + 0.2 < formatHeight * 0.02;
}

export function problemsFromScenes(scenes: Record<string, OteloScene>): LayoutProblem[] {
  const problems: LayoutProblem[] = [];
  for (const format of OTELO_FORMATS) {
    const scene = scenes[format.id];
    if (!scene) continue;
    const label = sceneFormatLabel(format);
    const star = scene.stern?.box;
    const pill = scene.pill?.box;
    if (star && star.w > 2 && pill && intersects(star, pill, Math.max(8, scene.width * 0.012))) {
      problems.push({ format: label, text: "Der Stern überdeckt die Preis-Pille." });
    }
    const starText = scene.stern?.text ?? "";
    if (star && starTextTooWide(star.w, starText, scene.height)) {
      problems.push({ format: label, text: "Der Stern-Text ist zu breit für den Stern." });
    }
    for (const hint of scene.hints) {
      if (hint.startsWith("Hinweis:")) continue;
      if (/Stern überdeckt/.test(hint)) problems.push({ format: label, text: hint });
      if (/Gerät ist zu klein/.test(hint)) problems.push({ format: label, text: hint });
      if (/Stern-Text ist zu klein/.test(hint)) problems.push({ format: label, text: `Der Stern-Text ist zu breit für den Stern im ${label}.` });
    }
  }
  const seen = new Set<string>();
  return problems.filter((problem) => {
    const key = `${problem.format}|${problem.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function freshProblems(current: readonly LayoutProblem[], baseline: readonly LayoutProblem[]): LayoutProblem[] {
  const known = new Set(baseline.map((problem) => `${problem.format}|${problem.text}`));
  return current.filter((problem) => !known.has(`${problem.format}|${problem.text}`));
}

type Placed = { breite: number; hoehe: number; x: number; y: number; groesse: number; versteckt: boolean };

function placed(stand: LayoutStand, label: string, ziel: string): Placed | undefined {
  const row = stand.layout[label]?.[ziel];
  return row;
}

function labelsOf(stand: LayoutStand, formate?: string[]): string[] {
  const ids = formatIds(formate);
  if (!ids) return Object.keys(stand.layout);
  return OTELO_FORMATS.filter((format) => ids.includes(format.id)).map((format) => sceneFormatLabel(format));
}

function grew(before: number, after: number): boolean {
  return after > before + Math.max(0.4, before * 0.04);
}

function shrunk(before: number, after: number): boolean {
  return after + Math.max(0.4, after * 0.04) < before;
}

/** One line per change, from the measured layout, not from the planned factor. */
export function judgeEdits(edits: readonly EditChange[], before: LayoutStand, after: LayoutStand): string[] {
  const title: Record<EditZiel, string> = {
    headline: "Headline", unterzeile: "Unterzeile", cta: "CTA", preis: "Preis", preis_zusatz: "Preis-Zusatz",
    preis_alt: "statt-Preis", einmalpreis: "Einmalpreis", datenmenge: "Datenmenge", datenmenge_alt: "Altwert",
    stern: "Stern", stern_text: "Stern-Text", deko: "Deko", motiv: "Motiv", geraet_name: "Gerätename",
    energielabel: "Energielabel", kachel: "Kachel", figur: "Figur", version: "Version",
    handy: "Motiv", geraet: "Motiv", gerät: "Motiv",
  };
  return edits.map((edit) => {
    const name = title[edit.ziel] ?? edit.ziel;
    const layoutZiel = edit.ziel === "stern_text" ? "stern"
      : (edit.ziel === "motiv" || edit.ziel === "handy" || edit.ziel === "geraet" || edit.ziel === "gerät" || (edit.ziel === "figur" && typeof edit.wert === "object"))
        ? (imageElement(after.felder.vorlage) === "geraet" ? "geraet" : "figur")
        : edit.ziel;
    if (edit.aktion === "setzen" && typeof edit.wert !== "object") {
      const key = edit.ziel === "cta" ? "cta" : edit.ziel === "unterzeile" ? "unterzeile" : edit.ziel === "stern" || edit.ziel === "stern_text" ? "stern_text" : edit.ziel;
      const wanted = edit.ziel === "deko" ? dekoOf(textOf(edit.wert)) ?? textOf(edit.wert) : textOf(edit.wert);
      const got = after.felder[key] ?? "";
      if (edit.ziel === "deko") return got === wanted ? `umgesetzt: Deko ist ${wanted}` : `nicht möglich: Deko bleibt ${got || "unverändert"}`;
      return got === wanted ? `umgesetzt: ${name} ist „${wanted}“` : `nicht möglich: ${name} bleibt „${got}“`;
    }
    if (edit.aktion === "farbe") {
      const farbe = (colorOf(edit.wert) ?? "").toLowerCase();
      const labels = labelsOf(after, edit.formate);
      const painted = (label: string) => (after.layout[label]?.[layoutZiel]?.farbe ?? "").toLowerCase();
      const done = labels.filter((label) => painted(label) === farbe);
      const others = Object.keys(after.layout).filter((label) => !labels.includes(label));
      const leaked = edit.formate?.length ? others.filter((label) => painted(label) === farbe && (before.layout[label]?.[layoutZiel]?.farbe ?? "").toLowerCase() !== farbe) : [];
      if (!farbe) return `nicht möglich: Farbe nur Lime, Orange, Schwarz oder Weiß.`;
      if (leaked.length) return `nicht möglich: Die Farbe würde auch ${leaked.join(", ")} ändern.`;
      if (done.length === labels.length && labels.length) return `umgesetzt: ${name} ist ${textOf(edit.wert) || farbe}${edit.formate?.length ? ` (${labels.join(", ")})` : ""}`;
      return `nicht möglich: ${name} hat die Farbe nur in ${done.join(", ") || "keinem Format"}.`;
    }
    if (edit.aktion === "version_laden" || (edit.ziel === "version" && edit.aktion === "setzen")) {
      const nummer = Math.round(percentOf(edit.wert, NaN));
      return after.version !== before.version ? `umgesetzt: Version ${nummer}` : `nicht möglich: Version ${nummer} kenne ich nicht.`;
    }
    if (edit.aktion === "zuruecksetzen" && edit.ziel === "version") {
      return after.version !== before.version ? "umgesetzt: vorherige Version" : "nicht möglich: Es gibt keine frühere Version.";
    }
    const ziel = layoutZiel;
    const labels = labelsOf(after, edit.formate).filter((label) => before.layout[label] || after.layout[label]);
    if (edit.aktion === "ausblenden" || edit.aktion === "einblenden") {
      const wantHidden = edit.aktion === "ausblenden";
      const done = labels.filter((label) => Boolean(placed(after, label, ziel)?.versteckt) === wantHidden);
      if (!labels.length || done.length === labels.length) return `umgesetzt: ${name} ${wantHidden ? "ausgeblendet" : "eingeblendet"}`;
      if (!done.length) return `nicht möglich: ${name} bleibt ${wantHidden ? "sichtbar" : "ausgeblendet"}`;
      return `teilweise: ${name} ${wantHidden ? "ausgeblendet" : "eingeblendet"} (${done.join(", ")})`;
    }
    if (edit.aktion === "groesser" || edit.aktion === "kleiner") {
      const up = edit.aktion === "groesser";
      const percent = percentOf(edit.wert, 15);
      const gainOf = (label: string) => {
        const left = placed(before, label, ziel);
        const right = placed(after, label, ziel);
        if (!left || !right || left.breite <= 0) return 0;
        return ((right.breite - left.breite) / left.breite) * 100;
      };
      const full = labels.filter((label) => up ? gainOf(label) + 3 >= percent : -gainOf(label) + 3 >= percent);
      const any = labels.filter((label) => up ? gainOf(label) >= 3 : -gainOf(label) >= 3);
      const why = labels.map((label) => after.layout[label]?.[ziel]?.grund).find(Boolean);
      const phrase = `${name} ${percent} % ${up ? "größer" : "kleiner"}`;
      if (full.length === labels.length && labels.length) return `umgesetzt: ${phrase}`;
      if (!any.length) return `nicht möglich: ${name} schon ${up ? "maximal groß" : "minimal klein"}${why ? ` (${why})` : ""}`;
      const listed = full.length ? full : any;
      const rest = labels.filter((label) => !listed.includes(label));
      const limit = rest.length ? `. Übrige schon ${up ? "maximal groß" : "minimal klein"}.` : why ? `. ${why}` : "";
      return `teilweise: ${phrase} (${listed.join(", ")})${limit}`;
    }
    if (edit.aktion === "verschieben" && edit.wert && typeof edit.wert === "object") {
      const done = labels.filter((label) => {
        const left = placed(before, label, ziel);
        const right = placed(after, label, ziel);
        if (!left || !right) return false;
        return Math.abs(left.x - right.x) > 0.4 || Math.abs(left.y - right.y) > 0.4;
      });
      const why = labels.map((label) => after.layout[label]?.[ziel]?.grund).find(Boolean);
      if (done.length === labels.length && labels.length) return `umgesetzt: ${name} verschoben`;
      if (!done.length) return `nicht möglich: ${name} lässt sich dort nicht verschieben${why ? ` (${why})` : ""}`;
      return `teilweise: ${name} verschoben (${done.join(", ")})`;
    }
    if (edit.aktion === "setzen" && edit.wert && typeof edit.wert === "object" && edit.wert.groesse !== undefined) {
      const want = edit.wert.groesse;
      const close = labels.filter((label) => Math.abs((after.layout[label]?.[ziel]?.groesse ?? 0) - want) <= 3);
      const why = labels.map((label) => after.layout[label]?.[ziel]?.grund).find(Boolean);
      if (close.length === labels.length && labels.length) return `umgesetzt: ${name} ${want} %`;
      const got = Math.round(after.layout[labels[0] ?? ""]?.[ziel]?.groesse ?? 0);
      return `teilweise: ${name} auf ${got} % begrenzt${why ? `, ${why}` : ""}`;
    }
    if (edit.aktion === "setzen" && edit.wert && typeof edit.wert === "object") {
      return `umgesetzt: ${name} Layout gesetzt`;
    }
    if (edit.aktion === "zuruecksetzen") return `umgesetzt: ${name} auf die Vorlage zurückgesetzt`;
    return `umgesetzt: ${name}`;
  });
}

export function standText(stand: LayoutStand, corrections: readonly string[] = []): string {
  return `Stand:\n\`\`\`json\n${JSON.stringify({ felder: stand.felder, layout: stand.layout, korrekturen: corrections })}\n\`\`\``;
}

export type CorrectionMeasure = { problems: LayoutProblem[]; stand: LayoutStand };

/** Applies proposals while a round removes a violation. Stops after three rounds or when a round does not help. */
export async function correctionLoop(input: {
  book: AdjustBook;
  measure: (book: AdjustBook) => Promise<CorrectionMeasure> | CorrectionMeasure;
  propose: (ctx: { probleme: LayoutProblem[]; stand: LayoutStand; runde: number }) => Promise<EditChange[] | undefined> | EditChange[] | undefined;
  maxRounds?: number;
}): Promise<{ book: AdjustBook; corrections: string[]; problems: LayoutProblem[]; stand: LayoutStand }> {
  const maxRounds = input.maxRounds ?? 3;
  let book = input.book;
  let measured = await input.measure(book);
  const corrections: string[] = [];
  for (let round = 0; round < maxRounds && measured.problems.length; round += 1) {
    const proposal = (await input.propose({ probleme: measured.problems, stand: measured.stand, runde: round + 1 })) ?? [];
    if (!proposal.length) break;
    const nextBook = applyEdits(book, proposal).book;
    const next = await input.measure(nextBook);
    if (next.problems.length >= measured.problems.length) {
      corrections.push(`nicht möglich: Korrektur – ${measured.problems.map((problem) => `${problem.text} (${problem.format})`).join(" ")}`);
      break;
    }
    const line = judgeEdits(proposal, measured.stand, next.stand).join(" ");
    corrections.push(`Korrektur: ${line || proposal.map((edit) => `${edit.ziel} ${edit.aktion}`).join(", ")}`);
    book = nextBook;
    measured = next;
  }
  return { book, corrections, problems: measured.problems, stand: measured.stand };
}

/** The layout model proposes parameter changes. Tests pass their own proposer. */
export async function proposeLayoutFixes(ctx: { probleme: LayoutProblem[]; stand: LayoutStand; bildBase64?: string }): Promise<EditChange[]> {
  const config = openRouterConfig(MODEL_VARIABLE, "anthropic/claude-sonnet-5.5");
  if (!config.configured || !ctx.probleme.length) return [];
  const text = [
    "Messwerte:",
    ...ctx.probleme.map((problem) => `${problem.format}: ${problem.text}`),
    "Aktuelles Layout und Felder:",
    JSON.stringify({ felder: ctx.stand.felder, layout: ctx.stand.layout }),
    "Antworte nur mit JSON {\"aenderungen\":[{\"ziel\",\"aktion\",\"wert\",\"formate\"}]}.",
    "Höchstens drei Änderungen. Eine Änderung darf keine neue Überlappung erzeugen.",
    "Stern auf der Preis-Pille: kleiner oder nach oben, nur in den genannten Formaten.",
    "Stern-Text zu breit: Stern groesser, oder stern_text kürzer setzen, wenn der Stern schon maximal groß ist.",
  ].join("\n");
  const content = ctx.bildBase64
    ? [{ type: "text" as const, text }, { type: "image_url" as const, image_url: { url: `data:image/jpeg;base64,${ctx.bildBase64}` } }]
    : text;
  const raw = await openRouterComplete({
    messages: [
      { role: "system", content: "Du korrigierst Layout-Parameter eines Werbemotivs und antwortest nur mit JSON. Kein Modellname. Keine anderen Sätze." },
      { role: "user", content },
    ],
    config,
    appTitle: "Visual Builder",
    temperature: 0,
    maxTokens: 500,
    timeoutMs: 20000,
    responseFormat: { type: "json_object" },
  }).catch(() => "");
  return editsFromModel(raw).slice(0, 3);
}

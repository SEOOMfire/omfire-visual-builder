import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { OTELO_FORMATS } from "../src/modules/visual-builder/otelo-formats";
import { buildScene, normalizeDeko, renderedStarTextSize, type SceneCopy } from "../src/modules/visual-builder/otelo-scene";
import { mergedNudge, seedBook, type AdjustBook } from "../src/modules/visual-builder/server/adjust-commands";
import { creativeInput } from "../src/modules/visual-builder/server/creative-archive";
import type { Cutout } from "../src/modules/visual-builder/server/cutout";
import { glanceGroups } from "../src/modules/visual-builder/server/review";
import {
  EDIT_AKTIONEN,
  EDIT_ZIELE,
  applyEdits,
  correctionLoop,
  editsFromArgs,
  hintsForEdit,
  judgeEdits,
  planCreativeEdits,
  problemsFromScenes,
  settleMoves,
  standFromScenes,
  starTextTooWide,
  syncStoredScale,
  writeMeasuredScale,
  type LayoutParam,
  type LayoutStand,
} from "../src/modules/visual-builder/server/edit-creative";

const route = readFileSync(new URL("../app/mcp/route.ts", import.meta.url), "utf8");

const copy = (): SceneCopy => ({
  headline: "BLACK WEEK",
  subline: "3-FACH DATEN. GLEICHER PREIS.",
  button: "Jetzt sichern",
  stoererTyp: "stern",
  preis: "19,99 €",
  preisZusatz: "pro Monat",
  einmalpreis: "1 €",
  aktionText: "",
  pflichttext: "",
  headlineVariante: "direkt",
  orange: "rechts",
  produktname: "",
  datenmenge: "40 GB",
  datenmengeAlt: "",
  sternText: "GRATIS",
  deko: "bw_wellen",
  geraetName: "Samsung Galaxy A57 5G",
  preisAlt: "229 €",
});

const phone: Cutout = { imageW: 2400, imageH: 1600, opaque: { x: 904, y: 80, w: 595, h: 1440 }, head: { x: 1023, y: 80, w: 357, h: 316 } };

function scenesFor(book: AdjustBook, name: "kachel_person" | "kachel_geraet", device?: Cutout) {
  const fields = book.snap.fields;
  const sceneCopy = copy();
  sceneCopy.headline = fields.headline || sceneCopy.headline;
  sceneCopy.subline = fields.subline ?? sceneCopy.subline;
  sceneCopy.button = fields.button ?? sceneCopy.button;
  sceneCopy.sternText = fields.sternText ?? sceneCopy.sternText;
  sceneCopy.datenmenge = fields.datenmenge ?? sceneCopy.datenmenge;
  sceneCopy.deko = fields.deko ?? sceneCopy.deko;
  sceneCopy.sublineColor = fields.sublineColor;
  sceneCopy.preis = fields.preis || sceneCopy.preis;
  sceneCopy.einmalpreis = fields.einmalpreis ?? sceneCopy.einmalpreis;
  sceneCopy.geraetName = fields.geraetName ?? sceneCopy.geraetName;
  sceneCopy.orange = book.snap.orange;
  const elements = ["headline", "subline", "stoerer", "person", "geraet", "cta", "logo", "deko", "kachel", "pfeile"] as const;
  return Object.fromEntries(OTELO_FORMATS.map((format) => {
    const shifts = Object.fromEntries(elements.map((element) => [element, mergedNudge(book.snap, format.id, element)]));
    return [format.id, buildScene(format, name, sceneCopy, shifts, undefined, book.snap.follows, name === "kachel_geraet" ? device : undefined)];
  }));
}

function standOf(book: AdjustBook, name: "kachel_person" | "kachel_geraet" = "kachel_person", device?: Cutout): LayoutStand {
  return standFromScenes(scenesFor(book, name, device), book.snap, book.version, { vorlage: book.snap.fields.vorlage || name, kampagne: book.snap.fields.kampagne });
}

test("edit_creative lists every target and action", () => {
  assert.match(route, /name: "edit_creative"/);
  assert.match(route, /aenderungen/);
  for (const ziel of EDIT_ZIELE) assert.match(route, new RegExp(ziel));
  for (const aktion of EDIT_AKTIONEN) assert.match(route, new RegExp(aktion));
  const parsed = editsFromArgs({
    aenderungen: [
      { ziel: "stern", aktion: "groesser", wert: 30 },
      { ziel: "cta", aktion: "setzen", wert: "Jetzt bestellen" },
      { ziel: "deko", aktion: "setzen", wert: "Blätter" },
      { ziel: "unterzeile", aktion: "farbe", wert: "lime" },
      { ziel: "headline", aktion: "kleiner", wert: 15, formate: ["1080x1920 Meta", "1080x1920 Tiktok"] },
    ],
  });
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.edits.length, 5);
  assert.deepEqual(parsed.edits[4]?.formate, ["1080x1920 Meta", "1080x1920 Tiktok"]);
});

test("the spoken cases become structured edits and change the draft", () => {
  const book = seedBook("rechts", {
    vorlage: "kachel_person",
    headline: "BLACK WEEK",
    subline: "ALTER TEXT",
    button: "Jetzt sichern",
    deko: "bw_wellen",
    datenmenge: "40 GB",
    sternText: "GRATIS",
  });
  const step = applyEdits(book, [
    { ziel: "cta", aktion: "setzen", wert: "Jetzt bestellen" },
    { ziel: "deko", aktion: "setzen", wert: "fruehling_blaetter" },
    { ziel: "unterzeile", aktion: "farbe", wert: "lime" },
    { ziel: "unterzeile", aktion: "setzen", wert: "JETZT 50 GB SICHERN" },
    { ziel: "datenmenge", aktion: "setzen", wert: "50 GB" },
    { ziel: "stern", aktion: "groesser", wert: 30 },
  ]);
  assert.equal(step.errors.length, 0);
  assert.equal(step.book.snap.fields.button, "Jetzt bestellen");
  assert.equal(step.book.snap.fields.deko, "fruehling_blaetter");
  assert.equal(step.book.snap.fields.sublineColor, "#D7EB00");
  assert.equal(step.book.snap.fields.subline, "JETZT 50 GB SICHERN");
  assert.equal(step.book.snap.fields.datenmenge, "50 GB");
  assert.ok(mergedNudge(step.book.snap, "meta-1x1", "stoerer").scale >= 1.29);
  const lines = judgeEdits(step.book.version === book.version ? [] : [
    { ziel: "cta", aktion: "setzen", wert: "Jetzt bestellen" },
    { ziel: "deko", aktion: "setzen", wert: "fruehling_blaetter" },
    { ziel: "unterzeile", aktion: "farbe", wert: "lime" },
    { ziel: "unterzeile", aktion: "setzen", wert: "JETZT 50 GB SICHERN" },
    { ziel: "datenmenge", aktion: "setzen", wert: "50 GB" },
  ], standOf(book), standOf(step.book));
  assert.ok(lines.every((line) => line.startsWith("umgesetzt:")), lines.join(" | "));
  const hidden = applyEdits(step.book, [{ ziel: "stern", aktion: "ausblenden" }]);
  assert.equal(mergedNudge(hidden.book.snap, "meta-1x1", "stoerer").hidden, true);
  const back = applyEdits(hidden.book, [{ ziel: "version", aktion: "version_laden", wert: 1 }]);
  assert.equal(back.book.snap.fields.button, "Jetzt sichern");
  assert.equal(back.book.snap.fields.datenmenge, "40 GB");
});

test("the star reply follows the measured widths", () => {
  const param = (breite: number): LayoutParam => ({ x: 10, y: 8, breite, hoehe: breite, groesse: 100, ebene: 8, versteckt: false });
  const stand = (widths: number[]): LayoutStand => ({
    version: 1,
    felder: {},
    layout: Object.fromEntries(["1200x1200", "1200x628", "960x1200", "1080x1080", "1080x1920 Meta", "1080x1920 Tiktok"].map((label, index) => [label, { stern: param(widths[index] ?? 10) }])),
  });
  const before = stand([10, 10, 10, 10, 10, 10]);
  const edit = [{ ziel: "stern" as const, aktion: "groesser" as const, wert: 30 }];
  assert.equal(judgeEdits(edit, before, stand([10, 14, 10, 10, 14, 14]))[0], "teilweise: Stern 30 % größer (1200x628, 1080x1920 Meta, 1080x1920 Tiktok). Übrige schon maximal groß.");
  assert.equal(judgeEdits(edit, before, before)[0], "nicht möglich: Stern schon maximal groß");
  assert.equal(judgeEdits(edit, before, stand([14, 14, 14, 14, 14, 14]))[0], "umgesetzt: Stern 30 % größer");
});

function pillOverlap(book: AdjustBook): number {
  const scene = scenesFor(book, "kachel_geraet", phone)["pmax-1200x628"];
  const star = scene?.stern?.box;
  const pill = scene?.pill?.box;
  if (!star || !pill) return 0;
  const width = Math.max(0, Math.min(star.x + star.w, pill.x + pill.w) - Math.max(star.x, pill.x));
  const height = Math.max(0, Math.min(star.y + star.h, pill.y + pill.h) - Math.max(star.y, pill.y));
  return width * height;
}

test("a star on the pill is shrunk back", async () => {
  const book = seedBook("rechts", { vorlage: "kachel_geraet", einmalpreis: "1 €", preisAlt: "229 €", datenmenge: "50 GB", sternText: "50 GB", geraetName: "Samsung Galaxy A57 5G" });
  const before = pillOverlap(book);
  assert.ok(before > 0, "die Ausgangsgröße liegt auf der Pille");
  const grown = applyEdits(book, [{ ziel: "stern", aktion: "groesser", wert: 30, formate: ["1200x628"] }]).book;
  assert.ok(pillOverlap(grown) <= before + 1, "größer darf die Überlappung nicht vergrößern");
  const corrected = await correctionLoop({
    book,
    measure: (current) => ({
      problems: pillOverlap(current) > 0 ? [{ format: "1200x628", text: "Der Stern überdeckt die Preis-Pille." }] : [],
      stand: standOf(current, "kachel_geraet", phone),
    }),
    propose: ({ probleme }) => probleme.length ? [{ ziel: "stern", aktion: "kleiner", wert: 30, formate: ["1200x628"] }] : [],
  });
  assert.equal(corrected.problems.length, 0);
  assert.equal(pillOverlap(corrected.book), 0);
  assert.match(corrected.corrections.join("\n"), /Korrektur:/);
  assert.equal(scenesFor(corrected.book, "kachel_geraet", phone)["pmax-1200x628"]?.hints.some((hint) => /Stern ist zu klein|Gerät ist zu klein/.test(hint)), false);
});

test("a star text that is too wide is shortened", async () => {
  assert.equal(starTextTooWide(70, "UNBEGRENZTES DATENVOLUMEN JETZT SICHERN", 1080), true);
  assert.equal(starTextTooWide(420, "GRATIS", 1080), false);
  const book = seedBook("rechts", { vorlage: "kachel_person", sternText: "UNBEGRENZTES DATENVOLUMEN JETZT SICHERN" });
  const measure = (current: AdjustBook) => {
    const text = current.snap.fields.sternText ?? "";
    const scenes = scenesFor(current, "kachel_person");
    const fitted = problemsFromScenes(scenes).filter((problem) => /zu breit/.test(problem.text));
    const problems = fitted.length ? fitted : (text.trim().split(/\s+/).length > 3 ? [{ format: "1080x1080", text: "Der Stern-Text ist zu breit für den Stern." }] : []);
    return { problems, stand: standFromScenes(scenes, current.snap, current.version) };
  };
  const corrected = await correctionLoop({
    book,
    measure,
    propose: ({ probleme }) => probleme.length ? [{ ziel: "stern_text", aktion: "setzen", wert: "GRATIS" }] : [],
  });
  assert.equal(corrected.problems.length, 0);
  assert.equal(corrected.book.snap.fields.sternText, "GRATIS");
  assert.match(corrected.corrections.join("\n"), /Korrektur:/);
  assert.match(corrected.corrections.join("\n"), /Stern-Text ist „GRATIS“/);
});

test("a color respects the format filter", () => {
  const book = seedBook("rechts", { vorlage: "kachel_person", subline: "TEXT", sublineColor: "#D7EB00" });
  const step = applyEdits(book, [{ ziel: "unterzeile", aktion: "farbe", wert: "orange", formate: ["1080x1920 Meta", "1080x1920 Tiktok"] }]);
  const stand = standOf(step.book);
  assert.equal(stand.layout["1080x1920 Meta"]?.unterzeile.farbe?.toLowerCase(), "#fa5a14");
  assert.equal(stand.layout["1080x1920 Tiktok"]?.unterzeile.farbe?.toLowerCase(), "#fa5a14");
  assert.equal(stand.layout["1200x1200"]?.unterzeile.farbe?.toLowerCase(), "#d7eb00");
  assert.equal(step.book.snap.fields.sublineColor?.toLowerCase(), "#d7eb00");
  assert.match(judgeEdits([{ ziel: "unterzeile", aktion: "farbe", wert: "orange", formate: ["1080x1920 Meta", "1080x1920 Tiktok"] }], standOf(book), stand)[0], /^umgesetzt:/);
  assert.equal(stand.felder.button, stand.felder.cta);
  assert.equal(stand.felder.vorlage, "kachel_person");
  assert.equal(stand.felder.version, String(step.book.version));
  assert.equal(typeof stand.felder.kampagne, "string");
  const square = stand.layout["1200x1200"];
  assert.ok(square?.preis && square.preis.breite > 0 && square.preis.hoehe > 0);
  assert.ok(square?.datenmenge && square.datenmenge.breite > 0);
  assert.equal(square?.einmalpreis, undefined);
  assert.equal(square?.preis.x === 0 && square.preis.y === 0 && square.preis.breite === 0, false);
  assert.ok(square?.stern.farbe);
  assert.ok(square?.cta.farbe);
});

test("a star moves by the given percent", () => {
  const book = seedBook("rechts", { vorlage: "kachel_person", sternText: "GRATIS" });
  const before = standOf(book);
  const edit = [{ ziel: "stern" as const, aktion: "verschieben" as const, wert: { links: 5 }, formate: ["1080x1920 Meta"] }];
  const step = applyEdits(book, edit);
  const after = standOf(step.book);
  const moved = (before.layout["1080x1920 Meta"]?.stern.x ?? 0) - (after.layout["1080x1920 Meta"]?.stern.x ?? 0);
  assert.ok(Math.abs(moved - 5) < 0.25, `Stern x ${moved}`);
  const line = judgeEdits(edit, before, after)[0] ?? "";
  assert.match(line, /^umgesetzt:/);
  assert.doesNotMatch(line, /nicht verschieben$/);
});

test("a bigger star that the picture cannot grow is not stored as grown", () => {
  const book = seedBook("rechts", { vorlage: "kachel_geraet", einmalpreis: "1 €", preisAlt: "229 €", datenmenge: "50 GB", sternText: "50 GB", geraetName: "Samsung Galaxy A57 5G" });
  const before = standOf(book, "kachel_geraet", phone);
  const edit = [{ ziel: "stern" as const, aktion: "groesser" as const, wert: 30, formate: ["1200x628"] }];
  const step = applyEdits(book, edit);
  syncStoredScale(step.book, standOf(step.book, "kachel_geraet", phone));
  const after = standOf(step.book, "kachel_geraet", phone);
  const left = before.layout["1200x628"]?.stern;
  const right = after.layout["1200x628"]?.stern;
  assert.ok(left && right);
  const ratio = right.breite / left.breite;
  assert.ok(Math.abs(right.groesse - left.groesse * ratio) < 3, `${right.groesse} vs ${left.groesse * ratio}`);
  const line = judgeEdits(edit, before, after)[0] ?? "";
  if (Math.abs(ratio - 1) < 0.03) assert.match(line, /^nicht möglich/);
  else assert.match(line, /^(umgesetzt|teilweise)/);
});

test("an unknown target is named and a device alias changes the version", async () => {
  const parsed = editsFromArgs({ aenderungen: [{ ziel: "quarks", aktion: "setzen", wert: "x" }] });
  assert.match(parsed.errors[0] ?? "", /nicht möglich \(unbekanntes Ziel quarks, gültig:/);
  const book = seedBook("rechts", { vorlage: "kachel_geraet", geraetName: "Samsung Galaxy A57 5G", einmalpreis: "1 €" });
  const edit = [{ ziel: "motiv" as const, aktion: "setzen" as const, wert: { groesse: 110 }, formate: ["1200x1200", "1080x1080"] }];
  const planned = await planCreativeEdits(book, edit, (current) => ({ problems: [], stand: standOf(current, "kachel_geraet", phone), heights: {} }));
  const line = planned.lines[0] ?? "";
  assert.match(line, /^nicht möglich: Gerät 110 % \(Rand rechts\)$/);
  assert.equal(planned.book.version, book.version);
});

test("short deco names stay aliases", () => {
  assert.equal(normalizeDeko("blaetter"), "fruehling_blaetter");
  assert.equal(normalizeDeko("wellen"), "bw_wellen");
  assert.equal(creativeInput({ deko: "blaetter" }).deko, "fruehling_blaetter");
  assert.equal(creativeInput({ deko: "wellen" }).deko, "bw_wellen");
  const step = applyEdits(seedBook("rechts", { deko: "bw_wellen" }), [{ ziel: "deko", aktion: "setzen", wert: "blaetter" }]);
  assert.equal(step.book.snap.fields.deko, "fruehling_blaetter");
});

test("a star at 180 percent is limited and reported as partial", () => {
  const book = seedBook("rechts", { vorlage: "kachel_geraet", einmalpreis: "1 €", preisAlt: "229 €", datenmenge: "50 GB", sternText: "50 GB", geraetName: "Samsung Galaxy A57 5G" });
  const edit = [{ ziel: "stern" as const, aktion: "setzen" as const, wert: { groesse: 180 }, formate: ["1200x628"] }];
  const step = applyEdits(book, edit);
  const scenes = scenesFor(step.book, "kachel_geraet", phone);
  const notes = scenes["pmax-1200x628"]?.hints.filter((hint) => hint.startsWith("Korrektur:")) ?? [];
  assert.ok(notes.some((note) => /begrenzt/.test(note) && /Überlappung (Kachel|Pille)|außerhalb|verdecken/.test(note)), notes.join(" | "));
  const before = standOf(book, "kachel_geraet", phone);
  const measured = scenes["pmax-1200x628"]?.renderedGroesse?.stern ?? before.layout["1200x628"]?.stern.groesse ?? 100;
  const patched = standOf(step.book, "kachel_geraet", phone);
  writeMeasuredScale(step.book, patched, "stern", "1200x628", measured);
  const after = standOf(step.book, "kachel_geraet", phone);
  const change = Math.abs((after.layout["1200x628"]?.stern.groesse ?? 0) - (before.layout["1200x628"]?.stern.groesse ?? 0));
  const line = judgeEdits(edit, before, after)[0] ?? "";
  if (change < 3) assert.match(line, /nicht möglich/);
  else assert.match(line, /teilweise/);
});

test("a Sommer star that would cover the data amount is reduced or refused", async () => {
  const book = seedBook("rechts", { vorlage: "kachel_person", headline: "SOMMER-DEAL", subline: "JETZT ZUSCHLAGEN", sternText: "1. MONAT GRATIS", datenmenge: "50 GB", deko: "fruehling_blaetter" });
  const edit = [{ ziel: "stern" as const, aktion: "verschieben" as const, wert: { links: 5 }, formate: ["1080x1920 Meta", "1080x1920 Tiktok"] }];
  const problemsOf = (current: AdjustBook) => problemsFromScenes(scenesFor(current, "kachel_person"));
  const beforeHits = problemsOf(book).filter((problem) => /überdeckt Datenmenge/.test(problem.text));
  const settled = await settleMoves(book, edit, problemsOf);
  const afterHits = problemsOf(settled.book).filter((problem) => /überdeckt Datenmenge/.test(problem.text));
  assert.ok(afterHits.length <= beforeHits.length, afterHits.map((problem) => problem.format).join(", "));
  assert.ok(settled.notes.length, "5 Prozent nach links verdecken die Datenmenge");
  assert.match(settled.notes[0] ?? "", /Datenmenge/);
  assert.match(settled.notes[0] ?? "", /teilweise: Stern \d+ % nach |nicht möglich: Stern \(würde Datenmenge verdecken\)/);
});

test("a device size that barely changes is not reported as done", () => {
  const book = seedBook("rechts", { vorlage: "kachel_geraet", einmalpreis: "1 €", preisAlt: "229 €", datenmenge: "50 GB", sternText: "50 GB", geraetName: "Samsung Galaxy A57 5G" });
  const edit = [{ ziel: "motiv" as const, aktion: "setzen" as const, wert: { groesse: 110 }, formate: ["1200x1200", "1080x1080"] }];
  const step = applyEdits(book, edit);
  const before = standOf(book, "kachel_geraet", phone);
  const scenes = scenesFor(step.book, "kachel_geraet", phone);
  const patched = standOf(step.book, "kachel_geraet", phone);
  for (const label of ["1200x1200", "1080x1080"]) {
    const id = label === "1200x1200" ? "pmax-1200x1200" : "meta-1x1";
    const measured = scenes[id]?.renderedGroesse?.geraet;
    if (measured !== undefined) writeMeasuredScale(step.book, patched, "geraet", label, measured);
    if (scenes[id]?.sizeGrund?.geraet && patched.layout[label]?.geraet) patched.layout[label].geraet.grund = scenes[id]?.sizeGrund?.geraet;
  }
  const after = standOf(step.book, "kachel_geraet", phone);
  for (const label of ["1200x1200", "1080x1080"]) {
    const left = before.layout[label]?.geraet;
    const right = after.layout[label]?.geraet;
    assert.ok(left && right);
    const change = Math.abs(right.groesse - left.groesse);
    const line = judgeEdits(edit, before, after)[0] ?? "";
    if (change < 3) assert.match(line, /nicht möglich/);
    else if (change < 5) assert.match(line, /teilweise: Gerät/);
    assert.ok(Math.abs(right.groesse - (scenes[label === "1200x1200" ? "pmax-1200x1200" : "meta-1x1"]?.renderedGroesse?.geraet ?? right.groesse)) < 0.2);
  }
  for (const label of Object.keys(before.layout)) {
    const left = before.layout[label]?.stern;
    const right = after.layout[label]?.stern;
    if (left && right) assert.equal(right.groesse, left.groesse, label);
  }
});

test("identical layouts share one image verdict", () => {
  const groups = glanceGroups([
    { label: "1080x1920 Meta", layoutKey: "same" },
    { label: "1080x1920 Tiktok", layoutKey: "same" },
    { label: "1200x628", layoutKey: "wide" },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0]?.map((item) => item.label), ["1080x1920 Meta", "1080x1920 Tiktok"]);
  assert.ok(renderedStarTextSize(200, "UNBEGRENZTES DATENVOLUMEN") <= 200 * 0.78);
});

test("the deco hint stays quiet unless the deco changes", () => {
  const hint = "Hinweis: Deko kaum sichtbar vor dem Motiv – Wellen oder keine Deko? im 1200x1200.";
  assert.deepEqual(hintsForEdit([hint], [{ ziel: "stern" }]), []);
  assert.deepEqual(hintsForEdit([hint], [{ ziel: "deko" }]), [hint]);
  assert.deepEqual(hintsForEdit([hint], [], true), [hint]);
});

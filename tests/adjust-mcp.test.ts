import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PNG } from "pngjs";
import { adjustRequest, applyToBook, mergedNudge, newBook, seedBook, type AdjustBook } from "../src/modules/visual-builder/server/adjust-commands";
import { withoutInstructed } from "../src/modules/visual-builder/server/review";
import { OTELO_FORMATS } from "../src/modules/visual-builder/otelo-formats";
import { buildScene, elementRelation, fitHeadlineForChevrons, starLines, type SceneCopy } from "../src/modules/visual-builder/otelo-scene";

const route = readFileSync(new URL("../app/mcp/route.ts", import.meta.url), "utf8");

const base = (): SceneCopy => ({
  headline: "BLACK WEEK",
  subline: "3-FACH DATEN. GLEICHER PREIS.",
  button: "Jetzt sichern",
  stoererTyp: "stern",
  preis: "19,99 €",
  preisZusatz: "pro Monat",
  einmalpreis: "",
  aktionText: "",
  pflichttext: "",
  headlineVariante: "direkt",
  orange: "rechts",
  produktname: "",
  datenmenge: "150 GB",
  datenmengeAlt: "50 GB",
  sternText: "YOUNG DEAL",
  deko: "bw_wellen",
  kampagne: "BW",
});

function shiftsFor(book: AdjustBook, format: { id: string; token: string; w: number; h: number }) {
  const keys = ["*", format.id, format.token, `${format.w}x${format.h}`];
  const elements = ["headline", "subline", "stoerer", "person", "geraet", "cta", "logo", "deko", "kachel", "pfeile", "stattpreis", "altwert", "zusatz", "einmalig", "geraetename"] as const;
  return Object.fromEntries(elements.map((element) => {
    const parts = keys.map((key) => book.snap.nudges[key]?.[element]).filter((item) => item);
    return [element, {
      dx: parts.reduce((sum, item) => sum + (item?.dx ?? 0), 0),
      dy: parts.reduce((sum, item) => sum + (item?.dy ?? 0), 0),
      scale: parts.reduce((product, item) => product * (item?.scale ?? 1), 1),
      flip: parts.some((item) => item?.flip),
      hidden: parts.some((item) => item?.hidden),
    }];
  }));
}

function sceneFor(book: AdjustBook, format = OTELO_FORMATS[3]) {
  const fields = book.snap.fields;
  const copy = base();
  if (fields.button) copy.button = fields.button;
  if (fields.subline) copy.subline = fields.subline;
  if (fields.headline) copy.headline = fields.headline;
  if (fields.sternText) copy.sternText = fields.sternText;
  if (fields.sublineColor) copy.sublineColor = fields.sublineColor;
  if (fields.deko) copy.deko = fields.deko;
  if (fields.datenmenge) copy.datenmenge = fields.datenmenge;
  if (fields.datenmengeAlt !== undefined) copy.datenmengeAlt = fields.datenmengeAlt;
  copy.orange = book.snap.orange;
  const name = fields.vorlage === "kachel_geraet" ? "kachel_geraet" : "kachel_person";
  return buildScene(format, name, copy, shiftsFor(book, format), undefined, book.snap.follows);
}

function raster(book: AdjustBook, format = OTELO_FORMATS[3]): Buffer {
  const scene = sceneFor(book, format);
  const width = 64;
  const height = Math.round(64 * scene.height / scene.width);
  const png = new PNG({ width, height });
  png.data.fill(0);
  const fill = (box: { x: number; y: number; w: number; h: number } | undefined, rgb: [number, number, number]) => {
    if (!box || box.w < 2 || box.h < 2) return;
    const x0 = Math.max(0, Math.floor(box.x / scene.width * width));
    const y0 = Math.max(0, Math.floor(box.y / scene.height * height));
    const x1 = Math.min(width, Math.ceil((box.x + box.w) / scene.width * width));
    const y1 = Math.min(height, Math.ceil((box.y + box.h) / scene.height * height));
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const index = (y * width + x) * 4;
        png.data[index] = rgb[0];
        png.data[index + 1] = rgb[1];
        png.data[index + 2] = rgb[2];
        png.data[index + 3] = 255;
      }
    }
  };
  fill(scene.headline.box, [215, 235, 0]);
  if (scene.deko?.name === "fruehling_blaetter") fill(scene.deko.box, [20, 140, 40]);
  if (scene.deko?.name === "bw_wellen") fill({ x: scene.width * 0.72, y: scene.height * 0.72, w: scene.width * 0.2, h: scene.height * 0.2 }, [250, 90, 20]);
  const color = scene.subline.lines[0]?.color ?? "#FA5A14";
  const lime = color.toLowerCase() === "#d7eb00";
  fill(scene.subline.box, lime ? [215, 235, 0] : [250, 90, 20]);
  fill(scene.cta.box, [215, 235, 0]);
  fill(scene.stern?.box, [250, 90, 20]);
  const text = `${scene.cta.text}|${scene.stern?.text ?? ""}|${scene.kachel?.alt ?? ""}|${scene.deko?.name ?? ""}`;
  for (let index = 0; index < text.length && index < width; index += 1) {
    png.data[index * 4] = text.charCodeAt(index);
    png.data[index * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}

function changedPixels(left: AdjustBook, right: AdjustBook): number {
  return OTELO_FORMATS.reduce((sum, format) => sum + pixelDiff(raster(left, format), raster(right, format)), 0);
}

function pixelDiff(left: Buffer, right: Buffer): number {
  const a = PNG.sync.read(left);
  const b = PNG.sync.read(right);
  let changed = 0;
  const length = Math.min(a.data.length, b.data.length);
  for (let index = 0; index < length; index += 4) {
    if (a.data[index] !== b.data[index] || a.data[index + 1] !== b.data[index + 1] || a.data[index + 2] !== b.data[index + 2]) changed += 1;
  }
  return changed;
}

const sentences = [
  "CTA: Jetzt wechseln",
  "Stern weg",
  "Stern wieder rein mit NUR BIS SONNTAG",
  "Unterzeile in Lime",
  "Headline kleiner nur im 9x16",
  "Kachel etwas höher und Frau deutlich größer",
  "nimm Blätter statt Wellen",
  "Gerät statt Person: Galaxy A56, Energielabel B",
  "Altwert weg",
  "mehr Luft zwischen Headline und Kachel",
  "wie im Quadrat",
  "zurück zu Version 2",
];

test("the MCP route reads anweisung and does not invent a change", () => {
  assert.match(route, /adjustRequest\(args\)/);
  assert.match(route, /anweisung: \{ type: "string"/);
  const spoken = adjustRequest({ entwurf: "ade04f72-8a36-4cea-a9d5-35dbd5078298", anweisung: "CTA: Jetzt wechseln, Stern weg und Unterzeile in Lime" });
  assert.equal(spoken, "CTA: Jetzt wechseln, Stern weg und Unterzeile in Lime");
  const step = applyToBook(newBook(), spoken);
  assert.equal(step.book.version, 2);
  assert.equal(step.book.snap.fields.button, "Jetzt wechseln");
  assert.equal(mergedNudge(step.book.snap, "meta-1x1", "stoerer").hidden, true);
  assert.equal(step.book.snap.fields.sublineColor, "#D7EB00");
  assert.match(step.summary, /umgesetzt: Leiste ist jetzt „Jetzt wechseln“/);
  assert.match(step.summary, /umgesetzt: Störer ausgeblendet/);
  assert.match(step.summary, /umgesetzt: Subline neu gefärbt/);
  const idle = applyToBook(newBook(), adjustRequest({ entwurf: "ade04f72-8a36-4cea-a9d5-35dbd5078298" }));
  assert.equal(idle.book.version, 1);
  assert.match(idle.summary, /nicht verstanden/);
  assert.doesNotMatch(idle.summary, /geändert/);
});

test("Button-Text ändern auf Jetzt wechseln sets the CTA", () => {
  const step = applyToBook(newBook(), adjustRequest({ anweisung: 'Button-Text ändern auf "Jetzt wechseln"' }));
  assert.equal(step.book.snap.fields.button, "Jetzt wechseln");
  assert.equal(step.book.version, 2);
});

test("the twelve spoken sentences change the rendered pixels when a property changes", () => {
  let book = newBook();
  for (const sentence of sentences) {
    const before = book;
    const step = applyToBook(book, adjustRequest({ aenderung: { text: sentence } }));
    if (step.book.version === before.version) {
      book = step.book;
      continue;
    }
    assert.ok(changedPixels(before, step.book) > 0, sentence);
    book = step.book;
  }
  assert.equal(book.snap.fields.button, "Jetzt wechseln");
  assert.equal(mergedNudge(book.snap, "meta-1x1", "stoerer").hidden, false);
});

test("zurück zu Version 2 restores every field and matches the pixels", () => {
  const start = seedBook("rechts", { deko: "bw_wellen", datenmengeAlt: "50 GB", button: "Jetzt sichern", sternText: "YOUNG DEAL" });
  const version2 = applyToBook(start, "Headline kleiner nur im 9x16");
  const changed = applyToBook(version2.book, "Altwert weg, nimm Blätter statt Wellen");
  assert.equal(changed.book.snap.fields.deko, "fruehling_blaetter");
  assert.equal(changed.book.snap.fields.datenmengeAlt, "");
  const restored = applyToBook(changed.book, "zurück zu Version 2");
  assert.equal(restored.book.snap.fields.deko, "bw_wellen");
  assert.equal(restored.book.snap.fields.datenmengeAlt, "50 GB");
  assert.equal(pixelDiff(raster(version2.book), raster(restored.book)), 0);
});

test("spacing stays in the answer and a format limit stays in its clause", () => {
  const air = applyToBook(newBook(), "nimm Blätter statt Wellen und mehr Luft zwischen Headline und Kachel");
  assert.match(air.summary, /umgesetzt: Deko Blätter/);
  assert.match(air.summary, /umgesetzt: mehr Luft zwischen Headline und Kachel/);
  assert.equal(mergedNudge(air.book.snap, "meta-1x1", "kachel").dy, 6);
  const scoped = applyToBook(newBook(), "Headline kleiner nur im 9x16, Kachel etwas höher und Frau deutlich größer");
  assert.equal(mergedNudge(scoped.book.snap, "9x16", "headline").scale, 0.85);
  assert.equal(mergedNudge(scoped.book.snap, "meta-1x1", "headline").scale, 1);
  assert.equal(mergedNudge(scoped.book.snap, "meta-1x1", "kachel").dy, -3);
  assert.equal(mergedNudge(scoped.book.snap, "9x16", "kachel").dy, -3);
  assert.equal(mergedNudge(scoped.book.snap, "meta-1x1", "person").scale, 1.25);
  assert.match(scoped.summary, /alle Formate/);
});

test("the image check drops changes the user asked for", () => {
  const glance = "Die Subline ist Lime statt Orange. Der Störer fehlt. Der Altwert fehlt. Die Farbe Rot auf der Leiste ist unzulässig.";
  const kept = withoutInstructed(`${glance} Der Sterntext NUR BIS SONNTAG weicht vom Referenztext ab.`, "Unterzeile ist auf Wunsch Lime. Störer ist auf Wunsch ausgeblendet. Altwert ist auf Wunsch entfernt.");
  assert.match(kept, /Rot/);
  assert.doesNotMatch(kept, /Lime statt Orange/);
  assert.doesNotMatch(kept, /Störer fehlt/);
  assert.doesNotMatch(kept, /Altwert fehlt/);
  assert.doesNotMatch(kept, /Referenztext/);
});

test("a wide headline shrinks until two chevrons fit", () => {
  const fitted = fitHeadlineForChevrons(900, 140, 1080);
  const secondEnd = fitted.textWidth + fitted.fontSize * 0.06 + fitted.fontSize * (41.08 / 73.924) + fitted.fontSize * (58.568 / 73.924);
  assert.ok(secondEnd <= 1080);
  assert.ok(fitted.fontSize < 140);
});

test("more air keeps the tile off the CTA", () => {
  let book = newBook();
  for (let step = 0; step < 3; step += 1) book = applyToBook(book, "mehr Luft zwischen Headline und Kachel").book;
  for (const format of OTELO_FORMATS) {
    const scene = sceneFor(book, format);
    const tile = scene.kachel?.box;
    if (!tile || tile.w < 2 || scene.cta.box.w < 2) continue;
    const hits = tile.x < scene.cta.box.x + scene.cta.box.w && scene.cta.box.x < tile.x + tile.w && tile.y < scene.cta.box.y + scene.cta.box.h && scene.cta.box.y < tile.y + tile.h;
    assert.equal(hits, false, format.id);
    assert.equal(scene.hints.some((hint) => hint.includes("Kachel überlappt die CTA")), false, format.id);
  }
});

test("Gerät statt Person drops the person layout and keeps the texts", () => {
  let book = seedBook("rechts", { headline: "BLACK WEEK", subline: "3-FACH DATEN.", button: "Jetzt sichern", deko: "bw_wellen", datenmenge: "50 GB", einmalpreis: "1 €", preis: "19,99 €", preisZusatz: "pro Monat" });
  book = applyToBook(book, "mehr Luft zwischen Headline und Kachel").book;
  book = applyToBook(book, "Frau deutlich größer").book;
  const switched = applyToBook(book, "Gerät statt Person: Galaxy A56").book;
  assert.equal(switched.snap.fields.vorlage, "kachel_geraet");
  assert.equal(switched.snap.fields.motiv, "Galaxy A56");
  assert.equal(switched.snap.fields.geraetName, "Galaxy A56");
  assert.equal(switched.snap.fields.button, "Jetzt sichern");
  assert.equal(switched.snap.fields.deko, "bw_wellen");
  assert.equal(mergedNudge(switched.snap, "meta-1x1", "kachel").dy, 0);
  assert.equal(mergedNudge(switched.snap, "meta-1x1", "person").scale, 1);
  const format = OTELO_FORMATS[3];
  const copy = base();
  copy.subline = "3-FACH DATEN.";
  copy.datenmenge = "50 GB";
  copy.datenmengeAlt = "";
  copy.einmalpreis = "1 €";
  copy.geraetName = "Galaxy A56";
  const direct = buildScene(format, "kachel_geraet", copy);
  const via = buildScene(format, "kachel_geraet", copy, shiftsFor(switched, format));
  const round = (box: { x: number; y: number; w: number; h: number } | undefined) => box && [box.x, box.y, box.w, box.h].map((value) => Math.round(value));
  assert.deepEqual(round(via.product), round(direct.product));
  assert.deepEqual(round(via.cta.box), round(direct.cta.box));
  assert.equal(via.deviceLabel?.text, direct.deviceLabel?.text);
});

test("device fields can be spoken without a colon", () => {
  const step = applyToBook(newBook(), "Gerätename Galaxy A56 5G, einmalig 1 €, statt 229 €");
  assert.equal(step.book.snap.fields.geraetName, "Galaxy A56 5G");
  assert.equal(step.book.snap.fields.einmalpreis, "1 €");
  assert.equal(step.book.snap.fields.preisAlt, "229 €");
  assert.match(step.summary, /umgesetzt:/);
});

test("statt splits the one-time price, the data amount and the monthly price", () => {
  const once = applyToBook(newBook(), "einmalig 1 € statt 229 €");
  assert.equal(once.book.snap.fields.einmalpreis, "1 €");
  assert.equal(once.book.snap.fields.preisAlt, "229 €");
  const lower = applyToBook(newBook(), "einmalig 229 € statt 1 €");
  assert.equal(lower.book.snap.fields.einmalpreis, "229 €");
  assert.equal(lower.book.snap.fields.preisAlt, undefined);
  assert.match(lower.summary, /kein statt/);
  const data = applyToBook(newBook(), "150 GB statt 50 GB");
  assert.equal(data.book.snap.fields.datenmenge, "150 GB");
  assert.equal(data.book.snap.fields.datenmengeAlt, "50 GB");
  const month = applyToBook(newBook(), "Preis 19,99 € statt 29,99 €");
  assert.equal(month.book.snap.fields.preis, "19,99 €");
  assert.equal(month.book.snap.fields.preisMonatAlt, "29,99 €");
});

test("the live device sentence matches a direct device compose", () => {
  const sentence = "Gerät statt Person: Galaxy A56, Gerätename Galaxy A56 5G, Energielabel B, einmalig 1 € statt 229 €";
  let book = seedBook("rechts", {
    headline: "BLACK WEEK",
    subline: "3-FACH DATEN. GLEICHER PREIS.",
    button: "Jetzt sichern",
    sternText: "NUR BIS SONNTAG",
    datenmenge: "150 GB",
    datenmengeAlt: "50 GB",
    preis: "19,99 €",
    preisZusatz: "pro Monat",
    deko: "bw_wellen",
  });
  book = applyToBook(book, "Frau deutlich größer").book;
  const switched = applyToBook(book, sentence).book;
  assert.equal(switched.snap.fields.vorlage, "kachel_geraet");
  assert.equal(switched.snap.fields.motiv, "Galaxy A56");
  assert.equal(switched.snap.fields.geraetName, "Galaxy A56 5G");
  assert.equal(switched.snap.fields.energielabel, "B");
  assert.equal(switched.snap.fields.einmalpreis, "1 €");
  assert.equal(switched.snap.fields.preisAlt, "229 €");
  assert.equal(switched.snap.fields.sternText, "NUR BIS SONNTAG");
  assert.equal(switched.snap.fields.datenmengeAlt, "");
  assert.match(applyToBook(book, sentence).summary, /verworfen/);
  const format = OTELO_FORMATS[3];
  const copy = base();
  copy.subline = "3-FACH DATEN. GLEICHER PREIS.";
  copy.sternText = "NUR BIS SONNTAG";
  copy.datenmenge = "150 GB";
  copy.datenmengeAlt = "";
  copy.einmalpreis = "1 €";
  copy.preisAlt = "229 €";
  copy.geraetName = "Galaxy A56 5G";
  const direct = buildScene(format, "kachel_geraet", copy);
  const via = buildScene(format, "kachel_geraet", copy, shiftsFor(switched, format));
  const round = (box: { x: number; y: number; w: number; h: number } | undefined) => box && [box.x, box.y, box.w, box.h].map((value) => Math.round(value));
  assert.deepEqual(round(via.product), round(direct.product));
  assert.deepEqual(round(via.cta.box), round(direct.cta.box));
  assert.equal(via.stern?.text, "NUR BIS SONNTAG");
  assert.equal(direct.stern?.text, "NUR BIS SONNTAG");
  assert.equal(via.hints.some((hint) => hint.includes("Stern überdeckt Text")), false, via.hints.join(" | "));
  assert.equal(via.hints.some((hint) => hint.includes("Abstand zwischen Gerät")), false, via.hints.join(" | "));
});

test("two clauses become two lines and the old price can grow", () => {
  const book = seedBook("rechts", {
    vorlage: "kachel_geraet",
    sternText: "NUR BIS SONNTAG",
    einmalpreis: "1 €",
    preisAlt: "229 €",
    preis: "19,99 €",
    geraetName: "Galaxy A56 5G",
    headline: "BLACK WEEK",
    subline: "3-FACH DATEN. GLEICHER PREIS.",
    button: "Jetzt sichern",
  });
  const step = applyToBook(book, "Stern im 9x16 wie im Quadrat und statt-Preis größer");
  const lines = step.summary.split("\n").map((line) => line.trim()).filter(Boolean);
  assert.ok(lines.length >= 2, step.summary);
  assert.match(step.summary, /umgesetzt: Stern wie im Quadrat/);
  assert.match(step.summary, /umgesetzt: statt-Preis 15 % größer/);
  assert.equal(mergedNudge(step.book.snap, "meta-1x1", "stattpreis").scale, 1.15);
  const square = sceneFor(step.book, OTELO_FORMATS[0]);
  const story = sceneFor(step.book, OTELO_FORMATS[4]);
  const from = elementRelation(square, "stoerer");
  const to = elementRelation(story, "stoerer");
  assert.ok(from && to);
  assert.ok(Math.abs(from.x - to.x) < 0.08 && Math.abs(from.y - to.y) < 0.08 && Math.abs(from.w - to.w) < 0.08, `${JSON.stringify(from)} ${JSON.stringify(to)}`);
  assert.equal(story.textScale?.preisAlt, 1.15);
  const alone = applyToBook(book, "wie im Quadrat");
  assert.match(alone.question ?? alone.summary, /Welches Element/);
  assert.equal(alone.book.version, book.version);
  const turned = applyToBook(book, "180°");
  assert.equal(turned.book.snap.fields.motivWinkel, "180");
  const once = applyToBook(book, "Einmalig größer");
  assert.equal(once.book.snap.fields.einmalpreis, "1 €");
  assert.equal(mergedNudge(once.book.snap, "meta-1x1", "einmalig").scale, 1.15);
});

test("a long star stays on two lines", () => {
  assert.deepEqual(starLines("NUR BIS SONNTAG"), ["NUR BIS", "SONNTAG"]);
  assert.equal(starLines("YOUNG DEAL").length, 2);
});

test("the live Cobra sentence changes CTA, star and subline pixels", () => {
  const before = newBook();
  const step = applyToBook(before, adjustRequest({ anweisung: "CTA: Jetzt wechseln, Stern weg und Unterzeile in Lime" }));
  assert.ok(pixelDiff(raster(before), raster(step.book)) > 0);
  const scene = sceneFor(step.book);
  assert.equal(scene.cta.text, "Jetzt wechseln");
  assert.equal(scene.stern, undefined);
  assert.equal(scene.subline.lines[0]?.color, "#D7EB00");
});

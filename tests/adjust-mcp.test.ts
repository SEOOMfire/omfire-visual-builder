import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PNG } from "pngjs";
import { adjustRequest, applyToBook, mergedNudge, newBook, type AdjustBook } from "../src/modules/visual-builder/server/adjust-commands";
import { OTELO_FORMATS } from "../src/modules/visual-builder/otelo-formats";
import { buildScene, type SceneCopy } from "../src/modules/visual-builder/otelo-scene";

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
  const elements = ["headline", "subline", "stoerer", "person", "geraet", "cta", "logo", "deko", "kachel", "pfeile"] as const;
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
  return buildScene(format, name, copy, shiftsFor(book, format));
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

test("the live Cobra sentence changes CTA, star and subline pixels", () => {
  const before = newBook();
  const step = applyToBook(before, adjustRequest({ anweisung: "CTA: Jetzt wechseln, Stern weg und Unterzeile in Lime" }));
  assert.ok(pixelDiff(raster(before), raster(step.book)) > 0);
  const scene = sceneFor(step.book);
  assert.equal(scene.cta.text, "Jetzt wechseln");
  assert.equal(scene.stern, undefined);
  assert.equal(scene.subline.lines[0]?.color, "#D7EB00");
});

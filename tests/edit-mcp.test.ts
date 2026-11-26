import assert from "node:assert/strict";
import test from "node:test";
import { OTELO_FORMATS } from "../src/modules/visual-builder/otelo-formats";
import { buildScene, sceneFormatLabel, type SceneCopy } from "../src/modules/visual-builder/otelo-scene";
import { mergedNudge, seedBook, type AdjustBook } from "../src/modules/visual-builder/server/adjust-commands";
import { planCreativeEdits, problemsFromScenes, standFromScenes, type EditInspection } from "../src/modules/visual-builder/server/edit-creative";
import type { Cutout } from "../src/modules/visual-builder/server/cutout";

const phone: Cutout = { imageW: 2400, imageH: 1600, opaque: { x: 904, y: 80, w: 595, h: 1440 }, head: { x: 1023, y: 80, w: 357, h: 316 } };

function scenesFor(book: AdjustBook, name: "kachel_person" | "kachel_geraet") {
  const fields = book.snap.fields;
  const copy: SceneCopy = {
    headline: fields.headline || "BLACK WEEK",
    subline: fields.subline || "",
    button: fields.button || "Jetzt sichern",
    stoererTyp: "stern",
    preis: fields.preis || "19,99 €",
    preisZusatz: fields.preisZusatz || "pro Monat",
    einmalpreis: fields.einmalpreis || "",
    aktionText: "",
    pflichttext: "",
    headlineVariante: "direkt",
    orange: book.snap.orange,
    produktname: "",
    datenmenge: fields.datenmenge || "50 GB",
    datenmengeAlt: fields.datenmengeAlt || "",
    sternText: fields.sternText || "",
    deko: fields.deko || "bw_wellen",
    geraetName: fields.geraetName || "",
    preisAlt: fields.preisAlt || "",
  };
  const elements = ["headline", "subline", "stoerer", "person", "geraet", "cta", "logo", "deko", "kachel", "pfeile"] as const;
  return Object.fromEntries(OTELO_FORMATS.map((format) => {
    const shifts = Object.fromEntries(elements.map((element) => [element, mergedNudge(book.snap, format.id, element)]));
    return [format.id, buildScene(format, name, copy, shifts, undefined, book.snap.follows, name === "kachel_geraet" ? phone : undefined)];
  }));
}

function inspect(book: AdjustBook, name: "kachel_person" | "kachel_geraet"): EditInspection {
  const scenes = scenesFor(book, name);
  return {
    problems: problemsFromScenes(scenes),
    stand: standFromScenes(scenes, book.snap, book.version, { vorlage: name }),
    heights: Object.fromEntries(OTELO_FORMATS.map((format) => {
      const scene = scenes[format.id];
      return [sceneFormatLabel(format), scene?.productPaint?.opaque.h ?? scene?.product?.h ?? 0];
    })),
  };
}

test("the MCP plan restores version 5 before the star move and the subline color", async () => {
  const sommer = seedBook("rechts", {
    vorlage: "kachel_person",
    headline: "SOMMER-DEAL",
    subline: "JETZT ZUSCHLAGEN",
    sternText: "1. MONAT GRATIS",
    datenmenge: "50 GB",
    deko: "fruehling_blaetter",
  });
  const current = structuredClone(sommer);
  current.snap = structuredClone(sommer.snap);
  current.snap.nudges["meta-9x16"] = { stoerer: { dx: -10, dy: 0, scale: 1, flip: false, hidden: false } };
  current.snap.nudges["tiktok-9x16"] = { stoerer: { dx: -10, dy: 0, scale: 1, flip: false, hidden: false } };
  current.version = 6;
  current.history = [
    { n: 5, summary: "Sommer", snap: structuredClone(sommer.snap) },
    { n: 6, summary: "verschoben", snap: structuredClone(current.snap) },
  ];
  const restored = await planCreativeEdits(current, [{ ziel: "version", aktion: "version_laden", wert: 5 }], (book) => inspect(book, "kachel_person"));
  assert.equal(restored.book.snap.nudges["meta-9x16"]?.stoerer?.dx ?? 0, 0);
  assert.ok(Math.abs((inspect(restored.book, "kachel_person").stand.layout["1080x1920 Meta"]?.stern.x ?? 0) - 47.3) < 0.25);
  const planned = await planCreativeEdits(current, [
    { ziel: "version", aktion: "version_laden", wert: 5 },
    { ziel: "stern", aktion: "verschieben", wert: { links: 5 }, formate: ["1080x1920 Meta", "1080x1920 Tiktok"] },
    { ziel: "unterzeile", aktion: "farbe", wert: "lime", formate: ["1080x1920 Meta", "1080x1920 Tiktok"] },
  ], (book) => inspect(book, "kachel_person"));
  const nine = ["1080x1920 Meta", "1080x1920 Tiktok"];
  const fresh = planned.book;
  const hits = inspect(fresh, "kachel_person").problems.filter((problem) => nine.includes(problem.format) && /überdeckt Datenmenge/.test(problem.text));
  const baseHits = inspect(restored.book, "kachel_person").problems.filter((problem) => nine.includes(problem.format) && /überdeckt Datenmenge/.test(problem.text));
  assert.ok(hits.length <= baseHits.length);
  assert.ok(planned.lines.some((line) => /unterzeile/i.test(line) && /umgesetzt|lime/i.test(line)), planned.lines.join(" | "));
  assert.equal(fresh.snap.nudges["meta-9x16"]?.subline?.color, "#D7EB00");
  assert.ok(planned.lines.every((line) => !/lässt sich dort nicht verschieben/.test(line)));
  const moved = Math.abs((inspect(fresh, "kachel_person").stand.layout["1080x1920 Meta"]?.stern.x ?? 0) - 47.3);
  if (planned.lines.some((line) => /nicht möglich \(würde Datenmenge/.test(line))) assert.ok(moved < 0.25);
  else assert.ok(moved <= 5.25);
});

test("the MCP plan refuses a smaller device without a new version", async () => {
  const device = seedBook("rechts", {
    vorlage: "kachel_geraet",
    einmalpreis: "1 €",
    preisAlt: "229 €",
    datenmenge: "50 GB",
    sternText: "50 GB",
    geraetName: "Samsung Galaxy A57 5G",
  });
  const before = JSON.stringify(device.snap);
  const planned = await planCreativeEdits(device, [
    { ziel: "geraet", aktion: "kleiner", wert: 15, formate: ["1080x1920 Meta", "1080x1920 Tiktok"] },
  ], (book) => inspect(book, "kachel_geraet"));
  assert.match(planned.lines.join("\n"), /nicht möglich \(Gerät hat Mindesthöhe erreicht\)/);
  assert.equal(planned.book.version, device.version);
  assert.equal(JSON.stringify(planned.book.snap), before);
  assert.ok(planned.lines.every((line) => !/Rand rechts/.test(line)));
});

test("a device asked at 110 percent that only grows one percent is refused", async () => {
  const device = seedBook("rechts", {
    vorlage: "kachel_geraet",
    einmalpreis: "1 €",
    preisAlt: "229 €",
    datenmenge: "50 GB",
    sternText: "50 GB",
    geraetName: "Samsung Galaxy A57 5G",
  });
  const before = JSON.stringify(device.snap);
  const planned = await planCreativeEdits(device, [
    { ziel: "motiv", aktion: "setzen", wert: { groesse: 110 }, formate: ["1200x1200", "1080x1080"] },
  ], (book) => inspect(book, "kachel_geraet"));
  assert.match(planned.lines.join("\n"), /nicht möglich \(Rand rechts\)/);
  assert.equal(planned.lines.some((line) => /teilweise/.test(line)), false);
  assert.equal(planned.book.version, device.version);
  assert.equal(JSON.stringify(planned.book.snap), before);
});

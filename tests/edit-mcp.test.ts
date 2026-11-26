import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { OTELO_FORMATS } from "../src/modules/visual-builder/otelo-formats";
import { buildScene, sceneFormatLabel, type SceneCopy } from "../src/modules/visual-builder/otelo-scene";
import { mergedNudge, seedBook, type AdjustBook } from "../src/modules/visual-builder/server/adjust-commands";
import { measureCutout } from "../src/modules/visual-builder/server/cutout";
import { planCreativeEdits, problemsFromScenes, standFromScenes, type EditInspection } from "../src/modules/visual-builder/server/edit-creative";
import type { Cutout } from "../src/modules/visual-builder/server/cutout";

const stage = process.env.OTELO_ASSET_STAGE || "/Users/marc/Documents/otelo-asset-stage";
const sommerCutout = measureCutout(readFileSync(`${stage}/Brand Basics/Images_graphics/Models/Frau_mit_Kopfhoerern_shutterstock_2316194479_rgb_03.png`));

const phone: Cutout = { imageW: 2400, imageH: 1600, opaque: { x: 904, y: 80, w: 595, h: 1440 }, head: { x: 1023, y: 80, w: 357, h: 316 } };

function scenesFor(book: AdjustBook, name: "kachel_person" | "kachel_geraet", person?: Cutout | null) {
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
    return [format.id, buildScene(format, name, copy, shifts, name === "kachel_person" ? person ?? undefined : undefined, book.snap.follows, name === "kachel_geraet" ? phone : undefined)];
  }));
}

function inspect(book: AdjustBook, name: "kachel_person" | "kachel_geraet", person?: Cutout | null): EditInspection {
  const scenes = scenesFor(book, name, person);
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
  assert.ok(sommerCutout, "Sommer-Motiv fehlt");
  const look = (book: AdjustBook) => inspect(book, "kachel_person", sommerCutout);
  const restored = await planCreativeEdits(current, [{ ziel: "version", aktion: "version_laden", wert: 5 }], look);
  assert.equal(restored.book.snap.nudges["meta-9x16"]?.stoerer?.dx ?? 0, 0);
  assert.ok(Math.abs((look(restored.book).stand.layout["1080x1920 Meta"]?.stern.x ?? 0) - 47.3) < 0.25);
  assert.equal(look(restored.book).problems.some((problem) => /überdeckt Datenmenge/.test(problem.text)), false);
  const call = [
    { ziel: "version" as const, aktion: "version_laden" as const, wert: 5 },
    { ziel: "stern" as const, aktion: "verschieben" as const, wert: { links: 5 }, formate: ["1080x1920 Meta", "1080x1920 Tiktok"] },
    { ziel: "unterzeile" as const, aktion: "farbe" as const, wert: "lime", formate: ["1080x1920 Meta", "1080x1920 Tiktok"] },
  ];
  const planned = await planCreativeEdits(current, call, look);
  assert.match(planned.lines[0] ?? "", /^umgesetzt: Version 5/);
  assert.ok(planned.lines.findIndex((line) => /Version 5/.test(line)) < planned.lines.findIndex((line) => /Stern/.test(line)));
  assert.ok(planned.lines.findIndex((line) => /Stern/.test(line)) < planned.lines.findIndex((line) => /Unterzeile/.test(line)));
  assert.equal(planned.hints.length, 0);
  const starLine = planned.lines.find((line) => /Stern/.test(line)) ?? "";
  const nudge = mergedNudge(planned.book.snap, "meta-9x16", "stoerer");
  const x = look(planned.book).stand.layout["1080x1920 Meta"]?.stern.x ?? 0;
  const covered = look(planned.book).problems.some((problem) => /1080x1920/.test(problem.format) && /überdeckt Datenmenge/.test(problem.text));
  assert.equal(covered, false);
  const step = starLine.match(/(\d+) % nach (links|rechts|oben|unten)/);
  if (/nicht möglich: Stern/.test(starLine)) {
    assert.ok(Math.abs(x - 47.3) < 0.25);
    assert.equal(nudge.dx, 0);
    assert.equal(nudge.dy, 0);
  } else if (step) {
    const amount = Number(step[1]);
    const axis = step[2] === "links" ? -nudge.dx : step[2] === "rechts" ? nudge.dx : step[2] === "unten" ? nudge.dy : -nudge.dy;
    assert.equal(axis, amount);
    assert.ok(Math.abs((step[2] === "links" || step[2] === "rechts" ? x : look(planned.book).stand.layout["1080x1920 Meta"]?.stern.y ?? 0) - 47.3) <= amount + 0.25 || step[2] === "oben" || step[2] === "unten");
  } else assert.fail(starLine);
  assert.match(planned.lines.find((line) => /Unterzeile/.test(line)) ?? "", /umgesetzt/);
  assert.ok(planned.debug.some((item) => item.ziel === "stern" && item.schritte.length >= 1));
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
  assert.match(planned.lines.join("\n"), /nicht möglich: Gerät 15 % kleiner \(Mindesthöhe erreicht\)/);
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
  assert.match(planned.lines.join("\n"), /nicht möglich: Gerät 110 % \(Rand rechts\)/);
  assert.equal(planned.lines.some((line) => /teilweise/.test(line)), false);
  assert.equal(planned.book.version, device.version);
  assert.equal(JSON.stringify(planned.book.snap), before);
});

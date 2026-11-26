import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { OTELO_FORMATS } from "../src/modules/visual-builder/otelo-formats";
import { buildScene, sceneFormatLabel, type SceneCopy } from "../src/modules/visual-builder/otelo-scene";
import { mergedNudge, seedBook, type AdjustBook } from "../src/modules/visual-builder/server/adjust-commands";
import { measureCutout } from "../src/modules/visual-builder/server/cutout";
import { coveredText, planCreativeEdits, problemsFromScenes, rememberMeasured, standFromScenes, type EditInspection } from "../src/modules/visual-builder/server/edit-creative";
import type { Cutout } from "../src/modules/visual-builder/server/cutout";

const stage = process.env.OTELO_ASSET_STAGE || "/Users/marc/Documents/otelo-asset-stage";
const retroCutout = measureCutout(readFileSync(`${stage}/Brand Basics/Images_graphics/Models/Frau_mit_Retro-Pulli_AdobeStock_1324867715_rgb_04.png`));

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
  assert.ok(retroCutout, "Retro-Pulli fehlt");
  const look = (book: AdjustBook) => inspect(book, "kachel_person", retroCutout);
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
  const nine = ["1080x1920 Meta", "1080x1920 Tiktok"];
  const covered = coveredText(look(planned.book).stand, nine).some((hit) => /Datenmenge/.test(hit));
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

test("Retro-Pulli at x 41.3 cannot move another percent left onto the data amount", async () => {
  assert.ok(retroCutout, "Retro-Pulli fehlt");
  const book = seedBook("rechts", { vorlage: "kachel_person", headline: "SOMMER-DEAL", subline: "JETZT ZUSCHLAGEN", sternText: "1. MONAT GRATIS", datenmenge: "50 GB", deko: "fruehling_blaetter" });
  book.snap.nudges["meta-9x16"] = { stoerer: { dx: -6, dy: 0, scale: 1, flip: false, hidden: false } };
  book.snap.nudges["tiktok-9x16"] = { stoerer: { dx: -6, dy: 0, scale: 1, flip: false, hidden: false } };
  const look = (current: AdjustBook) => inspect(current, "kachel_person", retroCutout);
  assert.ok(Math.abs((look(book).stand.layout["1080x1920 Meta"]?.stern.x ?? 0) - 41.3) < 0.25);
  const planned = await planCreativeEdits(book, [
    { ziel: "stern", aktion: "verschieben", wert: { links: 1 }, formate: ["1080x1920 Meta", "1080x1920 Tiktok"] },
  ], look);
  assert.match(planned.lines.join("\n"), /nicht möglich: Stern \(würde Datenmenge verdecken\)/);
  assert.equal(mergedNudge(planned.book.snap, "meta-9x16", "stoerer").dx, -6);
  assert.ok(Math.abs((look(planned.book).stand.layout["1080x1920 Meta"]?.stern.x ?? 0) - 41.3) < 0.25);
  const trace = planned.debug.find((item) => item.ziel === "stern");
  const ausgang = trace?.ausgang as Record<string, { dx: number; dy: number }> | undefined;
  const gespeichert = trace?.gespeichert as Record<string, { dx: number; dy: number }> | undefined;
  assert.deepEqual(ausgang?.["meta-9x16"], { dx: -6, dy: 0 });
  assert.deepEqual(gespeichert?.["meta-9x16"], { dx: -6, dy: 0 });
});

test("Retro-Pulli at x 47.3 finds a left move that does not cover the data amount", async () => {
  assert.ok(retroCutout, "Retro-Pulli fehlt");
  const book = seedBook("rechts", { vorlage: "kachel_person", headline: "SOMMER-DEAL", subline: "JETZT ZUSCHLAGEN", sternText: "1. MONAT GRATIS", datenmenge: "50 GB", deko: "fruehling_blaetter" });
  const look = (current: AdjustBook) => inspect(current, "kachel_person", retroCutout);
  assert.ok(Math.abs((look(book).stand.layout["1080x1920 Meta"]?.stern.x ?? 0) - 47.3) < 0.25);
  const planned = await planCreativeEdits(book, [
    { ziel: "stern", aktion: "verschieben", wert: { links: 5 }, formate: ["1080x1920 Meta", "1080x1920 Tiktok"] },
  ], look);
  const nine = ["1080x1920 Meta", "1080x1920 Tiktok"];
  assert.equal(coveredText(look(planned.book).stand, nine).length, 0);
  const line = planned.lines.find((item) => /Stern/.test(item)) ?? "";
  const step = line.match(/(\d+) % nach (links|rechts|oben|unten)/);
  assert.ok(step, line);
  const nudge = mergedNudge(planned.book.snap, "meta-9x16", "stoerer");
  const axis = step?.[2] === "links" ? -nudge.dx : step?.[2] === "rechts" ? nudge.dx : step?.[2] === "unten" ? nudge.dy : -nudge.dy;
  assert.equal(axis, Number(step?.[1]));
});

test("a missing version names the stored ones and does not drop them", async () => {
  const book = seedBook("rechts", { vorlage: "kachel_person", headline: "SOMMER-DEAL", subline: "JETZT ZUSCHLAGEN" });
  book.version = 8;
  book.history = [6, 7, 8].map((n) => ({ n, summary: String(n), snap: structuredClone(book.snap) }));
  book.history[0].snap.nudges["meta-9x16"] = { stoerer: { dx: -1, dy: 0, scale: 1, flip: false, hidden: false } };
  const frozen = JSON.stringify(book.history[0].snap);
  const planned = await planCreativeEdits(book, [
    { ziel: "version", aktion: "version_laden", wert: 5 },
    { ziel: "unterzeile", aktion: "farbe", wert: "lime", formate: ["1080x1920 Meta", "1080x1920 Tiktok"] },
  ], (current) => inspect(current, "kachel_person", retroCutout));
  assert.match(planned.lines[0] ?? "", /^nicht möglich: Version 5 nicht vorhanden \(vorhanden: 6, 7, 8\)$/);
  assert.match(planned.lines[1] ?? "", /^umgesetzt: Unterzeile ist lime/);
  assert.ok(planned.book.history.some((entry) => entry.n === 6));
  assert.ok(planned.book.history.some((entry) => entry.n === 7));
  assert.ok(planned.book.history.some((entry) => entry.n === 8));
  assert.equal(JSON.stringify(planned.book.history.find((entry) => entry.n === 6)?.snap), frozen);
});

test("a color that is already set is unchanged and a device snapshot keeps the measured size", () => {
  const colored = seedBook("rechts", { vorlage: "kachel_person", sublineColor: "#D7EB00" });
  colored.snap.nudges["meta-9x16"] = { subline: { dx: 0, dy: 0, scale: 1, flip: false, hidden: false, color: "#D7EB00" } };
  colored.snap.nudges["tiktok-9x16"] = { subline: { dx: 0, dy: 0, scale: 1, flip: false, hidden: false, color: "#D7EB00" } };
  const before = JSON.stringify(colored.snap);
  return planCreativeEdits(colored, [
    { ziel: "unterzeile", aktion: "farbe", wert: "lime", formate: ["1080x1920 Meta", "1080x1920 Tiktok"] },
  ], (current) => inspect(current, "kachel_person")).then((planned) => {
    assert.match(planned.lines[0] ?? "", /^unverändert: Unterzeile ist schon lime \(1080x1920 Meta, 1080x1920 Tiktok\)$/);
    assert.equal(JSON.stringify(planned.book.snap), before);
    const device = seedBook("rechts", { vorlage: "kachel_geraet", einmalpreis: "1 €", geraetName: "Samsung Galaxy A57 5G", sternText: "50 GB", datenmenge: "50 GB" });
    device.snap.nudges["meta-1x1"] = { geraet: { dx: 0, dy: 0, scale: 1.1, flip: false, hidden: false } };
    const stand = inspect(device, "kachel_geraet").stand;
    const size = stand.layout["1080x1080"]?.geraet?.groesse ?? 0;
    assert.ok(Math.abs(size - 101.2) < 0.2, String(size));
    assert.notEqual(size, 110);
    rememberMeasured(device.snap, stand);
    assert.equal(device.snap.gemessen?.["meta-1x1"]?.geraet, size);
    device.snap.nudges["meta-9x16"] = { geraet: { dx: 0, dy: 0, scale: 0.85, flip: false, hidden: false } };
    const tall = inspect(device, "kachel_geraet").stand.layout["1080x1920 Meta"]?.geraet?.groesse ?? 0;
    assert.ok(Math.abs(tall - 100) < 0.2, String(tall));
    const saved = size;
    device.snap.gemessen = { "meta-1x1": { geraet: saved } };
    assert.equal(inspect(device, "kachel_geraet").stand.layout["1080x1080"]?.geraet?.groesse, saved);
  });
});

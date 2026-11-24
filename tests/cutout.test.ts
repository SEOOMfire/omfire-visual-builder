import assert from "node:assert/strict";
import test from "node:test";
import { PNG } from "pngjs";
import { OTELO_FORMATS } from "../src/modules/visual-builder/otelo-formats";
import { buildScene, type SceneCopy } from "../src/modules/visual-builder/otelo-scene";
import { headInside, measureCutout, placeCutout, type Cutout } from "../src/modules/visual-builder/server/cutout";

function portraitWithFace(): Buffer {
  const png = new PNG({ width: 80, height: 140 });
  png.data.fill(0);
  for (let y = 10; y < 130; y += 1) {
    for (let x = 15; x < 65; x += 1) {
      const index = (y * 80 + x) * 4;
      png.data[index] = 230;
      png.data[index + 1] = 120;
      png.data[index + 2] = 40;
      png.data[index + 3] = 255;
    }
  }
  for (let y = 18; y < 42; y += 1) {
    for (let x = 28; x < 52; x += 1) {
      const index = (y * 80 + x) * 4;
      png.data[index] = 210;
      png.data[index + 1] = 160;
      png.data[index + 2] = 130;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

const copy = (): SceneCopy => ({
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

test("transparent margins are ignored and the head stays in the frame", () => {
  const cutout = measureCutout(portraitWithFace());
  assert.ok(cutout);
  assert.ok(cutout.opaque.y > 0, "the clear margin is trimmed");
  assert.ok(cutout.head.y >= cutout.opaque.y);
  assert.ok(cutout.head.h < cutout.opaque.h * 0.6);
  for (const format of OTELO_FORMATS) {
    const scene = buildScene(format, "kachel_person", copy(), {}, cutout);
    assert.ok(scene.headBox, format.id);
    assert.equal(scene.hints.some((hint) => hint.startsWith("Der Kopf ist nicht")), false, `${format.id} ${scene.hints.join(" | ")}`);
    assert.equal(scene.hints.some((hint) => /Figur überlappt Headline|Figur überlappt Subline|Figur überlappt Kachel/.test(hint)), false, scene.hints.join(" | "));
    const top = (scene.figure?.y ?? 0) / format.h;
    const wide = format.w / format.h > 1.5;
    const tall = format.id.endsWith("9x16");
    const band = wide ? [0.1, 0.2] : tall ? [0.35, 0.5] : [0.3, 0.4];
    assert.ok(top >= band[0] - 0.02 && top <= band[1] + 0.02, `${format.id} ${top.toFixed(2)}`);
    const bottom = ((scene.figure?.y ?? 0) + (scene.figure?.h ?? 0)) / format.h;
    if (tall) assert.ok(Math.abs(bottom - 1) <= 0.005, `${format.id} bottom ${bottom.toFixed(3)}`);
    else assert.ok(bottom > 1, format.id);
    assert.ok(headInside(scene.headBox, format.w, format.h), format.id);
    assert.equal(scene.hints.some((hint) => hint.includes("zu kurz")), false, scene.hints.join(" | "));
    assert.equal(scene.hints.some((hint) => hint.includes("Stern überdeckt")), false, scene.hints.join(" | "));
    assert.equal(scene.hints.some((hint) => hint.includes("Wellen überlagern")), false, scene.hints.join(" | "));
    if (scene.stern && scene.kachel) {
      const centerX = scene.stern.box.x + scene.stern.box.w / 2;
      const centerY = scene.stern.box.y + scene.stern.box.h / 2;
      const tile = scene.kachel.box;
      const inside = centerX > tile.x && centerX < tile.x + tile.w && centerY > tile.y && centerY < tile.y + tile.h;
      assert.equal(inside, false, format.id);
    }
    if (wide) {
      assert.ok(Math.abs(scene.headline.box.w / format.w - 0.55) < 0.02, format.id);
      assert.ok(scene.kachel && Math.abs(scene.kachel.box.w / format.w - 0.22) < 0.02, format.id);
    }
  }
});

test("a short motif fails the 9x16 length rule", () => {
  const cutout: Cutout = {
    imageW: 800,
    imageH: 300,
    opaque: { x: 0, y: 0, w: 800, h: 220 },
    head: { x: 80, y: 0, w: 640, h: 90 },
  };
  const story = OTELO_FORMATS.find((format) => format.id === "meta-9x16");
  assert.ok(story);
  const scene = buildScene(story, "kachel_person", copy(), {}, cutout);
  assert.ok(scene.hints.some((hint) => hint.includes("nicht bestanden: Motiv für 9x16 zu kurz")), scene.hints.join(" | "));
});

test("placing a cutout keeps the hairline in the measured band", () => {
  const cutout: Cutout = {
    imageW: 1000,
    imageH: 1600,
    opaque: { x: 80, y: 40, w: 840, h: 1500 },
    head: { x: 300, y: 40, w: 360, h: 280 },
  };
  const placed = placeCutout({ canvasW: 1080, canvasH: 1080, cutout, left: 560, topFraction: 0.35 });
  assert.ok(Math.abs(placed.figure.y / 1080 - 0.35) < 0.01);
  assert.ok(placed.figure.y + placed.figure.h > 1080);
  assert.ok(placed.figure.x >= 560);
  assert.ok(headInside(placed.head, 1080, 1080));
});

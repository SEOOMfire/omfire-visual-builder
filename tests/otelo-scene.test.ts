import assert from "node:assert/strict";
import test from "node:test";
import { applyToBook, mergedNudge, newBook } from "../src/modules/visual-builder/server/adjust-commands";
import { OTELO_FORMATS } from "../src/modules/visual-builder/otelo-formats";
import { buildScene, DEFAULT_PFLICHTTEXT, priceNeedsLegal, splitOrange, type SceneCopy } from "../src/modules/visual-builder/otelo-scene";

const copy = (over: Partial<SceneCopy> = {}): SceneCopy => ({
  headline: "Unlimited on demand",
  subline: "100 GB monatlich\ninkl. unendlich oft 1 GB abrufen",
  button: "Jetzt sichern auf **otelo.de**",
  stoererTyp: "tarif",
  preis: "29,99 €",
  preisZusatz: "monatlich¹",
  einmalpreis: "",
  aktionText: "",
  pflichttext: DEFAULT_PFLICHTTEXT,
  headlineVariante: "direkt",
  orange: "rechts",
  produktname: "SAMSUNG Galaxy A56 5G",
  ...over,
});

test("the split is one rising edge and orange stays near one third", () => {
  for (const format of OTELO_FORMATS) {
    for (const side of ["links", "rechts"] as const) {
      const split = splitOrange(format.w, format.h, format.h > format.w ? 16 : 32, side);
      assert.ok(split.polygon.length >= 3, format.id);
      assert.ok(split.ratio >= 0.28 && split.ratio <= 0.5, `${format.id} ${side} ${split.ratio.toFixed(3)}`);
      let span = 0;
      let leftY = 0;
      let rightY = 0;
      split.polygon.forEach((start, index) => {
        const end = split.polygon[(index + 1) % split.polygon.length];
        const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
        const axis = Math.abs(start[0] - end[0]) < 3 || Math.abs(start[1] - end[1]) < 3;
        if (axis || length <= span) return;
        span = length;
        const left = start[0] <= end[0] ? start : end;
        const right = start[0] <= end[0] ? end : start;
        leftY = left[1];
        rightY = right[1];
      });
      assert.ok(leftY > rightY, `${format.id} ${side} fällt statt zu steigen`);
      assert.ok(split.angle >= 11 && split.angle <= 45);
    }
  }
});

test("tarif keeps the figure on the bottom edge and the text off the figure", () => {
  for (const format of OTELO_FORMATS) {
    const scene = buildScene(format, "tarif", copy());
    assert.deepEqual(scene.hints, [], scene.hints.join(" | "));
    assert.ok(scene.figure && scene.figure.y + scene.figure.h >= format.h - 1);
    assert.ok(scene.orangeRatio <= 0.5 && scene.orangeRatio >= 0.28);
    assert.ok(scene.stoerer.box.h >= scene.headline.box.h * 0.7);
  }
});

test("the live draft stays inside the rules before and after the spoken change", () => {
  const sentence = "Störer deutlich größer und etwas tiefer, Frau spiegeln und auf die andere Seite";
  const step = applyToBook(newBook("rechts"), sentence);
  const elements = ["headline", "subline", "stoerer", "person", "geraet", "cta", "logo", "pflichttext", "energielabel", "schraege"] as const;
  for (const format of OTELO_FORMATS) {
    const first = buildScene(format, "tarif", copy());
    assert.deepEqual(first.hints, [], `${format.id} V1 ${first.hints.join(" | ")}`);
    assert.ok(first.orangeRatio <= 0.5 && first.orangeRatio >= 0.28, format.id);
    const shifts = Object.fromEntries(elements.map((element) => [element, mergedNudge(step.book.snap, format.id, element)]));
    const second = buildScene(format, "tarif", copy({ orange: "links" }), shifts);
    assert.equal(second.figureFlip, true);
    assert.equal(second.orangeSide, "links");
    assert.ok(second.figure && second.figure.x < format.w * 0.05, format.id);
    assert.equal(second.orange[0][1], 0);
    assert.ok(second.orangeRatio <= 0.5);
    if (format.h / format.w > 1.4 && second.figure) {
      assert.ok(second.stoerer.box.y + second.stoerer.box.h <= second.figure.y + 1, format.id);
      assert.ok(second.cta.box.y + second.cta.box.h <= second.figure.y + 1, format.id);
    }
  }
});

test("a kachel keeps the logo on the left and the TikTok zone clear", () => {
  const base = {
    headline: "BLACK WEEK",
    subline: "3-FACH DATEN. GLEICHER PREIS.",
    button: "Jetzt sichern",
    stoererTyp: "stern" as const,
    preis: "19,99 €",
    preisZusatz: "pro Monat",
    einmalpreis: "",
    aktionText: "",
    pflichttext: "",
    headlineVariante: "direkt" as const,
    orange: "links" as const,
    produktname: "",
    datenmenge: "150 GB",
    datenmengeAlt: "50 GB",
    sternText: "YOUNG DEAL",
    deko: "bw_wellen" as const,
    kampagne: "BW",
  };
  for (const format of OTELO_FORMATS) {
    const scene = buildScene(format, "kachel_person", base);
    assert.equal(scene.style, "kachel");
    assert.ok(scene.logo.box.w === 0 || scene.logo.box.x < format.w * 0.2);
    assert.ok(scene.figure && scene.figure.x < format.w * 0.15);
    if (format.id === "tiktok-9x16") {
      for (const item of [scene.headline.box, scene.subline.box, scene.kachel?.box, scene.cta.box]) {
        if (!item || item.w < 2) continue;
        assert.ok(item.x + item.w <= format.w * 0.85 + 1, scene.hints.join(" | "));
        assert.ok(item.y + item.h <= format.h * 0.8 + 1, scene.hints.join(" | "));
      }
    }
  }
});

test("a footnoted price without the legal line cannot be saved", () => {
  assert.equal(priceNeedsLegal(copy({ pflichttext: "" })), true);
  assert.equal(priceNeedsLegal(copy()), false);
});

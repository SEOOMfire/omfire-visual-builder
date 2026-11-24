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
      assert.ok(split.ratio >= 0.28 && split.ratio <= 0.4, `${format.id} ${side} ${split.ratio.toFixed(3)}`);
      assert.ok(split.ratio <= 0.5);
      const [left, right] = split.polygon;
      assert.ok(left[1] > right[1], `${format.id} fällt statt zu steigen`);
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
    assert.deepEqual(second.hints, [], `${format.id} V2 ${second.hints.join(" | ")}`);
    assert.equal(second.figureFlip, true);
    assert.equal(second.orangeSide, "links");
    assert.ok(second.orangeRatio <= 0.5);
    if (format.h / format.w > 1.4 && second.figure) {
      assert.ok(second.stoerer.box.y + second.stoerer.box.h <= second.figure.y + 1, format.id);
      assert.ok(second.cta.box.y + second.cta.box.h <= second.figure.y + 1, format.id);
    }
  }
});

test("a footnoted price without the legal line cannot be saved", () => {
  assert.equal(priceNeedsLegal(copy({ pflichttext: "" })), true);
  assert.equal(priceNeedsLegal(copy()), false);
});

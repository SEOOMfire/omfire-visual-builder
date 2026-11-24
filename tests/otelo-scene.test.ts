import assert from "node:assert/strict";
import test from "node:test";
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
      const ok = (split.ratio >= 0.28 && split.ratio <= 0.4) || (split.ratio >= 0.45 && split.ratio <= 0.55);
      assert.ok(ok, `${format.id} ${side} ${split.ratio.toFixed(3)}`);
      const portrait = format.h > format.w;
      assert.ok(split.angle >= (portrait ? 11 : 25) && split.angle <= 45);
    }
  }
});

test("tarif keeps the figure on the bottom edge and the text off the figure", () => {
  for (const format of OTELO_FORMATS) {
    const scene = buildScene(format, "tarif", copy());
    assert.equal(scene.hints.filter((hint) => /überlappt|unteren Rand|Orange-Anteil|Schrägteilung|CTA-Leiste|Fußnote/.test(hint)).join(" | "), "");
    assert.ok(scene.figure && scene.figure.y + scene.figure.h >= format.h - 1);
  }
});

test("a footnoted price without the legal line cannot be saved", () => {
  assert.equal(priceNeedsLegal(copy({ pflichttext: "" })), true);
  assert.equal(priceNeedsLegal(copy()), false);
});

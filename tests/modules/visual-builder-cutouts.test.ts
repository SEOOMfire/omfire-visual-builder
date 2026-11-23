import assert from "node:assert/strict";
import test from "node:test";
import { isCutoutPixels } from "../../src/modules/visual-builder/cutout";
import { copyOnly, findForbidden, forbiddenTerms, structuredCopy } from "../../src/modules/visual-builder/guideline-rules";
import { DEFAULT_FIGURE, figureRect, normalizeFigure } from "../../src/modules/visual-builder/layout";

function pixels(width: number, height: number, alpha: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) data[(y * width + x) * 4 + 3] = alpha(x, y);
  return data;
}

test("a figure on a transparent surrounding is a cut-out, an opaque or rounded image is not", () => {
  const person = pixels(40, 80, (x, y) => (x > 10 && x < 30 && y > 8 ? 255 : 0));
  assert.equal(isCutoutPixels(person, 40, 80), true);
  assert.equal(isCutoutPixels(pixels(40, 40, () => 255), 40, 40), false);
  const rounded = pixels(100, 100, (x, y) => ((x < 3 || x > 96) && (y < 3 || y > 96) ? 0 : 255));
  assert.equal(isCutoutPixels(rounded, 100, 100), false);
});

test("a figure keeps its relative place, so it sits alike in every format", () => {
  const box = { x_pct: 70, bottom_pct: 100, h_pct: 80, flip: false };
  const square = figureRect(box, 0.5, 1080, 1080);
  assert.deepEqual(square, { x: 756 - 216, y: 216, w: 432, h: 864 });
  const story = figureRect(box, 0.5, 1080, 1920);
  assert.equal(story.y + story.h, 1920);
  assert.equal(story.x + story.w / 2, 756);
  assert.deepEqual(normalizeFigure({ x_pct: 999, h_pct: "x" }), { ...DEFAULT_FIGURE, x_pct: 150, rotate: 0 });
});

test("the checked copy names role and formats once per distinct text", () => {
  const copy = structuredCopy([
    { role: "headline", format: "1:1", text: "UNLIMITED ON DEMAND" },
    { role: "button", format: "1:1", text: "Jetzt sichern" },
    { role: "headline", format: "1:1.91", text: "UNLIMITED ON DEMAND" },
    { role: "subline", format: "1:1", text: "" },
  ]);
  assert.equal(copy, "Headline [1:1, 1:1.91]:\nUNLIMITED ON DEMAND\n\nButton [1:1]:\nJetzt sichern");
  assert.equal(copyOnly(copy).trim(), "UNLIMITED ON DEMAND\n\nJetzt sichern");
});

test("listed forbidden words are found as whole words, independent of the language model", () => {
  const guideline = "Yes Words\n\nVorteil, entdecken\n\nNo Words\n\nRabatt, Mega Sale, Don’t miss out, Deal\n\nBeispiele";
  const terms = forbiddenTerms(guideline);
  assert.deepEqual(terms, ["Rabatt", "Mega Sale", "Don’t miss out", "Deal"]);
  assert.deepEqual(forbiddenTerms("Verbotene Wörter: krass, supergeil"), ["krass", "supergeil"]);
  const copy = structuredCopy([{ role: "headline", format: "1:1", text: "Black Friday Mega-Sale – don't miss out" }]);
  assert.deepEqual(findForbidden(copy, terms), ["Mega Sale", "Don’t miss out"]);
  assert.deepEqual(findForbidden("Headline [1:1]:\nIdeal für dich", ["Deal"]), []);
});

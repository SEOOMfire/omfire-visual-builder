import assert from "node:assert/strict";
import test from "node:test";
import { layoutHints } from "../src/modules/visual-builder/server/layout-hints";

const zone = { x: 50, y: 50, w: 900, h: 900 };

test("a sticker over the headline is named, a figure over a sticker is not", () => {
  const hints = layoutHints("1x191", zone, [
    { name: "Headline", box: { x: 80, y: 200, w: 400, h: 80 } },
    { name: "Störer", box: { x: 400, y: 220, w: 180, h: 180 } },
    { name: "Figur", box: { x: 500, y: 800, w: 300, h: 700 } },
    { name: "Sticker", box: { x: 520, y: 900, w: 80, h: 80 } },
  ]);
  assert.equal(hints.some((hint) => hint.kind === "overlap" && hint.sentence.includes("1080x1920")), true);
  assert.equal(hints.some((hint) => hint.elements.includes("Figur") && hint.elements.includes("Sticker")), false);
  const overlap = hints.find((hint) => hint.kind === "overlap");
  assert.ok(overlap);
  assert.deepEqual(overlap.elements, ["Headline", "Störer"]);
});

test("text below the shrink threshold and outside the safe zone is reported", () => {
  const hints = layoutHints("1x1", zone, [
    { name: "Headline", box: { x: 10, y: 10, w: 200, h: 40 }, requestedSize: 80, drawnSize: 20, clipped: true },
  ]);
  assert.deepEqual(hints.map((hint) => hint.kind).sort(), ["clipped", "safe-zone", "shrunk"]);
  assert.match(hints.find((hint) => hint.kind === "shrunk")!.sentence, /stark verkleinert im 1080x1080/);
});

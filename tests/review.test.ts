import assert from "node:assert/strict";
import test from "node:test";
import { blockingHints } from "../src/modules/visual-builder/server/creative-archive";
import { glanceContradictsMeasure, pruefungText } from "../src/modules/visual-builder/server/review";

test("the reply always names the image check", () => {
  assert.match(pruefungText([], ""), /Bildprüfung: nicht gelaufen/);
  assert.match(pruefungText([], "Bestanden, das Motiv sitzt."), /Bildprüfung: keine Anmerkungen/);
  assert.match(pruefungText([], "Die Raute sitzt auf dem Gesicht."), /Bildprüfung: Die Raute/);
  assert.match(pruefungText(["Die Headline liegt auf Orange im 1200x1200."], ""), /nicht bestanden/);
  assert.equal(blockingHints(["Die Headline liegt auf Orange im 1200x1200."]).length, 1);
  assert.equal(blockingHints(["Bildprüfung: keine Anmerkungen"]).length, 0);
  assert.equal(blockingHints(["nicht bestanden: Der Stern überdeckt die Headline im 1200x1200."]).length, 1);
  assert.equal(glanceContradictsMeasure([], "Die Unterzeile wird vom Stern überlappt."), true);
  assert.equal(glanceContradictsMeasure(["nicht bestanden: Der Stern überdeckt die Unterzeile im 1080x1920."], "Text überlappt."), false);
});

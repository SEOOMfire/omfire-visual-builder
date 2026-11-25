import assert from "node:assert/strict";
import test from "node:test";
import { blockingHints } from "../src/modules/visual-builder/server/creative-archive";
import { completeSentences, failedGlanceFormats, glanceContradictsMeasure, pruefungText } from "../src/modules/visual-builder/server/review";

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
  const glance = "1200x628: Nicht bestanden: Headline nur 55 Prozent.\n960x1200: Bestanden. Aufbau passt.\n1080x1080: Nicht bestanden: Der Stern ist klein.";
  assert.match(pruefungText([], glance), /Prüfung: Bildprüfung nicht bestanden \(1200x628, 1080x1080\)/);
  assert.deepEqual(failedGlanceFormats(glance), ["1200x628", "1080x1080"]);
  assert.equal(completeSentences("Headline Lime bzw. die Unterzeile bleibt orange. Zweiter Satz."), "Headline Lime bzw. die Unterzeile bleibt orange. Zweiter Satz.");
  assert.equal(completeSentences("Erster Satz. Zweiter Satz. Dritter Satz."), "Erster Satz. Zweiter Satz.");
});

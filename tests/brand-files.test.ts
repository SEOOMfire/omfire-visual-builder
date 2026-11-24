import assert from "node:assert/strict";
import test from "node:test";
import { validateMarke, validateVorlage } from "../src/modules/visual-builder/server/brand-files";

const zone = { x_pct: 5, y_pct: 5, w_pct: 90, h_pct: 90 };

test("a complete marke passes and a missing font file does not", () => {
  const marke = {
    schriften: { headline: { datei: "Geist-Bold.ttf", gewicht: 700, stil: "normal" }, body: { datei: "Geist-Regular.ttf", gewicht: 400, stil: "normal" } },
    palette: [{ name: "Rot", hex: "#E10600" }],
    sprachen: [{ code: "de", bezeichnung: "Deutsch", aktiv: true }],
    sichereZonen: { "1080x1080": zone, "1200x628": zone, "1080x1920": zone },
    benennung: {},
  };
  assert.deepEqual(validateMarke(marke), []);
  assert.equal(validateMarke({ ...marke, schriften: { ...marke.schriften, headline: { datei: "../x.ttf", gewicht: 700, stil: "normal" } } }).length > 0, true);
});

test("a template needs a description and two text boxes", () => {
  assert.equal(validateVorlage({ name: "hero-rechts", beschreibung: "Motiv rechts, Text links.", formate: { "1080x1080": { textkaesten: [{}, {}] } } }).length, 0);
  assert.equal(validateVorlage({ name: "Hero", beschreibung: "kurz", formate: {} }).length > 0, true);
});

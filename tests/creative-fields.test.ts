import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { creativeInput, fieldsForRender, type CreativeDraft } from "../src/modules/visual-builder/server/creative-archive";
import { OTELO_FORMATS } from "../src/modules/visual-builder/otelo-formats";
import { buildScene, type SceneCopy } from "../src/modules/visual-builder/otelo-scene";

const args = {
  headline: "BLACK WEEK",
  unterzeile: "3-FACH DATEN. GLEICHER PREIS.",
  subline: "",
  datenmenge: "150 GB",
  datenmenge_alt: "50 GB",
  preis: "19,99 €",
  preis_zusatz: "pro Monat",
  stern_text: "YOUNG DEAL",
  deko: "bw_wellen",
  button: "Jetzt sichern",
  kampagne: "BW",
};

test("compose reads every field, including an empty subline alias", () => {
  const input = creativeInput(args);
  assert.equal(input.subline, "3-FACH DATEN. GLEICHER PREIS.");
  assert.equal(input.datenmenge, "150 GB");
  assert.equal(input.datenmengeAlt, "50 GB");
  assert.equal(input.sternText, "YOUNG DEAL");
  assert.equal(input.deko, "bw_wellen");
});

test("an adjust render keeps the fields that compose stored", () => {
  const input = creativeInput(args);
  const draft = {
    id: "28b6993e-d86d-4a19-81b0-5d59ccef48f6",
    vorlage: "kachel_person",
    motiv: "Frau_mit_Cobra-Tattoo.png",
    person: "Frau_mit_Cobra-Tattoo.png",
    headline: input.headline ?? "",
    subline: input.subline ?? "",
    button: input.button ?? "",
    kampagne: input.kampagne ?? "",
    hints: [],
    stoererTyp: "stern",
    preis: input.preis ?? "",
    preisZusatz: input.preisZusatz ?? "",
    einmalpreis: "",
    aktionText: "",
    pflichttext: "",
    headlineVariante: "direkt",
    orange: "rechts",
    produktname: "",
    datenmenge: input.datenmenge,
    datenmengeAlt: input.datenmengeAlt,
    sternText: input.sternText,
    deko: input.deko,
  } satisfies CreativeDraft;
  const again = fieldsForRender(draft);
  assert.equal(again.subline, draft.subline);
  assert.equal(again.datenmenge, "150 GB");
  assert.equal(again.datenmengeAlt, "50 GB");
  assert.equal(again.sternText, "YOUNG DEAL");
  assert.equal(again.deko, "bw_wellen");
});

test("the compose tool lists the kachel fields", () => {
  const source = readFileSync(new URL("../app/mcp/route.ts", import.meta.url), "utf8");
  for (const key of ["unterzeile", "datenmenge", "datenmenge_alt", "stern_text", "deko", "preis", "preis_zusatz", "geraet_name"]) {
    assert.match(source, new RegExp(`${key}: \\{ type: "string"`));
  }
});

const sceneCopy = (): SceneCopy => ({
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

test("a bigger headline stays on its left edge and inside the format", () => {
  const format = OTELO_FORMATS.find((item) => item.id === "meta-1x1");
  assert.ok(format);
  const base = buildScene(format, "kachel_person", sceneCopy());
  const grown = buildScene(format, "kachel_person", sceneCopy(), { headline: { dx: 0, dy: 0, scale: 1.25, flip: false, hidden: false } });
  assert.ok(Math.abs(grown.headline.box.x - base.headline.box.x) < 2);
  assert.ok(grown.headline.box.x >= 0);
  assert.ok(grown.headline.box.x + grown.headline.box.w <= format.w * 0.98);
  assert.match(grown.hints.join(" "), /Maximum vergrößert/);
});

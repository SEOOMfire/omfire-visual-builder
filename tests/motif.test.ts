import assert from "node:assert/strict";
import test from "node:test";
import { resolveMotif, type MotifFile } from "../src/modules/visual-builder/server/motif";

const files: MotifFile[] = [
  { role: "figur", name: "young_hemd.png", path: "files/figur/young_hemd.png" },
  { role: "figur", name: "Froehlicher_Typ_mit_Hoodie_shutterstock_2461273183_rgb_03.png", path: "files/figur/hoodie.png" },
  { role: "figur", name: "Frau_mit_Cobra-Tattoo.png", path: "files/figur/cobra.png" },
  { role: "figur", name: "Frau_schaut_auf_Smartphone_orange.png", path: "files/figur/smartphone.png" },
];

test("the requested motif file is used, not another person whose name contains the template", () => {
  const found = resolveMotif(files, "Froehlicher_Typ_mit_Hoodie", "figur");
  assert.equal(found.name, "Froehlicher_Typ_mit_Hoodie_shutterstock_2461273183_rgb_03.png");
  assert.notEqual(found.name, "young_hemd.png");
});

test("an ambiguous motif is a question, not a guess", () => {
  assert.throws(() => resolveMotif(files, "Frau", "figur"), /Mehrere Dateien/);
  assert.throws(() => resolveMotif(files, "gibt-es-nicht", "figur"), /Kein Motiv/);
});

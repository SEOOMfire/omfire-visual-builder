import assert from "node:assert/strict";
import test from "node:test";
import { creativeFileName, namePart, nextVersion, outputFolder, zipFileName } from "../src/modules/visual-builder/server/naming";

test("umlauts and punctuation become a lowercase hyphenated part", () => {
  assert.equal(namePart("Größe & Preis!"), "groesse-preis");
  assert.equal(namePart("Straße"), "strasse");
});

test("file names join parts with underscores and never reuse a version", () => {
  const existing = ["ausgabe/black-friday/2026-11/otelo_black-friday_familie_1080x1080_de_v01.png"];
  const version = nextVersion(existing, "otelo_black-friday_familie_1080x1080_de");
  assert.equal(version, 2);
  assert.equal(creativeFileName({
    client: "Otelo",
    campaign: "Black Friday",
    motif: "familie.jpg",
    format: "1x1",
    language: "de",
    version,
  }), "otelo_black-friday_familie_1080x1080_de_v02.png");
  assert.equal(zipFileName({ client: "otelo", campaign: "black-friday", motif: "familie", language: "de", version: 2 }), "otelo_black-friday_familie_de_v02.zip");
});

test("a missing campaign is a question, not a guess", () => {
  assert.throws(() => outputFolder("  "), /Kampagne fehlt/);
});

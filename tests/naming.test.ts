import assert from "node:assert/strict";
import test from "node:test";
import { creativeFileName, namePart, nextVersion, oteloFileName, oteloFolder, outputFolder, zipFileName } from "../src/modules/visual-builder/server/naming";

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

test("otelo names follow the files already in the library", () => {
  assert.equal(oteloFileName({
    channel: "PMAX", quarter: "Q4", monthYear: "1126", campaign: "BW", motif: "P10a_Classic", format: "1200x628", extra: "mitBatch", audience: "Hardware-Standard",
  }), "PMAX_Q4_1126_BW_P10a_Classic_1200x628_mitBatch.png");
  assert.equal(oteloFileName({
    channel: "Meta", quarter: "Q4", monthYear: "1126", campaign: "BW", motif: "Xiaomi_UL", format: "9x16", audience: "Hardware-Standard",
  }), "Meta_Q4_1126_BW_Xiaomi_UL_9x16.png");
  assert.equal(oteloFolder({
    channel: "Tiktok", quarter: "Q4", monthYear: "1126", campaign: "BW", motif: "S26", format: "9x16", audience: "Hardware-Standard",
  }), "Werbemittel/TikTok_1126/Tiktok_Q4_1126_BW/Hardware-Standard/Stills");
  assert.equal(nextVersion(["PMAX_Q4_1126_BW_S26_1200x628.png", "PMAX_Q4_1126_BW_S26_1200x628_v2.png"], "PMAX_Q4_1126_BW_S26_1200x628"), 3);
});

test("a missing campaign is a question, not a guess", () => {
  assert.throws(() => outputFolder("  "), /Kampagne fehlt/);
});

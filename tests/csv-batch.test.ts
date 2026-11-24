import assert from "node:assert/strict";
import test from "node:test";
import { inspectBatch, parseBatchCsv } from "../src/modules/visual-builder/server/csv-batch";

test("semicolon CSV with a BOM and alle formats is accepted", () => {
  const parsed = parseBatchCsv("\uFEFFkampagne;motiv;vorlage;headline;subline;button;stoerer;sprachen;formate\nBlack Friday;familie.jpg;hero-rechts;Jetzt sichern;Nur heute;Mehr;alt~~9€~~|**neu**;de,tr;alle\n");
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.languages.join(","), "de,tr");
  assert.deepEqual(parsed.rows[0]?.formats, ["pmax-1200x1200", "pmax-1200x628", "pmax-960x1200", "meta-1x1", "meta-9x16", "tiktok-9x16"]);
  assert.equal(parsed.rows[0]?.badge.includes("|"), true);
});

test("a higher one-time price is refused and an internal term is named", () => {
  const parsed = inspectBatch("kampagne;motiv;vorlage;headline;zielgruppe;einmalpreis;preis_alt;preis;datenmenge\nBW;A57;kachel_geraet;BLACK WEEK;Hardware-Standard;229 €;199 €;9,99 €;15 GB\nBW;A57;kachel_geraet;SUB 10;Hardware-Standard;179 €;229 €;19,99 €;150 GB\n");
  assert.match(parsed.errors.join(" "), /nicht als statt/i);
  assert.match(parsed.errors.join(" "), /SUB/);
});

test("a missing required column is reported and no rows are invented", () => {
  const parsed = parseBatchCsv("kampagne,headline\nx,y\n");
  assert.equal(parsed.rows.length, 0);
  assert.match(parsed.errors.join(" "), /motiv/);
});

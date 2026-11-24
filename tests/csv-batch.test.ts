import assert from "node:assert/strict";
import test from "node:test";
import { parseBatchCsv } from "../src/modules/visual-builder/server/csv-batch";

test("semicolon CSV with a BOM and alle formats is accepted", () => {
  const parsed = parseBatchCsv("\uFEFFkampagne;motiv;vorlage;headline;subline;button;stoerer;sprachen;formate\nBlack Friday;familie.jpg;hero-rechts;Jetzt sichern;Nur heute;Mehr;alt~~9€~~|**neu**;de,tr;alle\n");
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.languages.join(","), "de,tr");
  assert.deepEqual(parsed.rows[0]?.formats, ["1080x1080", "1200x628", "1080x1920"]);
  assert.equal(parsed.rows[0]?.badge.includes("|"), true);
});

test("a missing required column is reported and no rows are invented", () => {
  const parsed = parseBatchCsv("kampagne,headline\nx,y\n");
  assert.equal(parsed.rows.length, 0);
  assert.match(parsed.errors.join(" "), /motiv/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { checkOteloCopy } from "../src/modules/visual-builder/server/otelo-rules";
import { OTELO_FORMATS } from "../src/modules/visual-builder/otelo-formats";

test("otelo keeps six channel formats and rejects a loud word", () => {
  assert.equal(OTELO_FORMATS.length, 6);
  assert.equal(OTELO_FORMATS.some((format) => format.token === "9x16" && format.channel === "Tiktok"), true);
  const findings = checkOteloCopy("Otelo\nDas ist supergeil");
  assert.equal(findings.some((finding) => finding.rule === "ton"), true);
  assert.equal(findings.some((finding) => finding.rule === "markenname"), true);
});

test("a short offer line passes", () => {
  assert.deepEqual(checkOteloCopy("150 GB\nGleicher Preis"), []);
});

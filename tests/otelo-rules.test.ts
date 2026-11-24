import assert from "node:assert/strict";
import test from "node:test";
import { checkHeadlineFont, checkOteloCopy, checkSplitAngle } from "../src/modules/visual-builder/server/otelo-rules";
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

test("the split stays inside the otelo angle ranges and the headline font is Titillium", () => {
  assert.equal(checkSplitAngle(32, 1200, 628), null);
  assert.equal(checkSplitAngle(32, 1080, 1920), null);
  assert.match(checkSplitAngle(10, 1200, 628) ?? "", /25 bis 45/);
  assert.match(checkSplitAngle(8, 1080, 1920) ?? "", /11 bis 45/);
  assert.equal(checkHeadlineFont("Titillium Web"), null);
  assert.match(checkHeadlineFont("Arial") ?? "", /Titillium Web/);
});

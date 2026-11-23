import assert from "node:assert/strict";
import test from "node:test";
import { canDownloadArchivedCreative, canDownloadCreative, guidelineOutcome } from "../../src/modules/visual-builder/approval";
import { removeArchivedCreative } from "../../src/modules/visual-builder/archive-cache";
import {
  closestFormat,
  fileBaseName,
  fitRectToZone,
  isValidRect,
  languageSuffix,
  placeInZone,
} from "../../src/modules/visual-builder/layout";
import { parseFolderId, parseGuidelineResult, sanitizeHtml, stripCodeFence } from "../../src/modules/visual-builder/server/parse";
import { manifest } from "../../src/modules/visual-builder/manifest";
import type { ArchiveEntry } from "../../src/modules/visual-builder/types";

test("motifs are assigned to the format with the closest aspect ratio", () => {
  assert.equal(closestFormat(1), "1x1");
  assert.equal(closestFormat(1.2), "1x1");
  assert.equal(closestFormat(1200 / 628), "191x1");
  assert.equal(closestFormat(16 / 9), "191x1");
  assert.equal(closestFormat(9 / 16), "1x191");
  assert.equal(closestFormat(4 / 5), "1x1");
});

test("sibling motifs share a base name regardless of format suffix, ratio tag or extension", () => {
  const base = fileBaseName("Sommer_Kampagne_1x1.jpg");
  assert.equal(base, "sommer_kampagne");
  assert.equal(fileBaseName("Sommer_Kampagne_1.91x1.jpg"), base);
  assert.equal(fileBaseName("Sommer_Kampagne_1x1.91.png"), base);
  assert.equal(fileBaseName("folder/1730000000-Sommer_Kampagne_191x1.webp"), base);
  assert.equal(fileBaseName("Sommer_9-16_Kampagne.jpg"), base);
  assert.notEqual(fileBaseName("Winter_Kampagne_1x1.jpg"), base);
});

test("text frames are moved and shrunk into the safe zone", () => {
  const zone = { x_pct: 10, y_pct: 10, w_pct: 80, h_pct: 80 };
  assert.deepEqual(fitRectToZone({ x_pct: 0, y_pct: 0, w_pct: 50, h_pct: 20 }, zone), { x_pct: 10, y_pct: 10, w_pct: 50, h_pct: 20 });
  assert.deepEqual(fitRectToZone({ x_pct: 70, y_pct: 85, w_pct: 95, h_pct: 30 }, zone), { x_pct: 10, y_pct: 60, w_pct: 80, h_pct: 30 });
});

test("presets place logo and button inside the safe zone", () => {
  const zone = { x_pct: 5, y_pct: 5, w_pct: 90, h_pct: 90 };
  const topLeft = placeInZone("top-left", 100, 50, zone, 1000, 1000, 10);
  assert.deepEqual(topLeft, { x: 60, y: 60 });
  const bottomRight = placeInZone("bottom-right", 100, 50, zone, 1000, 1000, 10);
  assert.deepEqual(bottomRight, { x: 840, y: 890 });
  const center = placeInZone("center", 100, 50, zone, 1000, 1000, 10);
  assert.deepEqual(center, { x: 450, y: 475 });
});

test("safe zones must lie inside the image", () => {
  assert.equal(isValidRect({ x_pct: 5, y_pct: 5, w_pct: 90, h_pct: 90 }), true);
  assert.equal(isValidRect({ x_pct: 20, y_pct: 5, w_pct: 90, h_pct: 90 }), false);
  assert.equal(isValidRect({ x_pct: 5, y_pct: 5, w_pct: 0, h_pct: 90 }), false);
  assert.equal(isValidRect({ x_pct: "5", y_pct: 5, w_pct: 90, h_pct: 90 }), false);
});

test("export files carry the short language code", () => {
  assert.equal(languageSuffix("en-US"), "_en");
  assert.equal(languageSuffix("de"), "_de");
  assert.equal(languageSuffix(""), "");
  assert.equal(languageSuffix(null), "");
});

test("downloading needs a server check of exactly the current text; findings only mark it as not signed off", () => {
  assert.equal(guidelineOutcome("Text", "Text", "c1", true), "approved");
  assert.equal(guidelineOutcome("Text", "Text", "c1", false), "flagged");
  assert.equal(guidelineOutcome("Text", "Text geändert", "c1", true), "none");
  assert.equal(guidelineOutcome("Text", "Text", null, true), "none");
  assert.equal(guidelineOutcome(null, "", null, true), "none");
  assert.equal(guidelineOutcome("", "", "c1", true), "approved", "a creative without text can be checked");
  assert.equal(canDownloadCreative("approved"), true);
  assert.equal(canDownloadCreative("flagged"), true);
  assert.equal(canDownloadCreative("none"), false);
});

test("archived downloads stay open for checked and taken-over entries, not for unchecked drafts", () => {
  assert.equal(canDownloadArchivedCreative("approved"), true);
  assert.equal(canDownloadArchivedCreative("flagged"), true);
  assert.equal(canDownloadArchivedCreative(null), true);
  assert.equal(canDownloadArchivedCreative("draft"), false);
});

test("a confirmed deletion leaves the archive list at once", () => {
  const entry = (id: string): ArchiveEntry => ({ id, sourceText: "", languageCode: null, guidelineStatus: null, hasState: false, createdAt: "", thumbs: {}, zipUrl: null });
  assert.deepEqual(removeArchivedCreative([entry("a"), entry("b")], "a")?.map((item) => item.id), ["b"]);
  assert.deepEqual(removeArchivedCreative([entry("b")], "a")?.map((item) => item.id), ["b"]);
  assert.equal(removeArchivedCreative(null, "a"), null);
});

test("translated markup is stripped of active content", () => {
  const dirty = `<b onclick="x()">Hallo</b><script>alert(1)</script><a href="javascript:alert(1)">Link</a><iframe src="x"></iframe>`;
  const clean = sanitizeHtml(dirty);
  assert.doesNotMatch(clean, /script|onclick|javascript:|iframe/i);
  assert.match(clean, /<b>Hallo<\/b>/);
  assert.equal(stripCodeFence("```html\n<b>Hi</b>\n```"), "<b>Hi</b>");
});

test("guideline results are accepted only in the agreed shape", () => {
  assert.deepEqual(parseGuidelineResult(`{"ok":true,"violations":[]}`), { ok: true, violations: [] });
  assert.deepEqual(parseGuidelineResult("```json\n{\"ok\":false,\"violations\":[{\"rule\":\"R1\",\"message\":\"Zu laut\"}]}\n```"), { ok: false, violations: [{ rule: "R1", message: "Zu laut" }] });
  assert.deepEqual(parseGuidelineResult(`Ergebnis: {"ok":true,"violations":[]} fertig`), { ok: true, violations: [] });
  assert.equal(parseGuidelineResult(`{"ok":"yes","violations":[]}`), null);
  assert.equal(parseGuidelineResult(`{"ok":true,"violations":[{"rule":1}]}`), null);
  assert.equal(parseGuidelineResult("kein JSON"), null);
});

test("Drive folders are accepted as link or id only", () => {
  assert.equal(parseFolderId("https://drive.google.com/drive/folders/1AbC_def-123?usp=sharing"), "1AbC_def-123");
  assert.equal(parseFolderId("1AbC_def-123"), "1AbC_def-123");
  assert.throws(() => parseFolderId("../../etc"), /Ordner/);
  assert.throws(() => parseFolderId(""), /Ordner/);
});

test("the module is internal by default and capability-gated", () => {
  assert.equal(manifest.defaultEnabled, false);
  assert.equal(manifest.customerVisibleByDefault, false);
  assert.equal(manifest.routes[0]?.requiredCapability, "visual-builder.read");
  assert.deepEqual([...manifest.capabilities].sort(), ["visual-builder.configure", "visual-builder.create", "visual-builder.delete", "visual-builder.read", "visual-builder.upload"]);
});

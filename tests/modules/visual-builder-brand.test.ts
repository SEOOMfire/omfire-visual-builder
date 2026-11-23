import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_BADGE_COLORS,
  DEFAULT_BADGE_LINES,
  badgeHeight,
  badgePlain,
  badgeSegments,
  brandColors,
  decodeBadgeLines,
  encodeBadgeLines,
  isCtaShape,
  lineBold,
  normalizeBadgeColors,
  normalizeBadgeItem,
  normalizeBrand,
  normalizeFrame,
  normalizeStickerItem,
  priceBoxLayout,
  priceBoxSections,
} from "../../src/modules/visual-builder/brand";
import { structuredCopy } from "../../src/modules/visual-builder/guideline-rules";
import { normalizeFigure } from "../../src/modules/visual-builder/layout";
import { ctaPlain } from "../../src/modules/visual-builder/render";

test("the brand setup keeps only valid fonts and colours and adds black and white once", () => {
  const brand = normalizeBrand({
    headlineFont: "Titillium Web",
    bodyFont: 'Geist"; injected',
    headlineColor: "#D7EB00",
    bodyColor: "white",
    palette: [{ name: "Orange", hex: "#FA5A14" }, { name: "Doppelt", hex: "#fa5a14" }, { name: "Kaputt", hex: "orange" }, { name: "Schwarz", hex: "#000000" }],
  });
  assert.deepEqual(brand, {
    headlineFont: "Titillium Web",
    bodyFont: null,
    headlineColor: "#d7eb00",
    bodyColor: null,
    palette: [{ name: "Orange", hex: "#fa5a14" }, { name: "Schwarz", hex: "#000000" }],
  });
  assert.deepEqual(brandColors(brand).map((color) => color.hex), ["#fa5a14", "#000000", "#ffffff"]);
  assert.deepEqual(normalizeBrand(null).palette, []);
});

test("badge lines survive storage, including struck-through prices", () => {
  const lines = DEFAULT_BADGE_LINES["price-box"];
  assert.equal(encodeBadgeLines(lines), "l:125 GB\ns~:100 GB\nl:24,99 €\ns:pro Monat");
  assert.deepEqual(decodeBadgeLines(encodeBadgeLines(lines)), lines);
  assert.deepEqual(decodeBadgeLines("x:kaputt\nm:Mitte"), [{ text: "Mitte", size: "m", strike: false }]);
  assert.ok(encodeBadgeLines(lines.map((line) => ({ ...line, text: "x".repeat(40) }))).length <= 200);
});

test("badge colours accept the stored asset style and fall back per field", () => {
  assert.deepEqual(normalizeBadgeColors({ bg_color: "#D7EB00", text_color: "#000000", accent_bg: "nope" }), {
    ...DEFAULT_BADGE_COLORS, bg: "#d7eb00", fg: "#000000",
  });
});

test("a saved badge is restored safely", () => {
  const item = normalizeBadgeItem({ uid: "a", name: "Preis", shape: "price-box", lines: [{ text: "9 €", size: "l" }], pos: { x_pct: -10 }, scale: 500 });
  assert.ok(item);
  assert.equal(item.scale, 80);
  assert.equal(item.pos.x_pct, 0);
  assert.deepEqual(item.lines, [{ text: "9 €", size: "l", strike: false }]);
  assert.equal(normalizeBadgeItem({ uid: "b", shape: "hexagon" }), null);
});

test("the price box puts two lines on top and grows with its text, round badges stay square", () => {
  const lines = DEFAULT_BADGE_LINES["price-box"];
  const sections = priceBoxSections(lines);
  assert.deepEqual(sections.top.map((line) => line.text), ["125 GB", "100 GB"]);
  assert.deepEqual(sections.bottom.map((line) => line.text), ["24,99 €", "pro Monat"]);
  const layout = priceBoxLayout(lines, 300);
  assert.equal(layout.h, layout.topH + layout.bottomH);
  assert.equal(badgeHeight("price-box", lines, 300), layout.h);
  assert.ok(badgeHeight("price-box", lines.slice(0, 2), 300) < layout.h);
  assert.equal(badgeHeight("burst", DEFAULT_BADGE_LINES.burst, 300), 300);
});

test("badge texts are checked as their own role, button text without bold markers", () => {
  const copy = structuredCopy([
    { role: "headline", format: "1:1", text: "DEIN DATEN-DEAL" },
    { role: "button", format: "1:1", text: ctaPlain("Jetzt sichern auf **otelo.de**") },
    { role: "badge", format: "1:1", text: "Dauerhaft\nMEHR\nDATEN" },
  ]);
  assert.match(copy, /Störer \[1:1\]:\nDauerhaft\nMEHR\nDATEN/);
  assert.ok(copy.indexOf("Störer") < copy.indexOf("Button"));
  assert.match(copy, /Jetzt sichern auf otelo\.de/);
  assert.equal(isCtaShape("arrow"), true);
  assert.equal(isCtaShape("star"), false);
});

test("badge rows keep XL, bold and inline markers through storage", () => {
  const lines = [
    { text: "UNLIMITED", size: "l" as const, strike: false },
    { text: "ON DEMAND", size: "s" as const, strike: false, bold: false },
    { text: "200 GB ~~100 GB~~", size: "xl" as const, strike: false, bold: true },
  ];
  assert.equal(encodeBadgeLines(lines), "l:UNLIMITED\ns-:ON DEMAND\nxl*:200 GB ~~100 GB~~");
  assert.deepEqual(decodeBadgeLines(encodeBadgeLines(lines)), lines);
  assert.equal(lineBold(lines[0]), true);
  assert.equal(lineBold({ text: "x", size: "s", strike: false }), false);
});

test("inline markers split a badge row into bold and small struck parts", () => {
  assert.deepEqual(badgeSegments("200 GB ~~100 GB~~", false), [
    { text: "200 GB ", bold: false, small: false },
    { text: "100 GB", bold: false, small: true },
  ]);
  assert.deepEqual(badgeSegments("Nur **29,99 €**", false).map((segment) => segment.bold), [false, true]);
  assert.deepEqual(badgeSegments("a ** b", true), [{ text: "a ** b", bold: true, small: false }]);
  assert.equal(badgePlain([{ text: "200 GB ~~100 GB~~", size: "xl", strike: false }, { text: " ", size: "s", strike: false }, { text: "**MEHR**", size: "l", strike: false }]), "200 GB [struck: 100 GB]\nMEHR");
  assert.equal(badgePlain([{ text: "statt 39,99 €", size: "s", strike: true }]), "[struck: statt 39,99 €]");
});

test("text frames and stickers are restored safely", () => {
  assert.deepEqual(normalizeFrame({ border: "#FFFFFF", fill: "nope" }), { border: "#ffffff", fill: null });
  assert.equal(normalizeFrame({ border: "white" }), null);
  assert.deepEqual(normalizeStickerItem({ uid: "s", assetId: "a", x_pct: 500, rotate: -400, scale: 1 }), {
    uid: "s", assetId: "a", name: "", x_pct: 150, y_pct: 50, scale: 3, rotate: -180, flip: false, behind: true,
  });
  assert.equal(normalizeStickerItem({ uid: "s" }), null);
  assert.equal(normalizeFigure({ rotate: 12 }).rotate, 12);
  assert.equal(normalizeFigure({}).rotate, 0);
});

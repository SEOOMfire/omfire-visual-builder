import assert from "node:assert/strict";
import test from "node:test";
import { contactScale } from "../src/modules/visual-builder/contact-sheet";
import { figureRect, graphicBounds } from "../src/modules/visual-builder/layout";
import { OTELO_FORMATS } from "../src/modules/visual-builder/otelo-formats";
import { templateLayout } from "../src/modules/visual-builder/otelo-templates";
import { boxesOverlap, MIN_BUTTON_HEIGHT_RATIO } from "../src/modules/visual-builder/server/layout-hints";

const zone = { x_pct: 5, y_pct: 5, w_pct: 90, h_pct: 90 };
const logoAspect = 1183 / 212;
const ctaAspect = 684.6 / 61.6;
const figureAspect = 2120 / 2499;

test("the young bar is readable and does not cover the logo or the figure", () => {
  const layout = templateLayout("young", "BLACK WEEK", "Gleicher Preis.", false);
  for (const format of OTELO_FORMATS) {
    const logo = graphicBounds(layout.logoScale, logoAspect, layout.logoPos ?? null, "bottom-left", zone, format.w, format.h);
    const button = graphicBounds(layout.ctaScale, ctaAspect, layout.ctaPos ?? null, "bottom-left", zone, format.w, format.h);
    const figure = figureRect(layout.figure!, figureAspect, format.w, format.h);
    assert.equal(boxesOverlap(logo, button), false, format.id);
    assert.equal(boxesOverlap(button, figure), false, format.id);
    assert.equal(boxesOverlap(logo, figure), false, format.id);
    assert.ok(button.h >= Math.min(format.w, format.h) * MIN_BUTTON_HEIGHT_RATIO, format.id);
  }
});

test("the contact sheet stays within 2000 pixels on the long edge", () => {
  assert.equal(contactScale(8000, 1200), 2000 / 8000);
  assert.equal(contactScale(1000, 500), 1);
});

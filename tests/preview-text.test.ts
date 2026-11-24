import assert from "node:assert/strict";
import test from "node:test";
import { archivePeriod, versionFor } from "../src/modules/visual-builder/server/creative-archive";
import { markdownPreview, uniqueFormatLabels } from "../src/modules/visual-builder/server/preview-text";

test("preview text carries the real file name and a markdown image", () => {
  const labels = uniqueFormatLabels([
    { id: "pmax-1200x628", pixel: "1200x628", channel: "PMAX" },
    { id: "meta-9x16", pixel: "1080x1920", channel: "Meta" },
    { id: "tiktok-9x16", pixel: "1080x1920", channel: "Tiktok" },
  ]);
  const text = markdownPreview({
    intro: "Entwurf young.",
    motifName: "Froehlicher_Typ_mit_Hoodie_shutterstock_2461273183_rgb_03.png",
    contactUrl: "https://visual-builder.coolify-host-0.omx.services/p/kontakt",
    formats: [
      { label: labels.get("pmax-1200x628") ?? "", url: "https://visual-builder.coolify-host-0.omx.services/p/wide" },
      { label: labels.get("meta-9x16") ?? "", url: "https://visual-builder.coolify-host-0.omx.services/p/meta" },
      { label: labels.get("tiktok-9x16") ?? "", url: "https://visual-builder.coolify-host-0.omx.services/p/tiktok" },
    ],
    hints: [],
  });
  assert.match(text, /Motiv: Froehlicher_Typ_mit_Hoodie_shutterstock_2461273183_rgb_03\.png/);
  assert.match(text, /!\[Kontaktbogen\]\(https:\/\/visual-builder\.coolify-host-0\.omx\.services\/p\/kontakt\)/);
  assert.match(text, /\[1200x628\]\(https:\/\/visual-builder\.coolify-host-0\.omx\.services\/p\/wide\)/);
  assert.match(text, /\[1080x1920 Meta\]/);
  assert.match(text, /\[1080x1920 Tiktok\]/);
});

test("archive names use the calendar period and do not overwrite", () => {
  assert.deepEqual(archivePeriod(new Date("2026-11-24T12:00:00Z")), { quarter: "Q4", monthYear: "1126" });
  assert.equal(versionFor([], "PMAX_Q4_1126_BW_S26_1200x628"), 1);
  assert.equal(versionFor(["PMAX_Q4_1126_BW_S26_1200x628.png"], "PMAX_Q4_1126_BW_S26_1200x628"), 2);
  assert.equal(versionFor(["PMAX_Q4_1126_BW_S26_1200x628_v2.png"], "PMAX_Q4_1126_BW_S26_1200x628"), 3);
});

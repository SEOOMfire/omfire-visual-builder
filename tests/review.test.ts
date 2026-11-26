import assert from "node:assert/strict";
import test from "node:test";
import { blockingHints } from "../src/modules/visual-builder/server/creative-archive";
import { reviewSize } from "../src/modules/visual-builder/server/review-image";
import { completeSentences, failedGlanceFormats, glanceBrief, glanceContradictsMeasure, glanceLine, measuredLines, parseGlance, pruefungText, visibleBriefing, withoutInstructed } from "../src/modules/visual-builder/server/review";

test("the reply always names the image check", () => {
  assert.match(pruefungText([], ""), /Bildprüfung: nicht gelaufen/);
  assert.match(pruefungText([], "Bestanden, das Motiv sitzt."), /Bildprüfung: keine Anmerkungen/);
  assert.match(pruefungText([], "Die Raute sitzt auf dem Gesicht."), /Bildprüfung: Die Raute/);
  assert.match(pruefungText(["Die Headline liegt auf Orange im 1200x1200."], ""), /Prüfung: nicht bestanden/);
  const mixed = measuredLines([
    "nicht bestanden: Der Stern überdeckt CTA im 1080x1920 Meta.",
    "nicht bestanden: Der Stern überdeckt CTA im 1080x1920 Tiktok.",
    "Hinweis: Deko kaum sichtbar vor dem Motiv – Wellen oder keine Deko? im 1080x1920 Meta.",
    "Hinweis: Deko kaum sichtbar vor dem Motiv – Wellen oder keine Deko? im 1080x1920 Tiktok.",
  ]);
  assert.deepEqual(mixed.blocking, ["Der Stern überdeckt CTA (1080x1920 Meta, 1080x1920 Tiktok)."]);
  assert.deepEqual(mixed.notes, ["Deko kaum sichtbar vor dem Motiv – Wellen oder keine Deko? (1080x1920 Meta, 1080x1920 Tiktok)."]);
  assert.equal(mixed.notes.some((note) => /nicht bestanden/i.test(note)), false);
  assert.equal(blockingHints(["Die Headline liegt auf Orange im 1200x1200."]).length, 1);
  assert.equal(blockingHints(["Bildprüfung: keine Anmerkungen"]).length, 0);
  assert.equal(blockingHints(["nicht bestanden: Der Stern überdeckt die Headline im 1200x1200."]).length, 1);
  assert.equal(glanceContradictsMeasure([], "Die Unterzeile wird vom Stern überlappt."), true);
  assert.equal(glanceContradictsMeasure(["nicht bestanden: Der Stern überdeckt die Unterzeile im 1080x1920."], "Text überlappt."), false);
  const glance = ["1200x628: Nicht bestanden: Headline nur 55 Prozent.", "960x1200: Bestanden. Aufbau passt.", "1080x1080: Nicht bestanden: Der Stern ist klein."]
    .map((line) => {
      const split = line.indexOf(":");
      const label = line.slice(0, split).trim();
      return `${label}: ${glanceLine(line.slice(split + 1), label)}`;
    })
    .join("\n");
  assert.match(pruefungText([], glance), /Prüfung: Bildprüfung nicht bestanden \(1080x1080\)/);
  assert.doesNotMatch(glance, /1200x628: Nicht bestanden/);
  assert.deepEqual(failedGlanceFormats(glance), ["1080x1080"]);
  assert.equal(completeSentences("Headline Lime bzw. die Unterzeile bleibt orange. Zweiter Satz."), "Headline Lime bzw. die Unterzeile bleibt orange. Zweiter Satz.");
  assert.equal(completeSentences("Erster Satz. Zweiter Satz. Dritter Satz."), "Erster Satz. Zweiter Satz.");
});

test("every glance line has a verdict and the typeface is not judged", () => {
  assert.equal(glanceLine("Bestanden."), "Bestanden.");
  assert.equal(glanceLine("Auffällig ist nur der Abstand zur Welle."), "Bestanden. Auffällig ist nur der Abstand zur Welle.");
  assert.match(glanceLine("Der Stern ist zu klein."), /^Nicht bestanden:/);
  assert.match(glanceLine("nicht bestanden: der Stern ist klein."), /^Nicht bestanden: der Stern ist klein/);
  assert.match(glanceLine("Nicht bestanden: Headline-Breite 78 Prozent statt 83.", "Meta 9x16"), /^Bestanden\./);
  assert.match(glanceLine("Nicht bestanden: das passt, der Abstand ist zulässig."), /^Bestanden\./);
  assert.match(glanceLine("Der CTA-Pfeil sitzt zu weit links."), /^Bestanden\./);
  assert.match(glanceLine("Nicht bestanden: Der Preis ist abgeschnitten."), /^Nicht bestanden:/);
  assert.match(glanceLine("Nicht bestanden: Das Gesicht ist verdeckt."), /^Nicht bestanden:/);
  assert.match(glanceLine("Nicht bestanden: Das Logo fehlt.", "Meta 9x16"), /^Bestanden\./);
  assert.match(glanceLine("Nicht bestanden: Das Logo fehlt.", "Meta 1x1"), /^Nicht bestanden:/);
  const brief = glanceBrief("Deko ist auf Wunsch keine.", "", "", "Meta 9x16");
  assert.match(brief, /Schriftart und Schriftschnitt nicht bewerten/);
  assert.match(brief, /78 Prozent/);
  assert.match(glanceBrief("", "", "", "PMAX 1200x628"), /55 Prozent/);
  assert.doesNotMatch(brief, /Titillium|Geist/);
  const stripped = withoutInstructed("Die Unterzeile steht in Titillium Web Black statt Titillium. Der Aufbau passt.", "Deko ist auf Wunsch keine.");
  assert.doesNotMatch(stripped, /Titillium|Geist/);
  assert.match(stripped, /Aufbau/);
  assert.equal(parseGlance("Aufbau und Größen passen. Nicht bestanden: alles wirkt stimmig."), "Bestanden.");
  assert.equal(parseGlance('{"verstoesse":[]}'), "Bestanden.");
  assert.match(parseGlance('{"verstoesse":[{"art":"text_abgeschnitten","element":"Preis","beschreibung":"Der Preis ist abgeschnitten."}]}'), /^Nicht bestanden: Der Preis ist abgeschnitten/);
  assert.equal(parseGlance('{"verstoesse":[{"art":"pflichtelement_fehlt","element":"Logo","beschreibung":"Das Logo fehlt."}]}', "Meta 9x16"), "Bestanden.");
  assert.equal(parseGlance('{"verstoesse":[{"art":"falsche_ci_farbe","element":"Headline","beschreibung":"Headline nur 78 Prozent. Dieser Punkt zählt als angewiesene Änderung."}]}', "Meta 9x16"), "Bestanden.");
  assert.equal(parseGlance('{"verstoesse":[{"art":"text_ueberdeckt","element":"Display","beschreibung":"Branding auf dem Geräte-Display."}]}'), "Bestanden.");
  const fields = "CTA: Jetzt wechseln\nHeadline: ENDLOS SURFEN";
  assert.equal(parseGlance('{"verstoesse":[{"art":"text_unleserlich","element":"CTA","beschreibung":"Der CTA lautet Jetzt sichern."}]}', "1080x1080", fields), "Bestanden.");
  assert.equal(parseGlance('{"verstoesse":[{"art":"text_ueberdeckt","element":"Haar","beschreibung":"Die CTA-Spitze liegt über den Haaren."}]}'), "Bestanden.");
  assert.match(parseGlance('{"verstoesse":[{"art":"gesicht_verdeckt","element":"Gesicht","beschreibung":"Augen und Mund sind verdeckt."}]}'), /^Nicht bestanden:/);
  assert.doesNotMatch(glanceBrief("", "", "", "Meta 9x16", fields), /Dieser Punkt zählt als angewiesene Änderung\./);
  assert.match(glanceBrief("", "", "", "1080x1920 Meta", fields), /voller Auflösung/);
  assert.match(glanceBrief("", "", "", "1080x1080"), /Preis-Pille absichtlich/);
  const shown = visibleBriefing({ subline: "JETZT", sternText: "1. MONAT GRATIS", vorlage: "kachel_person" }, new Set(["stoerer"]));
  assert.match(shown, /JETZT/);
  assert.doesNotMatch(shown, /MONAT/);
  assert.equal(parseGlance('{"verstoesse":[{"art":"pflichtelement_fehlt","element":"Stern","beschreibung":"1. MONAT GRATIS ist nicht zu sehen."}]}', "1080x1080", shown), "Bestanden.");
  assert.equal(parseGlance('{"verstoesse":[{"art":"text_ueberdeckt","element":"Pille","beschreibung":"Die Pille ragt in die Lime-Kachel."}]}'), "Bestanden.");
  assert.deepEqual(reviewSize(1080, 1920), { width: 1080, height: 1920 });
});

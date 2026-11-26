import assert from "node:assert/strict";
import test from "node:test";
import { applyToBook, commandFromModel, correctStarStep, finishAdjustSummary, mergedNudge, newBook, seedBook } from "../src/modules/visual-builder/server/adjust-commands";

test("Störer etwas tiefer moves it down by 3 percent", () => {
  const step = applyToBook(newBook(), "Störer etwas tiefer");
  assert.equal(step.question, undefined);
  assert.equal(mergedNudge(step.book.snap, "pmax-1200x1200", "stoerer").dy, 3);
  assert.equal(step.book.version, 2);
});

test("Frau spiegeln und auf die andere Seite flips her and swaps the side", () => {
  const step = applyToBook(newBook("rechts"), "Frau spiegeln und auf die andere Seite");
  assert.equal(step.book.snap.orange, "links");
  assert.equal(mergedNudge(step.book.snap, "meta-1x1", "person").flip, true);
  assert.equal(mergedNudge(step.book.snap, "meta-1x1", "stoerer").flip, false);
});

test("the live sentence grows the badge, flips the woman and swaps the layout", () => {
  const step = applyToBook(newBook("rechts"), "Störer deutlich größer und etwas tiefer, Frau spiegeln und auf die andere Seite");
  assert.match(step.summary, /umgesetzt: Störer 30 % größer/);
  assert.match(step.summary, /umgesetzt: Frau gespiegelt/);
  assert.match(step.summary, /umgesetzt: Layout getauscht/);
  assert.equal(step.book.snap.orange, "links");
  const badge = mergedNudge(step.book.snap, "meta-9x16", "stoerer");
  assert.equal(badge.scale, 1.3);
  assert.equal(badge.dy, 3);
  assert.equal(badge.flip, false);
  assert.equal(mergedNudge(step.book.snap, "meta-9x16", "person").flip, true);
});

test("Headline kleiner nur im 1200x628 stays on that format", () => {
  const step = applyToBook(newBook(), "Headline kleiner nur im 1200x628");
  assert.equal(mergedNudge(step.book.snap, "1200x628", "headline").scale, 0.85);
  assert.equal(mergedNudge(step.book.snap, "1080x1080", "headline").scale, 1);
});

test("the live sentence grows the headline, the waves and the woman", () => {
  const step = applyToBook(newBook(), "Headline deutlich größer, Wellen stärker, Frau etwas größer");
  assert.equal(mergedNudge(step.book.snap, "meta-1x1", "headline").scale, 1.3);
  assert.equal(mergedNudge(step.book.snap, "meta-1x1", "deko").scale, 1.25);
  assert.equal(mergedNudge(step.book.snap, "meta-1x1", "person").scale, 1.15);
  assert.match(step.summary, /Wellen 25 % stärker/);
});

test("an unknown clause is named and the rest still applies", () => {
  const step = applyToBook(newBook(), "Headline etwas größer, blabla");
  assert.equal(step.question, undefined);
  assert.equal(mergedNudge(step.book.snap, "meta-1x1", "headline").scale, 1.15);
  assert.match(step.summary, /nicht verstanden: blabla/);
});

test("the spoken sentences set text, color, scope, deco and versions", () => {
  const cta = applyToBook(newBook(), "CTA: Jetzt wechseln");
  assert.equal(cta.book.snap.fields.button, "Jetzt wechseln");
  const gone = applyToBook(cta.book, "Stern weg");
  assert.equal(mergedNudge(gone.book.snap, "meta-1x1", "stoerer").hidden, true);
  const back = applyToBook(gone.book, "Stern wieder rein mit NUR BIS SONNTAG");
  assert.equal(mergedNudge(back.book.snap, "meta-1x1", "stoerer").hidden, false);
  assert.equal(back.book.snap.fields.sternText, "NUR BIS SONNTAG");
  const lime = applyToBook(back.book, "Unterzeile in Lime");
  assert.equal(lime.book.snap.fields.sublineColor, "#D7EB00");
  const small = applyToBook(lime.book, "Headline kleiner nur im 9x16");
  assert.equal(mergedNudge(small.book.snap, "9x16", "headline").scale, 0.85);
  assert.equal(mergedNudge(small.book.snap, "1080x1080", "headline").scale, 1);
  const moved = applyToBook(small.book, "Kachel etwas höher und Frau deutlich größer");
  assert.equal(mergedNudge(moved.book.snap, "meta-1x1", "kachel").dy, -3);
  assert.equal(mergedNudge(moved.book.snap, "meta-1x1", "person").scale, 1.3);
  const leaves = applyToBook(moved.book, "nimm Blätter statt Wellen");
  assert.equal(leaves.book.snap.fields.deko, "fruehling_blaetter");
  const device = applyToBook(leaves.book, "Gerät statt Person: Galaxy A56, Energielabel B");
  assert.equal(device.book.snap.fields.vorlage, "kachel_geraet");
  assert.equal(device.book.snap.fields.motiv, "Galaxy A56");
  assert.equal(device.book.snap.fields.energielabel, "B");
  const alt = applyToBook(device.book, "Altwert weg");
  assert.equal(alt.book.snap.fields.datenmengeAlt, "");
  const air = applyToBook(alt.book, "mehr Luft zwischen Headline und Kachel");
  assert.equal(mergedNudge(air.book.snap, "meta-1x1", "kachel").dy, 6);
  const square = applyToBook(air.book, "wie im Quadrat");
  assert.match(square.summary, /Quadrat/);
  const restored = applyToBook(square.book, "zurück zu Version 2");
  assert.equal(restored.book.snap.fields.button, "Jetzt wechseln");
  assert.equal(mergedNudge(restored.book.snap, "meta-1x1", "stoerer").hidden, false);
  assert.equal(restored.question, undefined);
});

test("a color outside the palette is a question", () => {
  const step = applyToBook(newBook(), "Unterzeile in Rot");
  assert.match(step.question ?? "", /Markenpalette/);
});

test("the star reply follows the measured diameters", () => {
  const labels = ["1200x1200", "1200x628", "960x1200", "1080x1080", "1080x1920 Meta", "1080x1920 Tiktok"];
  const sample = (label: string, diameter: number, blocked = false) => ({ id: label, label, diameter, blocked });
  const before = labels.map((label) => sample(label, 100));
  const grown = new Set(["1200x628", "1080x1920 Meta", "1080x1920 Tiktok"]);
  const after = labels.map((label) => sample(label, grown.has(label) ? 130 : 100));
  const step = correctStarStep(before, after, 30);
  assert.equal(step.line, "umgesetzt: Störer 30 % größer (außer 1200x1200, 960x1200, 1080x1080: schon maximal)");
  assert.equal(correctStarStep(before, before, 30).line, "nicht möglich: Stern schon maximal groß");
  const covered = labels.map((label) => sample(label, label === "1200x628" ? 140 : 100, label === "1200x628"));
  assert.deepEqual(correctStarStep(before, covered, 30).holdIds, ["1200x628"]);
  const doubled = finishAdjustSummary("umgesetzt: Leiste ist jetzt „Jetzt bestellen“\numgesetzt: Leiste ist jetzt „Jetzt bestellen“");
  assert.equal(doubled, "umgesetzt: Leiste ist jetzt „Jetzt bestellen“");
});

test("the subline sentence keeps the command out of the banner", () => {
  const book = seedBook("rechts", { subline: "ALT", datenmenge: "40 GB" });
  const step = applyToBook(book, "Unterzeile soll JETZT 50 GB SICHERN heißen und mach aus den 40 GB 50 GB");
  assert.equal(step.book.snap.fields.subline, "JETZT 50 GB SICHERN");
  assert.equal(step.book.snap.fields.datenmenge, "50 GB");
  assert.doesNotMatch(step.summary, /nicht verstanden|heißen/);
});

test("the live sentence sets the button, the leaves and a visible star", () => {
  const step = applyToBook(newBook(), "Stern etwas größer, CTA auf 'Jetzt bestellen', Wellen durch Blätter ersetzen und die Unterzeile in Lime");
  assert.match(step.summary, /umgesetzt: Leiste ist jetzt „Jetzt bestellen“/);
  assert.match(step.summary, /umgesetzt: Deko Blätter/);
  assert.match(step.summary, /umgesetzt: Subline neu gefärbt/);
  assert.match(step.summary, /umgesetzt: Störer 15 % größer|Stern schon maximal groß/);
  assert.equal(step.book.snap.fields.button, "Jetzt bestellen");
  assert.equal(step.book.snap.fields.deko, "fruehling_blaetter");
  assert.equal(step.book.snap.fields.sublineColor, "#D7EB00");
  assert.doesNotMatch(step.summary, /nicht verstanden/);
});

test("a model JSON field becomes one command and unknown fields are dropped", () => {
  const button = commandFromModel('{"feld":"button","wert":"Jetzt bestellen"}');
  assert.equal(button?.op, "text");
  assert.equal(button && "text" in button ? button.text : "", "Jetzt bestellen");
  const leaves = commandFromModel('{"feld":"deko","wert":"Blätter"}');
  assert.equal(leaves?.op, "deko_setzen");
  assert.equal(commandFromModel('{"feld":"logo","wert":"weg"}'), undefined);
});

test("rückgängig restores the previous version as a new one", () => {
  const moved = applyToBook(newBook(), "Störer etwas tiefer");
  const back = applyToBook(moved.book, "rückgängig");
  assert.equal(back.question, undefined);
  assert.equal(mergedNudge(back.book.snap, "pmax-1200x1200", "stoerer").dy, 0);
  assert.equal(back.book.version, 3);
  assert.match(back.summary, /wiederhergestellt/);
});

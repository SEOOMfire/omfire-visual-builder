import assert from "node:assert/strict";
import test from "node:test";
import { applyToBook, mergedNudge, newBook } from "../src/modules/visual-builder/server/adjust-commands";

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
});

test("Headline kleiner nur im 1200x628 stays on that format", () => {
  const step = applyToBook(newBook(), "Headline kleiner nur im 1200x628");
  assert.equal(mergedNudge(step.book.snap, "1200x628", "headline").scale, 0.9);
  assert.equal(mergedNudge(step.book.snap, "1080x1080", "headline").scale, 1);
});

test("rückgängig restores the previous version as a new one", () => {
  const moved = applyToBook(newBook(), "Störer etwas tiefer");
  const back = applyToBook(moved.book, "rückgängig");
  assert.equal(back.question, undefined);
  assert.equal(mergedNudge(back.book.snap, "pmax-1200x1200", "stoerer").dy, 0);
  assert.equal(back.book.version, 3);
  assert.match(back.summary, /wiederhergestellt/);
});

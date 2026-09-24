import { test } from "node:test";
import assert from "node:assert/strict";
import { cannotSave, evolved } from "../toasts.ts";

test("evolved names the Tamago and the Stage it reached; cannotSave points at the error log next to the data directory", () => {
  assert.equal(evolved("Mochi", "young"), "Mochi evolved: young!");
  assert.equal(cannotSave("Mochi", "/d"), "Mochi cannot save its progress. See /d/error.log.");
});

test("evolved and cannotSave, in French", () => {
  assert.equal(evolved("Mochi", "young", "m", "fr"), "Mochi évolue : jeune !");
  assert.equal(cannotSave("Mochi", "/d", "fr"), "Mochi n'arrive pas à enregistrer sa progression. Voir /d/error.log.");
});

test("evolved agrees the Stage word with the gender it is given, masculine by default", () => {
  assert.equal(evolved("Mochi", "elder"), "Mochi evolved: elder!", "English does not agree, so the default gender never shows");
  assert.equal(evolved("Nono", "elder", "m", "fr"), "Nono évolue : ancien !");
  assert.equal(evolved("Nono", "elder", "f", "fr"), "Nono évolue : ancienne !");
});

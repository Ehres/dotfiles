import { test } from "node:test";
import assert from "node:assert/strict";
import { cannotSave, evolved } from "../toasts.ts";

test("evolved names the Tamago and the Stage it reached; cannotSave points at the error log next to the data directory", () => {
  assert.equal(evolved("Mochi", "young"), "Mochi evolved: young!");
  assert.equal(cannotSave("Mochi", "/d"), "Mochi cannot save its progress. See /d/error.log.");
});

test("evolved and cannotSave, in French", () => {
  assert.equal(evolved("Mochi", "young", "fr"), "Mochi évolue : jeune !");
  assert.equal(cannotSave("Mochi", "/d", "fr"), "Mochi n'arrive pas à enregistrer sa progression. Voir /d/error.log.");
});

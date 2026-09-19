import { test } from "node:test";
import assert from "node:assert/strict";
import { cannotSave, evolved } from "../toasts.ts";

test("evolved names the Tamago and the Stage it reached; cannotSave points at the error log next to the data directory", () => {
  assert.equal(evolved("Mochi", "young"), "Mochi evolved: young!");
  assert.equal(cannotSave("Mochi", "/d"), "Mochi cannot save its progress. See /d/error.log.");
});

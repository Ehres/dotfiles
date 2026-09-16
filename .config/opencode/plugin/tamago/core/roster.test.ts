import { test } from "node:test";
import assert from "node:assert/strict";
import { idOf } from "./roster.ts";
import { freshCareer } from "./state.ts";

test("a Career is identified by its hatch date", () => {
  assert.equal(idOf(freshCareer(1_700_000_000_000)), 1_700_000_000_000);
});

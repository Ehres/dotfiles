import { test } from "node:test";
import assert from "node:assert/strict";
import { generator, seed } from "./random.ts";

test("seed is stable for the same inputs and differs between domains and hatch dates", () => {
  assert.equal(seed(1, "m"), seed(1, "m"));
  assert.notEqual(seed(1, "m"), seed(1, "n"));
  assert.notEqual(seed(1, "m"), seed(2, "m"));
  assert.ok(Number.isInteger(seed(1, "m")) && seed(1, "m") >= 0 && seed(1, "m") <= 0xffffffff, "a 32-bit unsigned integer");
});

test("seed is pinned: the formula shipped with the Milestones spec must never change", () => {
  // Value computed at the commit that shipped the formula in core/draw.ts. Never update it to make a new formula pass.
  assert.equal(seed(1789113932488, "evolution:hatchling"), 3504696800);
});

test("generator is deterministic for a seed and yields numbers in [0, 1)", () => {
  const a = generator(42);
  const b = generator(42);
  for (let i = 0; i < 100; i++) {
    const value = a();
    assert.equal(value, b());
    assert.ok(value >= 0 && value < 1, `${value}`);
  }
  assert.notEqual(generator(1)(), generator(2)());
});

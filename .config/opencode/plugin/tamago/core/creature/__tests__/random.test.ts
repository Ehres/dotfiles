import { test } from "node:test";
import assert from "node:assert/strict";
import { generator, seed, weighted } from "../random.ts";

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

test("weighted lands on the key whose cumulative weight covers r, in keys order, and on the last key at r = 1", () => {
  const weight = (key: "a" | "b" | "c") => ({ a: 70, b: 25, c: 5 })[key];
  assert.equal(weighted(0, ["a", "b", "c"], weight), "a");
  assert.equal(weighted(0.699, ["a", "b", "c"], weight), "a");
  assert.equal(weighted(0.7, ["a", "b", "c"], weight), "b");
  assert.equal(weighted(0.949, ["a", "b", "c"], weight), "b");
  assert.equal(weighted(0.95, ["a", "b", "c"], weight), "c");
  assert.equal(weighted(1, ["a", "b", "c"], weight), "c", "r = 1 cannot happen from a generator; the last key is the fallback");
});

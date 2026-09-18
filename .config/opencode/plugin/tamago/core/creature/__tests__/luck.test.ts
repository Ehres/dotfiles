import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE_WEIGHTS, COMMON_FLOOR, LUCK_MAX, LUCK_POINTS, LUCK_STEP, weightsAt } from "../luck.ts";
import { RARITIES } from "../species.ts";

const sum = (weights: Record<string, number>): number => Object.values(weights).reduce((total, weight) => total + weight, 0);

test("LUCK_POINTS grow with the Rarity, from one for a common elder", () => {
  assert.deepEqual(LUCK_POINTS, { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 });
});

test("the base weights, the step and the floor are what the spec says", () => {
  assert.deepEqual(BASE_WEIGHTS, { common: 65, uncommon: 25, rare: 10, epic: 0, legendary: 0 });
  assert.deepEqual(LUCK_STEP, { common: -4, uncommon: 1.5, rare: 1, epic: 1, legendary: 0.5 });
  assert.equal(COMMON_FLOOR, 20);
  assert.equal(LUCK_MAX, 11.25);
});

test("weightsAt is pinned to the rows of the spec", () => {
  assert.deepEqual(weightsAt(0), BASE_WEIGHTS);
  assert.deepEqual(weightsAt(1), { common: 61, uncommon: 26.5, rare: 11, epic: 1, legendary: 0.5 });
  assert.deepEqual(weightsAt(2), { common: 57, uncommon: 28, rare: 12, epic: 2, legendary: 1 });
  assert.deepEqual(weightsAt(3), { common: 53, uncommon: 29.5, rare: 13, epic: 3, legendary: 1.5 });
  assert.deepEqual(weightsAt(6), { common: 41, uncommon: 34, rare: 16, epic: 6, legendary: 3 });
});

test("the weights always sum to 100 and every Rarity has a key", () => {
  for (const luck of [0, 1, 2.5, 7, 11, 11.25, 50]) {
    const weights = weightsAt(luck);
    assert.ok(Math.abs(sum(weights) - 100) < 1e-9, `${luck}: ${sum(weights)}`);
    for (const rarity of RARITIES) assert.ok(typeof weights[rarity] === "number", `${luck}/${rarity}`);
  }
});

test("common never falls below the floor: past LUCK_MAX nothing moves, and a negative Luck is the base", () => {
  assert.equal(weightsAt(LUCK_MAX).common, COMMON_FLOOR);
  assert.deepEqual(weightsAt(50), weightsAt(LUCK_MAX));
  assert.deepEqual(weightsAt(1000), weightsAt(LUCK_MAX));
  assert.deepEqual(weightsAt(-3), BASE_WEIGHTS);
});

test("epic and legendary are impossible at Luck 0 and possible from the first point", () => {
  assert.equal(weightsAt(0).epic, 0);
  assert.equal(weightsAt(0).legendary, 0);
  assert.ok(weightsAt(1).epic > 0);
  assert.ok(weightsAt(1).legendary > 0);
});

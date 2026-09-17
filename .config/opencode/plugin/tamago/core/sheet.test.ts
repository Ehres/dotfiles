import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BEHAVIOR_STATS,
  MODIFIER_MAX,
  MODIFIERS_SUM_MAX,
  SCALE,
  STATS,
  TEMPERAMENTS,
  draw,
  factor,
  historical,
  sheet,
  temperamentOf,
  type Sheet,
} from "./sheet.ts";
import type { Species } from "./species.ts";

/** Ten thousand hatch dates a second apart, the range the Temperament test always used. */
const DATES = Array.from({ length: 10_000 }, (_, i) => 1_789_000_000_000 + i * 1_000);

test("the scale and the bounds are what the spec says", () => {
  assert.deepEqual(SCALE, { min: 0, max: 10, median: 5, high: 6 });
  assert.equal(MODIFIER_MAX, 3);
  assert.equal(MODIFIERS_SUM_MAX, 8);
  assert.deepEqual(TEMPERAMENTS, ["cheerful", "sarcastic", "stoic", "dreamy"]);
  assert.deepEqual(STATS, ["cheerful", "sarcastic", "stoic", "dreamy", "energy", "chatter", "sensitivity", "patience"]);
  assert.deepEqual(BEHAVIOR_STATS, ["energy", "chatter", "sensitivity", "patience"]);
});

test("historical is pinned and spread over the four Temperaments", () => {
  // The owner's Tamago, pinned so the hash never silently changes. Moved from character.test.ts.
  assert.equal(historical(1789113932488), "cheerful");
  const counts: Record<string, number> = {};
  for (const t of DATES) counts[historical(t)] = (counts[historical(t)] ?? 0) + 1;
  for (const value of TEMPERAMENTS) assert.ok((counts[value] ?? 0) >= 1500, `${value} was only ${counts[value] ?? 0} of 10000`);
});

test("draw is deterministic and pinned", () => {
  assert.deepEqual(draw(1789113932488), draw(1789113932488));
  // Values computed once at the commit that shipped the draw. Never update them to make a new formula pass.
  assert.deepEqual(draw(1789113932488), { cheerful: 8, sarcastic: 5, stoic: 7, dreamy: 5, energy: 5, chatter: 9, sensitivity: 1, patience: 6 });
  assert.deepEqual(draw(0), { cheerful: 10, sarcastic: 4, stoic: 4, dreamy: 8, energy: 0, chatter: 8, sensitivity: 4, patience: 8 });
});

test("every Stat is an integer on the scale; the historical one is high and strictly above the other three", () => {
  for (const t of DATES) {
    const s = draw(t);
    const high = historical(t);
    for (const stat of STATS) {
      assert.ok(Number.isInteger(s[stat]), `${t} ${stat} ${s[stat]}`);
      assert.ok(s[stat] >= SCALE.min && s[stat] <= SCALE.max, `${t} ${stat} ${s[stat]}`);
    }
    assert.ok(s[high] >= SCALE.high, `${t} ${high} ${s[high]}`);
    for (const stat of TEMPERAMENTS) if (stat !== high) assert.ok(s[stat] < s[high], `${t} ${stat} ${s[stat]} vs ${high} ${s[high]}`);
  }
});

test("behavior Stats reach every value of the scale over ten thousand dates", () => {
  const seen: Record<string, Set<number>> = {};
  for (const t of DATES) {
    const s = draw(t);
    for (const stat of BEHAVIOR_STATS) (seen[stat] ??= new Set()).add(s[stat]);
  }
  for (const stat of BEHAVIOR_STATS) assert.equal(seen[stat]?.size, SCALE.max - SCALE.min + 1, stat);
});

test("without Modifiers the Sheet gives back the historical Temperament", () => {
  for (const t of DATES) assert.equal(temperamentOf(draw(t)), historical(t), `${t}`);
});

test("temperamentOf breaks a tie by TEMPERAMENTS order", () => {
  const tie: Sheet = { cheerful: 5, sarcastic: 7, stoic: 7, dreamy: 7, energy: 5, chatter: 5, sensitivity: 5, patience: 5 };
  assert.equal(temperamentOf(tie), "sarcastic");
  assert.equal(temperamentOf({ ...tie, dreamy: 8 }), "dreamy");
});

/** A table for these tests: the reference without Modifiers, one Species that pushes, one whose push is out of reach. */
const table: readonly Species[] = [
  { id: "cat", label: "cat", rarity: "common" },
  { id: "pusher", label: "pusher", rarity: "common", sheet: { stoic: 2, cheerful: -1, energy: 3, chatter: -3 } },
  { id: "always", label: "always", rarity: "common", sheet: { stoic: 12 } },
];

test("sheet adds the Modifiers of the Species; behavior Stats are clamped, Temperament Stats are not", () => {
  const owner = sheet(1789113932488, "pusher", table); // draw: stoic 7, cheerful 8, energy 5, chatter 9
  assert.equal(owner.stoic, 9);
  assert.equal(owner.cheerful, 7);
  assert.equal(owner.energy, 8);
  assert.equal(owner.chatter, 6);
  assert.equal(owner.patience, draw(1789113932488).patience, "a Stat without Modifier is the draw");
  const low = sheet(1_000_015, "pusher", table); // draw: energy 0, chatter 0
  assert.equal(low.energy, 3);
  assert.equal(low.chatter, SCALE.min, "clamped below");
  const high = sheet(1_000_033, "pusher", table); // draw: energy 10
  assert.equal(high.energy, SCALE.max, "clamped above");
  assert.equal(sheet(1_000_033, "always", table).stoic, draw(1_000_033).stoic + 12, "Temperament Stats are not clamped");
});

test("a Modifier out of reach makes a Temperament certain; a small one only weighs", () => {
  for (const t of DATES.slice(0, 1_000)) assert.equal(temperamentOf(sheet(t, "always", table)), "stoic", `${t}`);
  let flipped = 0;
  for (const t of DATES) if (temperamentOf(sheet(t, "pusher", table)) !== historical(t)) flipped++;
  assert.ok(flipped > 500 && flipped < 3_500, `${flipped} of 10000 flipped`);
});

test("an unknown Species, and the reference, give the bare draw", () => {
  assert.deepEqual(sheet(0, "nope", table), draw(0));
  assert.deepEqual(sheet(0, "cat", table), draw(0));
});

test("factor halves at min, is 1 at median, doubles at max, and grows", () => {
  assert.equal(factor(SCALE.min), 0.5);
  assert.equal(factor(SCALE.median), 1);
  assert.equal(factor(SCALE.max), 2);
  for (let v = SCALE.min; v < SCALE.max; v++) assert.ok(factor(v) < factor(v + 1), `${v}`);
});

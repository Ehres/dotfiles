import { test } from "node:test";
import assert from "node:assert/strict";
import { RARITIES, RARITY, REFERENCE, SPECIES, hatch, pace, species, type Species } from "./species.ts";
import { MODIFIERS_SUM_MAX, MODIFIER_MAX } from "./sheet.ts";

/** One Species per Rarity, so every tier can be drawn. */
const full: readonly Species[] = RARITIES.map((rarity) => ({ id: `s-${rarity}`, label: rarity, rarity }));

test("RARITY weights are positive and paces decrease from common at 1", () => {
  assert.equal(RARITY.common.pace, 1);
  for (let i = 0; i < RARITIES.length; i++) {
    const rarity = RARITIES[i]!;
    assert.ok(RARITY[rarity].weight > 0, `${rarity} weight`);
    assert.ok(RARITY[rarity].pace > 0 && RARITY[rarity].pace <= 1, `${rarity} pace`);
    if (i > 0) assert.ok(RARITY[rarity].pace < RARITY[RARITIES[i - 1]!].pace, `${rarity} slower than the one before`);
  }
});

test("SPECIES ids are unique and REFERENCE is a common one", () => {
  assert.equal(new Set(SPECIES.map((entry) => entry.id)).size, SPECIES.length);
  assert.equal(species(REFERENCE).rarity, "common");
  assert.ok(SPECIES.some((entry) => entry.id === REFERENCE));
});

test("species and pace fall back to the reference for an unknown id", () => {
  assert.equal(species("owl").label, "owl");
  assert.equal(species("owl").rarity, "common");
  assert.deepEqual(species("nope"), species(REFERENCE));
  assert.equal(pace("dragon"), RARITY.legendary.pace);
  assert.equal(pace("nope"), 1);
});

test("hatch is deterministic and returns an id of the table", () => {
  assert.equal(hatch(1789113932488), hatch(1789113932488));
  for (let t = 0; t < 200; t++) assert.ok(SPECIES.some((entry) => entry.id === hatch(t)), `${t}`);
});

test("hatch always returns the reference when the table holds only it", () => {
  const only: readonly Species[] = [species(REFERENCE)];
  for (let t = 0; t < 1000; t++) assert.equal(hatch(t * 997, only), REFERENCE);
});

test("hatch falls back to the next less rare Rarity when the drawn one is empty", () => {
  // With one Species per Rarity, find a hatch date that draws legendary; then remove legendary and epic and expect rare.
  let legendary: number | undefined;
  for (let t = 0; t < 100_000 && legendary === undefined; t++) if (hatch(t, full) === "s-legendary") legendary = t;
  assert.notEqual(legendary, undefined, "some date in 100k draws legendary at 1%");
  const withoutTop = full.filter((entry) => entry.rarity !== "legendary" && entry.rarity !== "epic");
  assert.equal(hatch(legendary!, withoutTop), "s-rare");
});

test("hatch lands on each Rarity within a loose band of its weight over ten thousand dates", () => {
  const counts: Record<string, number> = {};
  for (let i = 0; i < 10_000; i++) {
    const rarity = species(hatch(1_789_000_000_000 + i * 1000, full), full).rarity;
    counts[rarity] = (counts[rarity] ?? 0) + 1;
  }
  const total = RARITIES.reduce((sum, rarity) => sum + RARITY[rarity].weight, 0);
  for (const rarity of RARITIES) {
    const expected = (10_000 * RARITY[rarity].weight) / total;
    const seen = counts[rarity] ?? 0;
    assert.ok(seen > expected * 0.5 && seen < expected * 1.5 + 30, `${rarity}: ${seen} for ${expected} expected`);
  }
});

test("hatch is pinned: the owner's hatch date always gives the same Species", () => {
  // Values computed once at the commit that shipped the draw. Never update them to make a new formula pass.
  assert.equal(hatch(1789113932488), "cat");
  assert.equal(hatch(1789113932489), "owl");
  assert.equal(hatch(1789113932549), "dragon");
});

test("Modifiers stay within bounds on every Species, and the reference has none", () => {
  for (const entry of SPECIES) {
    const values = Object.values(entry.sheet ?? {});
    for (const value of values) assert.ok(Number.isInteger(value) && Math.abs(value) <= MODIFIER_MAX, `${entry.id}: ${value}`);
    const sum = values.reduce((total, value) => total + Math.abs(value), 0);
    assert.ok(sum <= MODIFIERS_SUM_MAX, `${entry.id}: ${sum} in absolute value`);
  }
  assert.equal(species(REFERENCE).sheet, undefined, "the reference never weighs: every Career from before the Sheet stays as it was");
});

test("owl and dragon carry the Modifiers of the spec", () => {
  assert.deepEqual(species("owl").sheet, { stoic: 2, cheerful: -1, energy: -2, chatter: -1, patience: 2 });
  assert.deepEqual(species("dragon").sheet, { sarcastic: 3, sensitivity: -2, energy: 2 });
});

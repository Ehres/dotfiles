import { test } from "node:test";
import assert from "node:assert/strict";
import { LUCK_MAX, weightsAt } from "../luck.ts";
import { RARITIES, RARITY, REFERENCE, SPECIES, hatch, pace, species, type Rarity, type Species } from "../species.ts";
import { MODIFIERS_SUM_MAX, MODIFIER_MAX, type Modifiers } from "../sheet.ts";

/** One Species per Rarity, so every tier can be drawn. */
const full: readonly Species[] = RARITIES.map((rarity) => ({ id: `s-${rarity}`, label: rarity, rarity }));

/** The table and the weights of the commit that shipped the draw, frozen: the pin below is about the formula, never about the data. */
const ORIGINAL: readonly Species[] = [
  { id: "cat", label: "cat", rarity: "common" },
  { id: "owl", label: "owl", rarity: "common" },
  { id: "dragon", label: "dragon", rarity: "legendary" },
];
const ORIGINAL_WEIGHTS: Record<Rarity, number> = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };

/** The Rarity counts of ten thousand hatch dates against `table` at `weights`. */
function tally(table: readonly Species[], weights: Record<Rarity, number>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i < 10_000; i++) {
    const rarity = species(hatch(1_789_000_000_000 + i * 1000, table, weights), table).rarity;
    counts[rarity] = (counts[rarity] ?? 0) + 1;
  }
  return counts;
}

test("paces decrease from common at 1", () => {
  assert.equal(RARITY.common.pace, 1);
  for (let i = 0; i < RARITIES.length; i++) {
    const rarity = RARITIES[i]!;
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
  // With one Species per Rarity and the original weights, find a date that draws legendary; then remove legendary and epic and expect rare.
  let legendary: number | undefined;
  for (let t = 0; t < 100_000 && legendary === undefined; t++) if (hatch(t, full, ORIGINAL_WEIGHTS) === "s-legendary") legendary = t;
  assert.notEqual(legendary, undefined, "some date in 100k draws legendary at 1%");
  const withoutTop = full.filter((entry) => entry.rarity !== "legendary" && entry.rarity !== "epic");
  assert.equal(hatch(legendary!, withoutTop, ORIGINAL_WEIGHTS), "s-rare");
});

test("hatch lands on each Rarity within a loose band of its weight, at three Lucks, over ten thousand dates", () => {
  for (const luck of [0, 3, 11]) {
    const weights = weightsAt(luck);
    const counts = tally(full, weights);
    const total = RARITIES.reduce((sum, rarity) => sum + weights[rarity], 0);
    for (const rarity of RARITIES) {
      const expected = (10_000 * weights[rarity]) / total;
      const seen = counts[rarity] ?? 0;
      if (expected === 0) assert.equal(seen, 0, `Luck ${luck}/${rarity}: a zero weight never lands`);
      else assert.ok(seen > expected * 0.5 && seen < expected * 1.5 + 30, `Luck ${luck}/${rarity}: ${seen} for ${expected} expected`);
    }
  }
});

test("the default weights are those of Luck 0: no epic, no legendary on a first egg", () => {
  const counts = tally(full, weightsAt(0));
  assert.equal(counts.epic ?? 0, 0);
  assert.equal(counts.legendary ?? 0, 0);
  for (let t = 0; t < 2000; t++) assert.equal(hatch(t * 4093, full), hatch(t * 4093, full, weightsAt(0)));
});

test("at LUCK_MAX every Species of the table is drawn over ten thousand dates", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 10_000; i++) seen.add(hatch(1_789_000_000_000 + i * 1000, SPECIES, weightsAt(LUCK_MAX)));
  for (const entry of SPECIES) assert.ok(seen.has(entry.id), `${entry.id} never hatched`);
});

test("hatch is pinned: the owner's hatch date always gives the same Species", () => {
  // Values computed once at the commit that shipped the draw, against the table and the weights of that commit. Never update them to make a new formula pass.
  assert.equal(hatch(1789113932488, ORIGINAL, ORIGINAL_WEIGHTS), "cat");
  assert.equal(hatch(1789113932489, ORIGINAL, ORIGINAL_WEIGHTS), "owl");
  assert.equal(hatch(1789113932549, ORIGINAL, ORIGINAL_WEIGHTS), "dragon");
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

/** The Modifiers of the spec, pinned per Species. Once a Species has hatched anywhere, its line here and in SPECIES must never change. */
const MODIFIERS: Record<string, Modifiers | undefined> = {
  cat: undefined,
  owl: { stoic: 2, cheerful: -1, energy: -2, chatter: -1, patience: 2 },
  frog: { stoic: 1, energy: -1, patience: 1 },
  duck: { cheerful: 2, chatter: 1 },
  hamster: { energy: 2, patience: -1 },
  snail: { dreamy: 1, energy: -2, patience: 2 },
  fox: { sarcastic: 2, energy: 1, sensitivity: 1 },
  penguin: { stoic: 2, chatter: 1 },
  octopus: { dreamy: 2, chatter: 1, sensitivity: -1 },
  bat: { energy: 2, chatter: -2, sensitivity: 1 },
  hedgehog: { sensitivity: 2, chatter: -1, stoic: 1 },
  axolotl: { cheerful: 1, sensitivity: -2, patience: 1 },
  robot: { stoic: 3, sensitivity: -2, energy: 1 },
  ghost: { dreamy: 3, chatter: -2, energy: -1 },
  jellyfish: { dreamy: 2, sensitivity: 2, energy: -1 },
  chameleon: { sarcastic: 2, patience: 2, chatter: -1 },
  phoenix: { cheerful: 3, sensitivity: -3, energy: 1 },
  kraken: { sarcastic: 2, stoic: 2, sensitivity: 2, patience: -1 },
  unicorn: { dreamy: 3, cheerful: 2, chatter: 1 },
  dragon: { sarcastic: 3, sensitivity: -2, energy: 2 },
};

test("every Species carries the Modifiers of the spec, and the spec names every Species of the table", () => {
  assert.deepEqual(Object.keys(MODIFIERS).sort(), SPECIES.map((entry) => entry.id).sort());
  for (const entry of SPECIES) assert.deepEqual(entry.sheet, MODIFIERS[entry.id], entry.id);
});

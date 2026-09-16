import { test } from "node:test";
import assert from "node:assert/strict";
import { merge } from "./merge.ts";
import { EMPTY_DELTA, freshCareer, type Delta } from "./state.ts";

const d1: Delta = { ...EMPTY_DELTA, prompts: 1, tools: { read: 2, edit: 0, bash: 0, other: 0 } };
const d2: Delta = { ...EMPTY_DELTA, sessions: 1, tools: { read: 0, edit: 0, bash: 5, other: 1 } };
const d3: Delta = { ...EMPTY_DELTA, filesEdited: 3, errors: 2 };

test("merge adds counters and preserves hatchedAt", () => {
  const career = merge(freshCareer(777), d1);
  assert.equal(career.hatchedAt, 777);
  assert.equal(career.prompts, 1);
  assert.equal(career.tools.read, 2);
});

test("merge is commutative over deltas", () => {
  const base = freshCareer(1);
  assert.deepEqual(merge(merge(base, d1), d2), merge(merge(base, d2), d1));
});

test("merge is associative over deltas", () => {
  const base = freshCareer(1);
  const left = merge(merge(merge(base, d1), d2), d3);
  const right = merge(merge(merge(base, d3), d1), d2);
  assert.deepEqual(left, right);
});

test("merging the empty delta is the identity", () => {
  const career = merge(freshCareer(5), d2);
  assert.deepEqual(merge(career, EMPTY_DELTA), career);
});

const r1: Delta = { ...EMPTY_DELTA, rename: { value: "Pixel", at: 10 } };
const r2: Delta = { ...EMPTY_DELTA, rename: { value: "Mochi", at: 20 } };

test("the latest rename wins whatever the merge order, and an older one never overrides", () => {
  const base = freshCareer(1);
  assert.deepEqual(merge(merge(base, r1), r2), merge(merge(base, r2), r1));
  assert.deepEqual(merge(merge(base, r2), r1).name, { value: "Mochi", at: 20 });
  assert.deepEqual(merge(merge(base, r1), d1).name, { value: "Pixel", at: 10 }, "counters leave the name alone");
});

const k1: Delta = { ...EMPTY_DELTA, picks: { "evolution:hatchling": { trait: "sarcastic", at: 10 } } };
const k2: Delta = { ...EMPTY_DELTA, picks: { "evolution:hatchling": { trait: "stoic", at: 20 }, "sessions:100": { trait: "hat", at: 30 } } };

test("the earliest pick wins whatever the merge order, and a later one never overrides", () => {
  const base = freshCareer(1);
  assert.deepEqual(merge(merge(base, k1), k2), merge(merge(base, k2), k1));
  assert.deepEqual(merge(merge(base, k2), k1).picks, {
    "evolution:hatchling": { trait: "sarcastic", at: 10 },
    "sessions:100": { trait: "hat", at: 30 },
  });
});

test("counters leave the picks alone and picks leave the name alone", () => {
  const base = freshCareer(1);
  assert.deepEqual(merge(merge(base, k1), d1).picks, k1.picks);
  assert.deepEqual(merge(merge(base, r1), k1).name, { value: "Pixel", at: 10 });
  assert.equal("rename" in merge(base, k1), false, "a Career never carries a pending rename");
});

test("merging a delta without picks keeps the very same picks object", () => {
  const career = merge(freshCareer(1), k1);
  assert.equal(merge(career, d1).picks, career.picks);
});

test("a fresh career merged with the empty delta has empty picks", () => {
  assert.deepEqual(merge(freshCareer(1), EMPTY_DELTA).picks, {});
});

test("merge keeps the species of the career whatever the delta", () => {
  const career = { ...freshCareer(777), species: "dragon" };
  assert.equal(merge(career, d1).species, "dragon");
  assert.equal(merge(career, EMPTY_DELTA).species, "dragon");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { CAREER_KEYS, EMPTY_DELTA, addDelta, freshCareer, isEmpty, merge, sameCareer, type Delta } from "../career.ts";
import { hydrate } from "../hydrate.ts";
import { REFERENCE, hatch } from "../../creature/species.ts";

test("freshCareer is all zeros hatched now", () => {
  const career = freshCareer(1000);
  assert.equal(career.hatchedAt, 1000);
  assert.equal(career.sessions, 0);
  assert.equal(career.tools.edit, 0);
});

test("isEmpty is true only for the zero delta", () => {
  assert.equal(isEmpty(EMPTY_DELTA), true);
  assert.equal(isEmpty({ ...EMPTY_DELTA, prompts: 1 }), false);
  assert.equal(isEmpty({ ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools, bash: 1 } }), false);
});

test("addDelta sums every counter including nested tools", () => {
  const a = { ...EMPTY_DELTA, prompts: 2, tools: { read: 1, edit: 0, bash: 3, other: 0 } };
  const b = { ...EMPTY_DELTA, prompts: 1, filesEdited: 4, tools: { read: 0, edit: 2, bash: 1, other: 0 } };
  assert.deepEqual(addDelta(a, b), {
    sessions: 0,
    prompts: 3,
    tools: { read: 1, edit: 2, bash: 4, other: 0 },
    filesEdited: 4,
    errors: 0,
    questions: 0,
  });
});

test("addDelta does not mutate its inputs", () => {
  const a = { ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools } };
  addDelta(a, { ...EMPTY_DELTA, prompts: 5 });
  assert.deepEqual(a, EMPTY_DELTA);
});

test("sameCareer compares every counter and the hatch date", () => {
  const a = { ...freshCareer(1), prompts: 3, tools: { read: 1, edit: 2, bash: 0, other: 0 } };
  assert.equal(sameCareer(a, { ...a, tools: { ...a.tools } }), true, "structurally equal copies are the same");
  assert.equal(sameCareer(a, { ...a, prompts: 4 }), false);
  assert.equal(sameCareer(a, { ...a, tools: { ...a.tools, bash: 1 } }), false);
  assert.equal(sameCareer(a, { ...a, hatchedAt: 2 }), false);
});

test("a rename alone makes a delta non-empty, and addDelta keeps the latest one", () => {
  const rename = { ...EMPTY_DELTA, rename: { value: "Pixel", at: 10 } };
  assert.equal(isEmpty(rename), false);
  const later = { ...EMPTY_DELTA, rename: { value: "Mochi", at: 20 } };
  assert.deepEqual(addDelta(rename, later).rename, { value: "Mochi", at: 20 });
  assert.deepEqual(addDelta(later, rename).rename, { value: "Mochi", at: 20 });
  assert.equal(addDelta(EMPTY_DELTA, EMPTY_DELTA).rename, undefined);
});

test("sameCareer compares the name", () => {
  const a = { ...freshCareer(1), name: { value: "Pixel", at: 3 } };
  assert.equal(sameCareer(a, { ...a }), true);
  assert.equal(sameCareer(a, { ...a, name: { value: "Mochi", at: 3 } }), false);
  assert.equal(sameCareer(a, { ...a, name: { value: "Pixel", at: 4 } }), false);
  assert.equal(sameCareer(a, freshCareer(1)), false);
});

test("questions is a counter like the others", () => {
  assert.equal(EMPTY_DELTA.questions, 0);
  assert.equal(isEmpty({ ...EMPTY_DELTA, questions: 1 }), false);
  assert.equal(addDelta({ ...EMPTY_DELTA, questions: 2 }, { ...EMPTY_DELTA, questions: 3 }).questions, 5);
  assert.equal(hydrate({ questions: 4 }, 0).career.questions, 4);
  assert.equal(hydrate({}, 0).career.questions, 0, "today's career.json has no questions field");
  const a = { ...freshCareer(1), questions: 1 };
  assert.equal(sameCareer(a, { ...a }), true);
  assert.equal(sameCareer(a, { ...a, questions: 2 }), false);
});

test("freshCareer has no picks", () => {
  assert.deepEqual(freshCareer(1).picks, {});
});

test("a pick alone makes a delta non-empty", () => {
  assert.equal(isEmpty({ ...EMPTY_DELTA, picks: { m: { trait: "x", at: 1 } } }), false);
  assert.equal(isEmpty({ ...EMPTY_DELTA, picks: {} }), true, "an empty picks record is still empty");
});

test("addDelta merges picks first-wins and omits the key when there is none", () => {
  const early = { ...EMPTY_DELTA, picks: { m: { trait: "early", at: 10 } } };
  const late = { ...EMPTY_DELTA, picks: { m: { trait: "late", at: 20 }, n: { trait: "hat", at: 5 } } };
  const expected = { m: { trait: "early", at: 10 }, n: { trait: "hat", at: 5 } };
  assert.deepEqual(addDelta(early, late).picks, expected);
  assert.deepEqual(addDelta(late, early).picks, expected);
  assert.equal("picks" in addDelta(EMPTY_DELTA, EMPTY_DELTA), false);
  assert.equal("picks" in addDelta({ ...EMPTY_DELTA, picks: {} }, EMPTY_DELTA), false);
  assert.equal(addDelta(early, { ...EMPTY_DELTA, prompts: 1 }).prompts, 1, "counters still add up beside picks");
});

test("sameCareer compares the picks", () => {
  const a = { ...freshCareer(1), picks: { m: { trait: "x", at: 1 } } };
  assert.equal(sameCareer(a, { ...a, picks: { m: { trait: "x", at: 1 } } }), true);
  assert.equal(sameCareer(a, { ...a, picks: { m: { trait: "y", at: 1 } } }), false);
  assert.equal(sameCareer(a, { ...a, picks: { m: { trait: "x", at: 2 } } }), false);
  assert.equal(sameCareer(a, { ...a, picks: { m: { trait: "x", at: 1 }, n: { trait: "z", at: 3 } } }), false);
  assert.equal(sameCareer(a, freshCareer(1)), false);
});

test("CAREER_KEYS names every key a hydrated Career can carry", () => {
  const full = hydrate(
    { sessions: 1, prompts: 1, tools: { read: 1 }, filesEdited: 1, errors: 1, questions: 1, hatchedAt: 1, name: { value: "x", at: 1 }, picks: { m: { trait: "t", at: 1 } } },
    0,
  ).career;
  for (const key of Object.keys(full)) assert.ok(CAREER_KEYS.includes(key as keyof typeof full), `${key} missing from CAREER_KEYS`);
});

test("freshCareer draws its species from the hatch date", () => {
  assert.equal(freshCareer(1000).species, hatch(1000));
  assert.equal(freshCareer(1000).species, freshCareer(1000).species);
});

test("CAREER_KEYS lists species", () => {
  assert.ok(CAREER_KEYS.includes("species"));
});

test("sameCareer compares the species", () => {
  const a = freshCareer(1);
  assert.equal(sameCareer(a, { ...a }), true);
  assert.equal(sameCareer(a, { ...a, species: "some-other" }), false);
});

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

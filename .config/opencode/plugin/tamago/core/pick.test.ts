import { test } from "node:test";
import assert from "node:assert/strict";
import { first, firstPicks, hydratePicks, samePicks, type Pick, type Picks } from "./pick.ts";

const early: Pick = { trait: "sarcastic", at: 10 };
const late: Pick = { trait: "stoic", at: 20 };

test("first keeps the earlier Pick whatever the order", () => {
  assert.equal(first(early, late), early);
  assert.equal(first(late, early), early);
});

test("first breaks a tie on the smaller trait id, so it is commutative", () => {
  const a: Pick = { trait: "b", at: 5 };
  const b: Pick = { trait: "a", at: 5 };
  assert.equal(first(a, b), b);
  assert.equal(first(b, a), b);
});

test("first returns the other side when one is undefined", () => {
  assert.equal(first(undefined, late), late);
  assert.equal(first(early, undefined), early);
  assert.equal(first(undefined, undefined), undefined);
});

const p1: Picks = { "evolution:hatchling": early };
const p2: Picks = { "evolution:hatchling": late, "sessions:100": { trait: "hat", at: 30 } };
const p3: Picks = { "tools:1000": { trait: "aura", at: 40 } };

test("firstPicks unions by Milestone and keeps the earlier Pick on shared keys", () => {
  assert.deepEqual(firstPicks(p1, p2), { "evolution:hatchling": early, "sessions:100": { trait: "hat", at: 30 } });
});

test("firstPicks is commutative, associative and idempotent", () => {
  assert.deepEqual(firstPicks(p1, p2), firstPicks(p2, p1));
  assert.deepEqual(firstPicks(firstPicks(p1, p2), p3), firstPicks(p1, firstPicks(p2, p3)));
  assert.deepEqual(firstPicks(p2, p2), p2);
});

test("firstPicks returns its first argument itself when the second changes nothing", () => {
  assert.equal(firstPicks(p1, {}), p1);
  const merged = firstPicks(p1, p2);
  assert.equal(firstPicks(merged, p1), merged, "an equal Pick already held is not a change");
  assert.equal(firstPicks(merged, p2), merged, "a later Pick for a held Milestone is not a change");
  assert.equal(firstPicks(p1, { "evolution:hatchling": { ...early } }), p1, "an equal Pick is not a change");
});

test("a later Pick never overrides an earlier one, in either order", () => {
  const held = firstPicks(p1, p2);
  assert.deepEqual(held["evolution:hatchling"], early);
  assert.deepEqual(firstPicks(p2, p1)["evolution:hatchling"], early);
});

test("firstPicks does not mutate its inputs", () => {
  const a: Picks = { m: { trait: "x", at: 1 } };
  const b: Picks = { n: { trait: "y", at: 2 } };
  firstPicks(a, b);
  assert.deepEqual(a, { m: { trait: "x", at: 1 } });
  assert.deepEqual(b, { n: { trait: "y", at: 2 } });
});

test("samePicks compares keys, trait and at", () => {
  assert.equal(samePicks(p2, { ...p2 }), true);
  assert.equal(samePicks({}, {}), true);
  assert.equal(samePicks(p1, p2), false, "different key sets");
  assert.equal(samePicks(p1, { "evolution:hatchling": { trait: "stoic", at: 10 } }), false, "different trait");
  assert.equal(samePicks(p1, { "evolution:hatchling": { trait: "sarcastic", at: 11 } }), false, "different at");
  assert.equal(samePicks(p1, { "sessions:100": early }), false, "same size, different keys");
});

test("hydratePicks gives {} for a missing, non-record or empty value", () => {
  for (const raw of [undefined, null, "x", 3, [], {}]) assert.deepEqual(hydratePicks(raw), {}, `raw=${JSON.stringify(raw)}`);
});

test("hydratePicks keeps well-formed entries and drops the rest silently", () => {
  const raw = {
    "evolution:hatchling": { trait: "sarcastic", at: 10 },
    "": { trait: "orphan", at: 1 },
    "bad-trait": { trait: "", at: 2 },
    "bad-type": { trait: 4, at: 3 },
    "bad-at": { trait: "stoic", at: "4" },
    "nan-at": { trait: "stoic", at: Number.NaN },
    "not-a-record": "stoic",
  };
  assert.deepEqual(hydratePicks(raw), { "evolution:hatchling": { trait: "sarcastic", at: 10 } });
});

test("hydratePicks drops a __proto__ key instead of setting the prototype", () => {
  const picks = hydratePicks(JSON.parse('{"__proto__":{"trait":"evil","at":1},"m":{"trait":"ok","at":2}}'));
  assert.deepEqual(picks, { m: { trait: "ok", at: 2 } });
  assert.equal(Object.getPrototypeOf(picks), Object.prototype);
  assert.equal((picks as Record<string, unknown>)["trait"], undefined);
});

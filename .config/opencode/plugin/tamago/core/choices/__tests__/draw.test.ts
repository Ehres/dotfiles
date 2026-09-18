import { test } from "node:test";
import assert from "node:assert/strict";
import { DRAW_SIZE, draw, pending } from "../draw.ts";
import { seed } from "../../creature/random.ts";
import type { Milestone } from "../milestone.ts";
import { freshCareer, type Career } from "../../career/career.ts";
import { eligible, type Trait } from "../trait.ts";

/** Eight starter Traits: a pool large enough that two Milestones almost surely shuffle it differently. */
const table: readonly Trait[] = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => ({ id, needs: [] }));
const gated: readonly Trait[] = [...table, { id: "z", needs: ["a", "b"] }];

const milestones: readonly Milestone[] = [
  { id: "evolution:hatchling", stage: "hatchling" },
  { id: "sessions:100", measure: "sessions", min: 100 },
  { id: "evolution:young", stage: "young" },
];

const career = (patch: Partial<Career> = {}): Career => ({ ...freshCareer(1_700_000_000_000), ...patch });

test("seed and draw are pinned: changing the formula would change every pending Draw on every machine", () => {
  // Values computed at the commit that shipped the formula. Never update them to make a new formula pass.
  assert.equal(seed(1789113932488, "evolution:hatchling"), 3504696800);
  assert.deepEqual(draw(career(), "evolution:hatchling", table), ["g", "c", "f"]);
});

test("draw is deterministic: the same Career and Milestone give the same Draw", () => {
  assert.deepEqual(draw(career(), "evolution:hatchling", table), draw(career(), "evolution:hatchling", table));
});

test("draw offers at most DRAW_SIZE Traits, all eligible, with no repeat", () => {
  const offered = draw(career(), "evolution:hatchling", table);
  assert.equal(offered.length, DRAW_SIZE);
  assert.equal(new Set(offered).size, offered.length);
  const pool = eligible(career(), table);
  for (const trait of offered) assert.ok(pool.includes(trait), `${trait} is eligible`);
});

test("draw offers what exists when fewer than DRAW_SIZE Traits are eligible, and nothing when none is", () => {
  const two: readonly Trait[] = [{ id: "a", needs: [] }, { id: "b", needs: [] }];
  assert.deepEqual([...draw(career(), "m", two)].sort(), ["a", "b"]);
  assert.deepEqual(draw(career(), "m", []), []);
  const allHeld = career({ picks: { m1: { trait: "a", at: 1 }, m2: { trait: "b", at: 2 } } });
  assert.deepEqual(draw(allHeld, "m", two), []);
});

test("two Milestones shuffle the same pool differently", () => {
  // Deterministic, so this either always passes or always fails. If it fails,
  // the two seeds happen to order eight Traits the same way: change one id
  // below (say "sessions:100" to "sessions:200") and keep the test.
  assert.notDeepEqual(draw(career(), "evolution:hatchling", table), draw(career(), "sessions:100", table));
});

test("draw never offers a held Trait and offers a newly unlocked one", () => {
  const held = career({ picks: { m1: { trait: "a", at: 1 }, m2: { trait: "b", at: 2 } } });
  const offered = draw(held, "evolution:young", gated);
  assert.ok(!offered.includes("a") && !offered.includes("b"));
  assert.deepEqual([...eligible(held, gated)].sort(), ["c", "d", "e", "f", "g", "h", "z"]);
});

test("pending lists reached Milestones without a Pick, with their Draw, in table order", () => {
  const young = career({ sessions: 150 }); // 1,500 XP: young, past hatchling and 100 sessions
  const result = pending(young, milestones, table);
  assert.deepEqual(
    result.map((entry) => entry.milestone.id),
    ["evolution:hatchling", "sessions:100", "evolution:young"],
  );
  for (const entry of result) assert.deepEqual(entry.draw, draw(young, entry.milestone.id, table));
});

test("pending skips Milestones that have a Pick", () => {
  const picked = career({ sessions: 150, picks: { "sessions:100": { trait: "a", at: 1 } } });
  assert.deepEqual(
    pending(picked, milestones, table).map((entry) => entry.milestone.id),
    ["evolution:hatchling", "evolution:young"],
  );
});

test("pending skips Milestones not yet reached", () => {
  assert.deepEqual(pending(career({ sessions: 20 }), milestones, table).map((entry) => entry.milestone.id), ["evolution:hatchling"]);
  assert.deepEqual(pending(career(), milestones, table), []);
});

test("a Milestone whose Draw is empty is settled, not pending", () => {
  const one: readonly Trait[] = [{ id: "a", needs: [] }];
  const holdsIt = career({ sessions: 150, picks: { "evolution:hatchling": { trait: "a", at: 1 } } });
  assert.deepEqual(pending(holdsIt, milestones, one), []);
});

test("with the shipped tables nothing is ever pending", () => {
  assert.deepEqual(pending(career({ sessions: 100_000, prompts: 100_000 })), []);
});

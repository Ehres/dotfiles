import { test } from "node:test";
import assert from "node:assert/strict";
import { MILESTONES, isReached, measure, reached, type Milestone } from "./milestone.ts";
import { STAGES, xp } from "./stage.ts";
import { EMPTY_DELTA, type Counters } from "./state.ts";

const counters = (patch: Partial<Counters>): Counters => ({ ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools }, ...patch });

/** Enough sessions to sit exactly on a Stage threshold: sessions weigh 10 XP each. */
const sessionsFor = (stage: (typeof STAGES)[number]["id"]): number => (STAGES.find((entry) => entry.id === stage)?.xp ?? 0) / 10;

test("measure reads a plain counter", () => {
  const c = counters({ sessions: 1, prompts: 2, filesEdited: 3, questions: 4 });
  assert.equal(measure(c, "sessions"), 1);
  assert.equal(measure(c, "prompts"), 2);
  assert.equal(measure(c, "filesEdited"), 3);
  assert.equal(measure(c, "questions"), 4);
});

test("measure tools sums the four kinds and xp reuses xp()", () => {
  const c = counters({ tools: { read: 1, edit: 2, bash: 3, other: 4 }, prompts: 5 });
  assert.equal(measure(c, "tools"), 10);
  assert.equal(measure(c, "xp"), xp(c));
});

const table: readonly Milestone[] = [
  { id: "evolution:hatchling", stage: "hatchling" },
  { id: "sessions:100", measure: "sessions", min: 100 },
  { id: "evolution:young", stage: "young" },
  { id: "tools:1000", measure: "tools", min: 1000 },
];

test("a measure Milestone is reached at min, not below", () => {
  const m: Milestone = { id: "sessions:100", measure: "sessions", min: 100 };
  assert.equal(isReached(counters({ sessions: 99 }), m), false);
  assert.equal(isReached(counters({ sessions: 100 }), m), true);
  assert.equal(isReached(counters({ sessions: 101 }), m), true);
});

test("a stage Milestone is reached at its Stage and stays reached at later Stages", () => {
  const m: Milestone = { id: "evolution:young", stage: "young" };
  assert.equal(isReached(counters({ sessions: sessionsFor("hatchling") }), m), false);
  assert.equal(isReached(counters({ sessions: sessionsFor("young") }), m), true);
  assert.equal(isReached(counters({ sessions: sessionsFor("elder") }), m), true);
});

test("errors reach nothing", () => {
  assert.deepEqual(reached(counters({ errors: 1_000_000 }), table), []);
});

test("reached returns the satisfied Milestones in table order", () => {
  const c = counters({ sessions: sessionsFor("young") }); // 150 sessions: young, and past 100 sessions
  assert.deepEqual(
    reached(c, table).map((m) => m.id),
    ["evolution:hatchling", "sessions:100", "evolution:young"],
  );
});

test("reached is empty on a fresh egg and on an empty table", () => {
  assert.deepEqual(reached(counters({}), table), []);
  assert.deepEqual(reached(counters({ sessions: 10_000 }), []), []);
});

test("the shipped table is empty for now", () => {
  assert.deepEqual(MILESTONES, []);
  assert.deepEqual(reached(counters({ sessions: 10_000 })), []);
});

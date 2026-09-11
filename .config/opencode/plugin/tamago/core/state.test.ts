import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_DELTA, addDelta, freshCareer, hydrate, initialSession, isEmpty } from "./state.ts";

test("initialSession starts idle and not busy", () => {
  assert.deepEqual(initialSession(42), { activity: "idle", since: 42, busy: false });
});

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
  });
});

test("addDelta does not mutate its inputs", () => {
  const a = { ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools } };
  addDelta(a, { ...EMPTY_DELTA, prompts: 5 });
  assert.deepEqual(a, EMPTY_DELTA);
});

test("hydrate fills missing fields with defaults and is not corrupt", () => {
  const { career, corrupt } = hydrate({ prompts: 7, tools: { edit: 3 } }, 500);
  assert.equal(corrupt, false);
  assert.equal(career.prompts, 7);
  assert.equal(career.tools.edit, 3);
  assert.equal(career.tools.read, 0);
  assert.equal(career.sessions, 0);
  assert.equal(career.hatchedAt, 500);
});

test("hydrate keeps hatchedAt when present", () => {
  assert.equal(hydrate({ hatchedAt: 123 }, 500).career.hatchedAt, 123);
});

test("hydrate rejects non-object input as corrupt with a fresh career", () => {
  for (const raw of [null, undefined, "x", 3, []]) {
    const { career, corrupt } = hydrate(raw, 9);
    assert.equal(corrupt, true, `raw=${JSON.stringify(raw)}`);
    assert.deepEqual(career, freshCareer(9));
  }
});

test("hydrate ignores non-finite numbers", () => {
  const { career } = hydrate({ prompts: "12", errors: Number.NaN, tools: { bash: Number.POSITIVE_INFINITY } }, 1);
  assert.equal(career.prompts, 0);
  assert.equal(career.errors, 0);
  assert.equal(career.tools.bash, 0);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { count } from "./count.ts";
import { EMPTY_DELTA, isEmpty } from "./state.ts";
import type { TamagoEvent } from "./events.ts";

test("prompts, sessions, files and errors each count once", () => {
  assert.equal(count({ type: "prompt_sent" }).prompts, 1);
  assert.equal(count({ type: "session_started" }).sessions, 1);
  assert.equal(count({ type: "file_edited" }).filesEdited, 1);
  assert.equal(count({ type: "tool_failed" }).errors, 1);
  assert.equal(count({ type: "session_error" }).errors, 1);
});

test("a finished tool counts under its kind only", () => {
  const delta = count({ type: "tool_finished", kind: "bash" });
  assert.deepEqual(delta.tools, { read: 0, edit: 0, bash: 1, other: 0 });
  assert.deepEqual({ ...delta, tools: EMPTY_DELTA.tools }, EMPTY_DELTA);
});

test("activity-only events count nothing", () => {
  const silent: TamagoEvent[] = [
    { type: "tool_started" },
    { type: "permission_asked" },
    { type: "permission_replied" },
    { type: "session_busy" },
    { type: "session_idle" },
    { type: "session_gone" },
    { type: "tick" },
  ];
  for (const event of silent) assert.ok(isEmpty(count(event)), `${event.type} should not count`);
});

test("count never returns the shared EMPTY_DELTA object", () => {
  assert.notEqual(count({ type: "tick" }), EMPTY_DELTA);
  assert.notEqual(count({ type: "tick" }).tools, EMPTY_DELTA.tools);
});

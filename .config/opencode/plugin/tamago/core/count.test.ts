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
    { type: "permission_replied", granted: true },
    { type: "session_busy" },
    { type: "session_idle" },
    { type: "session_gone" },
    { type: "tool_cancelled" },
    { type: "tick" },
    { type: "session_compacted" },
    { type: "session_retried" },
    { type: "todos_updated", total: 3, done: 3 },
    { type: "diff_updated", files: 12 },
    { type: "evolved" },
  ];
  for (const event of silent) assert.ok(isEmpty(count(event)), `${event.type} should not count`);
});

test("count never returns the shared EMPTY_DELTA object", () => {
  assert.notEqual(count({ type: "tick" }), EMPTY_DELTA);
  assert.notEqual(count({ type: "tick" }).tools, EMPTY_DELTA.tools);
});

test("a question asked counts one question and nothing else; a reply counts nothing", () => {
  const asked = count({ type: "question_asked" });
  assert.equal(asked.questions, 1);
  assert.deepEqual({ ...asked, questions: 0 }, EMPTY_DELTA);
  assert.equal(isEmpty(count({ type: "question_replied" })), true);
});

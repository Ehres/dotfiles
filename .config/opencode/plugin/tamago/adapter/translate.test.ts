import { test } from "node:test";
import assert from "node:assert/strict";
import type { Event } from "@opencode-ai/sdk/v2";
import { createTranslator, toolKind } from "./translate.ts";

// Minimal event shapes. Only the fields the translator reads are present.
const ev = (value: unknown): Event => value as Event;

const toolPart = (callID: string, tool: string, status: string) =>
  ev({ type: "message.part.updated", properties: { sessionID: "s", time: 0, part: { type: "tool", callID, tool, state: { status } } } });

test("toolKind buckets tool names", () => {
  assert.equal(toolKind("read"), "read");
  assert.equal(toolKind("glob"), "read");
  assert.equal(toolKind("grep"), "read");
  assert.equal(toolKind("edit"), "edit");
  assert.equal(toolKind("write"), "edit");
  assert.equal(toolKind("bash"), "bash");
  assert.equal(toolKind("webfetch"), "other");
});

test("a tool part going running then completed yields started then finished, once each", () => {
  const t = createTranslator();
  assert.deepEqual(t(toolPart("c1", "edit", "pending")), []);
  assert.deepEqual(t(toolPart("c1", "edit", "running")), [{ type: "tool_started" }]);
  assert.deepEqual(t(toolPart("c1", "edit", "running")), []);
  assert.deepEqual(t(toolPart("c1", "edit", "completed")), [{ type: "tool_finished", kind: "edit" }]);
  assert.deepEqual(t(toolPart("c1", "edit", "completed")), []);
});

test("an error state yields tool_failed", () => {
  const t = createTranslator();
  t(toolPart("c2", "bash", "running"));
  assert.deepEqual(t(toolPart("c2", "bash", "error")), [{ type: "tool_failed" }]);
});

test("a completion whose start was never seen still balances the running count", () => {
  const t = createTranslator();
  assert.deepEqual(t(toolPart("c3", "read", "completed")), [{ type: "tool_started" }, { type: "tool_finished", kind: "read" }]);
});

test("non-tool parts are ignored", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "message.part.updated", properties: { part: { type: "text", text: "hi" } } })), []);
});

test("a user message counts one prompt even when updated several times", () => {
  const t = createTranslator();
  const msg = ev({ type: "message.updated", properties: { sessionID: "s", info: { id: "m1", role: "user" } } });
  assert.deepEqual(t(msg), [{ type: "prompt_sent" }]);
  assert.deepEqual(t(msg), []);
  const assistant = ev({ type: "message.updated", properties: { sessionID: "s", info: { id: "m2", role: "assistant" } } });
  assert.deepEqual(t(assistant), []);
});

test("simple events map one to one", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "file.edited", properties: { file: "a.ts" } })), [{ type: "file_edited" }]);
  assert.deepEqual(t(ev({ type: "permission.asked", properties: {} })), [{ type: "permission_asked" }]);
  assert.deepEqual(t(ev({ type: "permission.replied", properties: {} })), [{ type: "permission_replied" }]);
  assert.deepEqual(t(ev({ type: "session.idle", properties: {} })), [{ type: "session_idle" }]);
  assert.deepEqual(t(ev({ type: "session.error", properties: {} })), [{ type: "session_error" }]);
});

test("a user abort is not an error", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "session.error", properties: { error: { name: "MessageAbortedError" } } })), []);
  assert.deepEqual(t(ev({ type: "session.error", properties: { error: { name: "UnknownError" } } })), [
    { type: "session_error" },
  ]);
});

test("session.created counts only top-level sessions", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "session.created", properties: { info: { id: "a" } } })), [{ type: "session_started" }]);
  assert.deepEqual(t(ev({ type: "session.created", properties: { info: { id: "b", parentID: "a" } } })), []);
});

test("unknown or malformed events yield nothing and do not throw", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "session.compacted", properties: {} })), []);
  assert.deepEqual(t(ev({ type: "message.part.updated", properties: {} })), []);
  assert.deepEqual(t(ev({ type: "message.updated", properties: {} })), []);
  assert.deepEqual(t(ev({})), []);
});

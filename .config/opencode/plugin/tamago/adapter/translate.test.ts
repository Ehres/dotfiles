import { test } from "node:test";
import assert from "node:assert/strict";
import type { Event } from "@opencode-ai/sdk/v2";
import type { Addressed, TamagoEvent } from "../core/events.ts";
import { SUBSCRIBED, createTranslator, isUserDecision, toolKind } from "./translate.ts";

// Minimal event shapes. Only the fields the translator reads are present.
const ev = (value: unknown): Event => value as Event;

const toolPart = (callID: string, tool: string, status: string, sessionID = "s", state: Record<string, unknown> = {}) =>
  ev({ type: "message.part.updated", properties: { sessionID, time: 0, part: { type: "tool", callID, tool, state: { status, ...state } } } });

const on = (id: string, event: TamagoEvent): Addressed => ({ target: { type: "session", id }, event });
const every = (event: TamagoEvent): Addressed => ({ target: { type: "every" }, event });
const none = (event: TamagoEvent): Addressed => ({ target: { type: "none" }, event });

test("toolKind buckets tool names", () => {
  assert.equal(toolKind("read"), "read");
  assert.equal(toolKind("glob"), "read");
  assert.equal(toolKind("grep"), "read");
  assert.equal(toolKind("edit"), "edit");
  assert.equal(toolKind("write"), "edit");
  assert.equal(toolKind("apply_patch"), "edit"); // GPT-style models edit through patches
  assert.equal(toolKind("bash"), "bash");
  assert.equal(toolKind("webfetch"), "other");
});

test("SUBSCRIBED lists every SDK event type the translator handles, once", () => {
  assert.deepEqual([...SUBSCRIBED].sort(), [...new Set(SUBSCRIBED)].sort());
  for (const type of [
    "message.part.updated",
    "message.updated",
    "file.edited",
    "permission.asked",
    "permission.replied",
    "session.status",
    "session.idle",
    "session.error",
    "session.created",
    "session.deleted",
  ]) {
    assert.ok((SUBSCRIBED as readonly string[]).includes(type), `${type} must be subscribed`);
  }
});

test("a tool part going running then completed yields started then finished, once each, on its session", () => {
  const t = createTranslator();
  assert.deepEqual(t(toolPart("c1", "edit", "pending")), []);
  assert.deepEqual(t(toolPart("c1", "edit", "running")), [on("s", { type: "tool_started" })]);
  assert.deepEqual(t(toolPart("c1", "edit", "running")), []);
  assert.deepEqual(t(toolPart("c1", "edit", "completed")), [on("s", { type: "tool_finished", kind: "edit" })]);
  assert.deepEqual(t(toolPart("c1", "edit", "completed")), []);
});

test("an error state yields tool_failed", () => {
  const t = createTranslator();
  t(toolPart("c2", "bash", "running"));
  assert.deepEqual(t(toolPart("c2", "bash", "error", "s", { error: "Tool execution failed: exit 1" })), [on("s", { type: "tool_failed" })]);
});

test("a tool stopped by the user's own decision is cancelled, not failed", () => {
  const decisions: Record<string, unknown>[] = [
    { error: "Tool execution aborted", metadata: { interrupted: true } },
    { error: "Tool execution aborted" },
    { error: "Cancelled" },
    { error: "The user rejected permission to use this specific tool call." },
    { error: "The user rejected permission to use this specific tool call with the following feedback: use rg" },
    { error: "The user dismissed this question" },
    { error: "anything at all", metadata: { interrupted: true } },
  ];
  decisions.forEach((state, i) => {
    const t = createTranslator();
    t(toolPart(`d${i}`, "bash", "running"));
    assert.deepEqual(t(toolPart(`d${i}`, "bash", "error", "s", state)), [on("s", { type: "tool_cancelled" })], JSON.stringify(state));
  });
});

test("isUserDecision only matches the exact abort and rejection texts", () => {
  assert.equal(isUserDecision({ error: "Tool execution aborted" }), true);
  assert.equal(isUserDecision({ error: "Tool execution aborted by a bug" }), false);
  assert.equal(isUserDecision({ error: "Cancelled" }), true);
  assert.equal(isUserDecision({ error: "Operation Cancelled" }), false);
  assert.equal(isUserDecision({ error: "The user rejected permission to use this specific tool call." }), true);
  assert.equal(isUserDecision({ error: "The user dismissed this question" }), true);
  assert.equal(isUserDecision({ error: "ENOENT: no such file" }), false);
  assert.equal(isUserDecision({ metadata: { interrupted: true } }), true);
  assert.equal(isUserDecision({ metadata: { interrupted: false }, error: "boom" }), false);
  assert.equal(isUserDecision({}), false);
});

test("a completion whose start was never seen yields the start too", () => {
  const t = createTranslator();
  assert.deepEqual(t(toolPart("c3", "read", "completed")), [on("s", { type: "tool_started" }), on("s", { type: "tool_finished", kind: "read" })]);
});

test("non-tool parts are ignored", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "message.part.updated", properties: { sessionID: "s", part: { type: "text", text: "hi" } } })), []);
});

test("a user message counts one prompt even when updated several times", () => {
  const t = createTranslator();
  const msg = ev({ type: "message.updated", properties: { sessionID: "s", info: { id: "m1", role: "user" } } });
  assert.deepEqual(t(msg), [on("s", { type: "prompt_sent" })]);
  assert.deepEqual(t(msg), []);
  const assistant = ev({ type: "message.updated", properties: { sessionID: "s", info: { id: "m2", role: "assistant" } } });
  assert.deepEqual(t(assistant), []);
});

test("session-bound events target their session", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "permission.asked", properties: { sessionID: "s" } })), [on("s", { type: "permission_asked" })]);
  assert.deepEqual(t(ev({ type: "permission.replied", properties: { sessionID: "s", reply: "once" } })), [on("s", { type: "permission_replied" })]);
  assert.deepEqual(t(ev({ type: "session.idle", properties: { sessionID: "s" } })), [on("s", { type: "session_idle" })]);
  assert.deepEqual(t(ev({ type: "session.error", properties: { sessionID: "s", error: { name: "UnknownError" } } })), [on("s", { type: "session_error" })]);
  assert.deepEqual(t(ev({ type: "session.deleted", properties: { info: { id: "s" } } })), [on("s", { type: "session_gone" })]);
});

test("session.status maps busy and retry to session_busy and idle to session_idle", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "session.status", properties: { sessionID: "s", status: { type: "busy" } } })), [on("s", { type: "session_busy" })]);
  assert.deepEqual(t(ev({ type: "session.status", properties: { sessionID: "s", status: { type: "retry", attempt: 1, message: "", next: 0 } } })), [
    on("s", { type: "session_busy" }),
  ]);
  assert.deepEqual(t(ev({ type: "session.status", properties: { sessionID: "s", status: { type: "idle" } } })), [on("s", { type: "session_idle" })]);
});

test("file.edited has no session and only counts", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "file.edited", properties: { file: "a.ts" } })), [none({ type: "file_edited" })]);
});

test("a session.error without a session hurts everyone", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "session.error", properties: { error: { name: "ProviderAuthError" } } })), [every({ type: "session_error" })]);
});

test("a user abort is not an error", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "session.error", properties: { sessionID: "s", error: { name: "MessageAbortedError" } } })), []);
});

test("session.created counts and tracks top-level sessions only", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "session.created", properties: { info: { id: "a" } } })), [on("a", { type: "session_started" })]);
  assert.deepEqual(t(ev({ type: "session.created", properties: { info: { id: "b", parentID: "a" } } })), []);
});

test("a child session seen at creation never moves anyone: its work counts, its prompts and status do not", () => {
  const t = createTranslator();
  t(ev({ type: "session.created", properties: { info: { id: "child", parentID: "root" } } }));
  assert.deepEqual(t(toolPart("k1", "bash", "running", "child")), [none({ type: "tool_started" })]);
  assert.deepEqual(t(toolPart("k1", "bash", "completed", "child")), [none({ type: "tool_finished", kind: "bash" })]);
  assert.deepEqual(t(toolPart("k2", "read", "error", "child")), [none({ type: "tool_started" }), none({ type: "tool_failed" })]);
  assert.deepEqual(t(toolPart("k3", "read", "error", "child", { error: "Cancelled" })), [none({ type: "tool_started" }), none({ type: "tool_cancelled" })]);
  assert.deepEqual(t(ev({ type: "message.updated", properties: { sessionID: "child", info: { id: "m9", role: "user" } } })), []);
  assert.deepEqual(t(ev({ type: "session.idle", properties: { sessionID: "child" } })), []);
  assert.deepEqual(t(ev({ type: "session.status", properties: { sessionID: "child", status: { type: "busy" } } })), []);
  assert.deepEqual(t(ev({ type: "permission.asked", properties: { sessionID: "child" } })), []);
  assert.deepEqual(t(ev({ type: "session.error", properties: { sessionID: "child", error: { name: "UnknownError" } } })), [none({ type: "session_error" })]);
});

test("a child born before the translator is recognised through the injected predicate", () => {
  const t = createTranslator({ isChild: (id) => id === "old-child" });
  assert.deepEqual(t(ev({ type: "session.idle", properties: { sessionID: "old-child" } })), []);
  assert.deepEqual(t(ev({ type: "session.idle", properties: { sessionID: "root" } })), [on("root", { type: "session_idle" })]);
});

test("unknown or malformed events yield nothing and do not throw", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev({ type: "session.compacted", properties: {} })), []);
  assert.deepEqual(t(ev({ type: "message.part.updated", properties: {} })), []);
  assert.deepEqual(t(ev({ type: "message.updated", properties: {} })), []);
  assert.deepEqual(t(ev({ type: "session.idle", properties: {} })), []);
  assert.deepEqual(t(ev({ type: "session.status", properties: { sessionID: "s" } })), []);
  assert.deepEqual(t(ev({})), []);
});

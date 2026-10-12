import { test } from "node:test";
import assert from "node:assert/strict";
import type { Addressed, TamagoEvent } from "../../core/moment/events.ts";
import { SUBSCRIBED, createTranslator, isUserDecision, toolKind, type HostEvent } from "../translate.ts";

// Minimal OpenCode 2 event shapes. Only the fields the translator reads are present.
const ev = (type: string, data?: unknown): HostEvent => ({ type, data });

/** The three events of one tool call: named, called, then settled with `outcome` (success or failed). */
const named = (id: string, name: string, sessionID = "s") => ev("session.tool.input.started", { sessionID, assistantMessageID: "m", id, name });
const called = (id: string, sessionID = "s", input: Record<string, unknown> = {}) =>
  ev("session.tool.called", { sessionID, assistantMessageID: "m", id, input, executed: true });
const succeeded = (id: string, sessionID = "s") => ev("session.tool.success", { sessionID, assistantMessageID: "m", id, content: [], executed: true });
const failed = (id: string, error: Record<string, unknown>, sessionID = "s") => ev("session.tool.failed", { sessionID, assistantMessageID: "m", id, error, executed: true });

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

test("SUBSCRIBED lists every OpenCode 2 event type the translator handles, once, and nothing else", () => {
  assert.deepEqual([...SUBSCRIBED].sort(), [...new Set(SUBSCRIBED)].sort());
  const expected = [
    "session.tool.input.started",
    "session.tool.called",
    "session.tool.success",
    "session.tool.failed",
    "session.inbox.enqueued",
    "permission.asked",
    "permission.replied",
    "form.created",
    "form.replied",
    "form.cancelled",
    "session.status",
    "session.idle",
    "session.execution.failed",
    "session.created",
    "session.deleted",
    "session.compaction.ended",
    "session.retry.scheduled",
    "session.step.ended",
    "vcs.branch.updated",
    "worktree.updated",
    "filesystem.changed",
  ];
  assert.deepEqual([...SUBSCRIBED].sort(), expected.sort());
});

test("a tool call yields started then finished, once each, on its session, with the kind its name gives", () => {
  const t = createTranslator();
  assert.deepEqual(t(named("c1", "read")), []);
  assert.deepEqual(t(called("c1")), [on("s", { type: "tool_started" })]);
  assert.deepEqual(t(called("c1")), []);
  assert.deepEqual(t(succeeded("c1")), [on("s", { type: "tool_finished", kind: "read" })]);
  assert.deepEqual(t(succeeded("c1")), []);
});

test("a successful editing tool is also one file edited, counted without a session", () => {
  const t = createTranslator();
  t(named("e1", "edit"));
  t(called("e1"));
  assert.deepEqual(t(succeeded("e1")), [on("s", { type: "tool_finished", kind: "edit" }), none({ type: "file_edited" })]);
});

test("a failed tool yields tool_failed", () => {
  const t = createTranslator();
  t(named("c2", "bash"));
  t(called("c2"));
  assert.deepEqual(t(failed("c2", { type: "tool.execution", message: "exit 1" })), [on("s", { type: "tool_failed" })]);
});

test("a tool stopped by the user's own decision is cancelled, not failed", () => {
  const decisions: Record<string, unknown>[] = [
    { type: "aborted", message: "The user aborted a request" },
    { type: "permission.rejected", message: "anything" },
    { type: "tool.interrupted", message: "anything" },
    { type: "unknown", message: "The user rejected permission to use this specific tool call with the following feedback: use rg" },
    { type: "unknown", message: "The user dismissed this question" },
    { type: "unknown", message: "The user declined this tool call" },
  ];
  decisions.forEach((error, i) => {
    const t = createTranslator();
    t(called(`d${i}`));
    assert.deepEqual(t(failed(`d${i}`, error)), [on("s", { type: "tool_cancelled" })], JSON.stringify(error));
  });
});

test("isUserDecision only matches the user's own error types and texts", () => {
  assert.equal(isUserDecision({ type: "aborted", message: "" }), true);
  assert.equal(isUserDecision({ type: "abortedish", message: "" }), false);
  assert.equal(isUserDecision({ type: "unknown", message: "The user dismissed this question" }), true);
  assert.equal(isUserDecision({ type: "unknown", message: "ENOENT: no such file" }), false);
  assert.equal(isUserDecision({}), false);
  assert.equal(isUserDecision("aborted"), false);
  assert.equal(isUserDecision(undefined), false);
});

test("a settlement whose call was never seen yields the start too, and an unnamed tool is other", () => {
  const t = createTranslator();
  assert.deepEqual(t(succeeded("c3")), [on("s", { type: "tool_started" }), on("s", { type: "tool_finished", kind: "other" })]);
});

test("a user prompt counts once per inbox item; other inbox items count nothing", () => {
  const t = createTranslator();
  const prompt = ev("session.inbox.enqueued", { sessionID: "s", inboxID: "i1", item: { type: "user", payload: {}, delivery: "queue" } });
  assert.deepEqual(t(prompt), [on("s", { type: "prompt_sent" })]);
  assert.deepEqual(t(prompt), []);
  const synthetic = ev("session.inbox.enqueued", { sessionID: "s", inboxID: "i2", item: { type: "synthetic", payload: {}, delivery: "queue" } });
  assert.deepEqual(t(synthetic), []);
});

test("session-bound events target their session", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev("permission.asked", { sessionID: "s", id: "per_1", action: "bash", resources: [] })), [on("s", { type: "permission_asked" })]);
  assert.deepEqual(t(ev("permission.replied", { sessionID: "s", requestID: "per_1", reply: "once" })), [on("s", { type: "permission_replied", granted: true })]);
  assert.deepEqual(t(ev("permission.replied", { sessionID: "s", requestID: "per_1", reply: "always" })), [on("s", { type: "permission_replied", granted: true })]);
  assert.deepEqual(t(ev("permission.replied", { sessionID: "s", requestID: "per_1", reply: "reject" })), [on("s", { type: "permission_replied", granted: false })]);
  assert.deepEqual(t(ev("session.idle", { sessionID: "s" })), [on("s", { type: "session_idle" })]);
  assert.deepEqual(t(ev("session.execution.failed", { sessionID: "s", error: { type: "unknown", message: "boom" } })), [on("s", { type: "session_error" })]);
  assert.deepEqual(t(ev("session.deleted", { sessionID: "s" })), [on("s", { type: "session_gone" })]);
});

test("session.status maps busy and retry to session_busy and idle to session_idle", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev("session.status", { sessionID: "s", status: { type: "busy" } })), [on("s", { type: "session_busy" })]);
  assert.deepEqual(t(ev("session.status", { sessionID: "s", status: { type: "retry", attempt: 1, message: "", next: 0 } })), [on("s", { type: "session_busy" })]);
  assert.deepEqual(t(ev("session.status", { sessionID: "s", status: { type: "idle" } })), [on("s", { type: "session_idle" })]);
});

test("session.created counts and tracks top-level sessions only", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev("session.created", { sessionID: "a" })), [on("a", { type: "session_started" })]);
  assert.deepEqual(t(ev("session.created", { sessionID: "b", parentID: "a" })), []);
});

test("a child session seen at creation never moves anyone: its work counts, its prompts and status do not", () => {
  const t = createTranslator();
  t(ev("session.created", { sessionID: "child", parentID: "root" }));
  t(named("k1", "bash", "child"));
  assert.deepEqual(t(called("k1", "child")), [none({ type: "tool_started" })]);
  assert.deepEqual(t(succeeded("k1", "child")), [none({ type: "tool_finished", kind: "bash" })]);
  assert.deepEqual(t(failed("k2", { type: "unknown", message: "boom" }, "child")), [none({ type: "tool_started" }), none({ type: "tool_failed" })]);
  assert.deepEqual(t(failed("k3", { type: "aborted", message: "" }, "child")), [none({ type: "tool_started" }), none({ type: "tool_cancelled" })]);
  assert.deepEqual(t(ev("session.inbox.enqueued", { sessionID: "child", inboxID: "i9", item: { type: "user" } })), []);
  assert.deepEqual(t(ev("session.idle", { sessionID: "child" })), []);
  assert.deepEqual(t(ev("session.status", { sessionID: "child", status: { type: "busy" } })), []);
  assert.deepEqual(t(ev("permission.asked", { sessionID: "child" })), []);
  assert.deepEqual(t(ev("session.execution.failed", { sessionID: "child", error: { type: "unknown", message: "" } })), [none({ type: "session_error" })]);
  assert.deepEqual(t(ev("session.step.ended", { sessionID: "child", files: ["a.ts"] })), []);
});

test("a child born before the translator is recognised through the injected predicate", () => {
  const t = createTranslator({ isChild: (id) => id === "old-child" });
  assert.deepEqual(t(ev("session.idle", { sessionID: "old-child" })), []);
  assert.deepEqual(t(ev("session.idle", { sessionID: "root" })), [on("root", { type: "session_idle" })]);
});

test("unknown or malformed events yield nothing and do not throw", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev("session.compaction.ended", {})), []);
  assert.deepEqual(t(ev("session.tool.input.started", {})), []);
  assert.deepEqual(t(ev("session.inbox.enqueued", {})), []);
  assert.deepEqual(t(ev("session.idle", {})), []);
  assert.deepEqual(t(ev("session.status", { sessionID: "s" })), []);
  assert.deepEqual(t(ev("form.created", {})), []);
  assert.deepEqual(t(ev("session.created")), []);
  assert.deepEqual(t(ev("message.part.updated", { sessionID: "s" })), [], "an OpenCode 1 event is unknown now");
  assert.deepEqual(t({ type: "" }), []);
});

test("compaction and retry speak on their session and are dropped for children", () => {
  const t = createTranslator({ isChild: (id) => id === "child" });
  assert.deepEqual(t(ev("session.compaction.ended", { sessionID: "s", reason: "auto" })), [on("s", { type: "session_compacted" })]);
  assert.deepEqual(t(ev("session.retry.scheduled", { sessionID: "s", attempt: 2, at: 0, error: {} })), [on("s", { type: "session_retried" })]);
  assert.deepEqual(t(ev("session.compaction.ended", { sessionID: "child" })), []);
});

test("the todo tool's input counts completed over non-cancelled todos, never reading content", () => {
  const t = createTranslator();
  const todos = [
    { content: "secret a", status: "completed", priority: "high" },
    { content: "secret b", status: "in_progress", priority: "low" },
    { content: "secret c", status: "cancelled", priority: "low" },
    { content: "secret d", status: "pending", priority: "low" },
  ];
  t(named("t1", "todowrite"));
  assert.deepEqual(t(called("t1", "s", { todos })), [on("s", { type: "tool_started" }), on("s", { type: "todos_updated", total: 3, done: 1 })]);
  t(named("t2", "todowrite"));
  assert.deepEqual(t(called("t2", "s", { todos: [] })), [on("s", { type: "tool_started" }), on("s", { type: "todos_updated", total: 0, done: 0 })]);
});

test("a todos field on another tool, or a malformed one, is no todo list", () => {
  const t = createTranslator();
  t(named("t3", "bash"));
  assert.deepEqual(t(called("t3", "s", { todos: [] })), [on("s", { type: "tool_started" })]);
  t(named("t4", "todowrite"));
  assert.deepEqual(t(called("t4", "s", { todos: "nope" })), [on("s", { type: "tool_started" })]);
});

test("the session diff is every distinct file its steps changed, summed per session, paths never kept beyond it", () => {
  const t = createTranslator();
  assert.deepEqual(t(ev("session.step.ended", { sessionID: "s", files: ["a.ts", "b.ts"] })), [on("s", { type: "diff_updated", files: 2 })]);
  assert.deepEqual(t(ev("session.step.ended", { sessionID: "s", files: ["b.ts", "c.ts"] })), [on("s", { type: "diff_updated", files: 3 })]);
  assert.deepEqual(t(ev("session.step.ended", { sessionID: "other", files: ["a.ts"] })), [on("other", { type: "diff_updated", files: 1 })]);
  assert.deepEqual(t(ev("session.step.ended", { sessionID: "s", files: [] })), [], "a step that changed nothing says nothing");
  assert.deepEqual(t(ev("session.step.ended", { sessionID: "s" })), []);
  t(ev("session.deleted", { sessionID: "s" }));
  assert.deepEqual(t(ev("session.step.ended", { sessionID: "s", files: ["z.ts"] })), [on("s", { type: "diff_updated", files: 1 })], "a deleted session starts over");
});

test("a question is counted once per form and moves its root session; a reply or a cancel resumes it", () => {
  const t = createTranslator();
  const asked = ev("form.created", { form: { id: "f1", sessionID: "s", fields: [] } });
  assert.deepEqual(t(asked), [on("s", { type: "question_asked" })]);
  assert.deepEqual(t(asked), [], "the same form again is ignored");
  assert.deepEqual(t(ev("form.replied", { id: "f1", sessionID: "s", answer: {} })), [on("s", { type: "question_replied" })]);
  assert.deepEqual(t(ev("form.cancelled", { id: "f1", sessionID: "s" })), [on("s", { type: "question_replied" })]);
});

test("a child session's question counts but moves nobody, and its reply is dropped", () => {
  const t = createTranslator();
  t(ev("session.created", { sessionID: "child", parentID: "root" }));
  assert.deepEqual(t(ev("form.created", { form: { id: "f2", sessionID: "child" } })), [none({ type: "question_asked" })]);
  assert.deepEqual(t(ev("form.replied", { id: "f2", sessionID: "child", answer: {} })), []);
});

test("the first branch of a run is silent; only a change speaks", () => {
  const translate = createTranslator();
  assert.deepEqual(translate(ev("vcs.branch.updated", { branch: "master" })), []);
  assert.deepEqual(translate(ev("vcs.branch.updated", { branch: "master" })), []);
  assert.deepEqual(translate(ev("vcs.branch.updated", { branch: "feature" })), [every({ type: "branch_changed" })]);
});

test("a changed worktree list and a stirred file reach every session and count nothing", () => {
  const translate = createTranslator();
  assert.deepEqual(translate(ev("worktree.updated", { projectID: "p" })), [every({ type: "worktree_ready" })]);
  assert.deepEqual(translate(ev("filesystem.changed", { file: "a.ts", event: "change" })), [every({ type: "files_stirred" })]);
});

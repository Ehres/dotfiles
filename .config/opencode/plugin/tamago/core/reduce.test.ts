import { test } from "node:test";
import assert from "node:assert/strict";
import { HURT_MS, SLEEP_MS, type TamagoEvent } from "./events.ts";
import { reduce } from "./reduce.ts";
import { EMPTY_DELTA, addDelta, initialSession, type Session } from "./state.ts";

function replay(events: Array<[TamagoEvent, number]>, start: Session = initialSession(0)) {
  let session = start;
  let delta = EMPTY_DELTA;
  for (const [event, now] of events) {
    const out = reduce(session, event, now);
    session = out.session;
    delta = addDelta(delta, out.delta);
  }
  return { session, delta };
}

test("a prompt makes the creature think and counts one prompt", () => {
  const { session, delta } = replay([[{ type: "prompt_sent" }, 10]]);
  assert.equal(session.activity, "thinking");
  assert.equal(session.since, 10);
  assert.equal(delta.prompts, 1);
});

test("tools drive working and count by kind when they finish", () => {
  const { session, delta } = replay([
    [{ type: "prompt_sent" }, 0],
    [{ type: "tool_started" }, 1],
    [{ type: "tool_started" }, 2],
    [{ type: "tool_finished", kind: "read" }, 3],
    [{ type: "tool_finished", kind: "edit" }, 4],
  ]);
  assert.equal(session.activity, "working");
  assert.equal(session.runningTools, 0);
  assert.equal(delta.tools.read, 1);
  assert.equal(delta.tools.edit, 1);
});

test("working persists after the last tool until the session goes idle", () => {
  const { session } = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "tool_finished", kind: "bash" }, 1],
    [{ type: "tick" }, 2],
    [{ type: "session_idle" }, 3],
  ]);
  assert.equal(session.activity, "idle");
  assert.equal(session.since, 3);
});

test("a failed tool hurts, counts an error, and releases its running slot", () => {
  const { session, delta } = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "tool_failed" }, 1],
  ]);
  assert.equal(session.activity, "hurt");
  assert.equal(session.runningTools, 0);
  assert.equal(delta.errors, 1);
});

test("runningTools never goes negative", () => {
  const { session } = replay([[{ type: "tool_finished", kind: "other" }, 0]]);
  assert.equal(session.runningTools, 0);
});

test("hurt recovers after HURT_MS to working when tools still run, else idle", () => {
  const busy = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "session_error" }, 1],
    [{ type: "tick" }, 1 + HURT_MS - 1],
  ]);
  assert.equal(busy.session.activity, "hurt");
  const recovered = replay([[{ type: "tick" }, 1 + HURT_MS]], busy.session);
  assert.equal(recovered.session.activity, "working");

  const calm = replay([
    [{ type: "session_error" }, 5],
    [{ type: "tick" }, 5 + HURT_MS],
  ]);
  assert.equal(calm.session.activity, "idle");
  assert.equal(calm.session.since, 5 + HURT_MS);
});

test("permissions make the creature wait and a reply resumes work", () => {
  const waiting = replay([[{ type: "permission_asked" }, 0]]);
  assert.equal(waiting.session.activity, "waiting");
  const resumed = replay([[{ type: "permission_replied" }, 1]], waiting.session);
  assert.equal(resumed.session.activity, "working");
});

test("idle falls asleep after SLEEP_MS and any real event wakes it", () => {
  const asleep = replay([
    [{ type: "session_idle" }, 0],
    [{ type: "tick" }, SLEEP_MS - 1],
  ]);
  assert.equal(asleep.session.activity, "idle");
  const later = replay([[{ type: "tick" }, SLEEP_MS]], asleep.session);
  assert.equal(later.session.activity, "sleeping");
  const woken = replay([[{ type: "file_edited" }, SLEEP_MS + 1]], later.session);
  assert.equal(woken.session.activity, "idle");
  assert.equal(woken.delta.filesEdited, 1);
});

test("file edits count without changing an active state", () => {
  const { session, delta } = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "file_edited" }, 1],
  ]);
  assert.equal(session.activity, "working");
  assert.equal(delta.filesEdited, 1);
});

test("session_started counts a session and leaves activity alone", () => {
  const { session, delta } = replay([[{ type: "session_started" }, 0]]);
  assert.equal(session.activity, "idle");
  assert.equal(delta.sessions, 1);
});

test("session_started wakes a sleeping creature", () => {
  const asleep = replay([
    [{ type: "session_idle" }, 0],
    [{ type: "tick" }, SLEEP_MS],
  ]);
  assert.equal(asleep.session.activity, "sleeping");
  const woken = replay([[{ type: "session_started" }, SLEEP_MS + 1]], asleep.session);
  assert.equal(woken.session.activity, "idle");
  assert.equal(woken.delta.sessions, 1);
});

test("session_idle clears running tools", () => {
  const { session } = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "session_idle" }, 1],
  ]);
  assert.equal(session.runningTools, 0);
});

test("since is only refreshed when the activity actually changes", () => {
  const { session } = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "tool_started" }, 50],
  ]);
  assert.equal(session.since, 0);
});

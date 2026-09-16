import { test } from "node:test";
import assert from "node:assert/strict";
import { HURT_MS, SLEEP_MS, type TamagoEvent } from "./events.ts";
import { transition } from "./transition.ts";
import { initialSession, type Session } from "./state.ts";

function replay(events: Array<[TamagoEvent, number]>, start: Session = initialSession(0)): Session {
  let session = start;
  for (const [event, now] of events) session = transition(session, event, now);
  return session;
}

test("a prompt makes the creature think and marks the session busy", () => {
  const session = replay([[{ type: "prompt_sent" }, 10]]);
  assert.equal(session.activity, "thinking");
  assert.equal(session.since, 10);
  assert.equal(session.busy, true);
});

test("a tool start switches to working and stays there after it finishes", () => {
  const session = replay([
    [{ type: "prompt_sent" }, 0],
    [{ type: "tool_started" }, 1],
    [{ type: "tool_finished", kind: "read" }, 2],
    [{ type: "tick" }, 3],
  ]);
  assert.equal(session.activity, "working");
  assert.equal(session.busy, true);
});

test("session_idle ends the work and clears busy", () => {
  const session = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "session_idle" }, 3],
  ]);
  assert.equal(session.activity, "idle");
  assert.equal(session.busy, false);
  assert.equal(session.since, 3);
});

test("session_busy while idle starts thinking but never overrides a finer activity", () => {
  const fresh = replay([[{ type: "session_busy" }, 0]]);
  assert.equal(fresh.activity, "thinking");
  assert.equal(fresh.busy, true);
  const working = replay([[{ type: "session_busy" }, 2]], replay([[{ type: "tool_started" }, 1]]));
  assert.equal(working.activity, "working");
  const waiting = replay([[{ type: "session_busy" }, 2]], replay([[{ type: "permission_asked" }, 1]]));
  assert.equal(waiting.activity, "waiting");
});

test("a failed tool or a session error hurts", () => {
  assert.equal(replay([[{ type: "tool_failed" }, 0]]).activity, "hurt");
  assert.equal(replay([[{ type: "session_error" }, 0]]).activity, "hurt");
});

test("hurt recovers after HURT_MS to working when the session is busy, else idle", () => {
  const busy = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "session_error" }, 1],
    [{ type: "tick" }, 1 + HURT_MS - 1],
  ]);
  assert.equal(busy.activity, "hurt");
  assert.equal(replay([[{ type: "tick" }, 1 + HURT_MS]], busy).activity, "working");

  const calm = replay([
    [{ type: "session_error" }, 5],
    [{ type: "tick" }, 5 + HURT_MS],
  ]);
  assert.equal(calm.activity, "idle");
  assert.equal(calm.since, 5 + HURT_MS);
});

test("permissions make the creature wait and a reply resumes work", () => {
  const waiting = replay([[{ type: "permission_asked" }, 0]]);
  assert.equal(waiting.activity, "waiting");
  const resumed = replay([[{ type: "permission_replied", granted: true }, 1]], waiting);
  assert.equal(resumed.activity, "working");
  assert.equal(resumed.busy, true);
});

test("idle falls asleep after SLEEP_MS", () => {
  const awake = replay([
    [{ type: "session_idle" }, 0],
    [{ type: "tick" }, SLEEP_MS - 1],
  ]);
  assert.equal(awake.activity, "idle");
  assert.equal(replay([[{ type: "tick" }, SLEEP_MS]], awake).activity, "sleeping");
});

test("every non-tick event wakes a sleeping creature, ticks never do", () => {
  const asleep = replay([
    [{ type: "session_idle" }, 0],
    [{ type: "tick" }, SLEEP_MS],
  ]);
  assert.equal(asleep.activity, "sleeping");
  assert.equal(replay([[{ type: "tick" }, SLEEP_MS + 1]], asleep).activity, "sleeping");
  const quiet: TamagoEvent[] = [
    { type: "file_edited" },
    { type: "session_started" },
    { type: "tool_finished", kind: "bash" },
    { type: "tool_cancelled" },
  ];
  for (const event of quiet) {
    const woken = replay([[event, SLEEP_MS + 1]], asleep);
    assert.equal(woken.activity, "idle", `${event.type} should wake to idle`);
    assert.equal(woken.since, SLEEP_MS + 1);
  }
  assert.equal(replay([[{ type: "prompt_sent" }, SLEEP_MS + 1]], asleep).activity, "thinking");
  assert.equal(replay([[{ type: "tool_started" }, SLEEP_MS + 1]], asleep).activity, "working");
});

test("file edits, tool completions, cancellations and session_started leave an active state alone", () => {
  const working = replay([[{ type: "tool_started" }, 0]]);
  for (const event of [
    { type: "file_edited" },
    { type: "tool_finished", kind: "edit" },
    { type: "tool_cancelled" },
    { type: "session_started" },
  ] as TamagoEvent[]) {
    assert.equal(replay([[event, 1]], working).activity, "working");
  }
});

test("since is only refreshed when the activity actually changes", () => {
  const session = replay([
    [{ type: "tool_started" }, 0],
    [{ type: "tool_started" }, 50],
  ]);
  assert.equal(session.since, 0);
});

test("session_gone changes nothing; forgetting the session is the caller's job", () => {
  const working = replay([[{ type: "tool_started" }, 0]]);
  assert.deepEqual(replay([[{ type: "session_gone" }, 1]], working), working);
});

test("speech events never move a session", () => {
  const speech: TamagoEvent[] = [
    { type: "session_compacted" },
    { type: "session_retried" },
    { type: "todos_updated", total: 3, done: 3 },
    { type: "diff_updated", files: 12 },
    { type: "evolved", stage: "young" },
  ];
  const working = replay([[{ type: "tool_started" }, 0]]);
  for (const event of speech) assert.equal(transition(working, event, 5), working, `${event.type} must be inert`);
});

test("a question makes the creature wait and the reply resumes work", () => {
  const waiting = replay([[{ type: "question_asked" }, 0]]);
  assert.equal(waiting.activity, "waiting");
  const resumed = replay([[{ type: "question_replied" }, 1]], waiting);
  assert.equal(resumed.activity, "working");
  assert.equal(resumed.busy, true);
});

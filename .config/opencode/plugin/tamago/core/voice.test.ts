import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TEXT } from "./bubble.ts";
import { TEMPERAMENTS, type Temperament } from "./character.ts";
import type { TamagoEvent } from "./events.ts";
import { initialSession, type Session } from "./state.ts";
import { transition } from "./transition.ts";
import {
  BIG_DIFF_FILES,
  BUBBLE_MS,
  CUES,
  FLAVOR,
  LONG_WORK_MS,
  PHRASES,
  QUIET_MS,
  REPLY_MS,
  STREAK_MS,
  initialVoice,
  speak,
  type Cue,
  type Voice,
} from "./voice.ts";

/** Runs events through transition and speak together, like index.tsx does. */
function replay(
  events: Array<[TamagoEvent, number]>,
  start = { voice: initialVoice(), session: initialSession(0) },
  temperament: Temperament = "stoic",
) {
  let { voice, session } = start;
  for (const [event, now] of events) {
    const after = transition(session, event, now);
    voice = speak(voice, event, session, after, now, temperament);
    session = after;
  }
  return { voice, session };
}

const cueOf = (voice: Voice): Cue | undefined => voice.bubble?.cue;

test("every phrase fits in MAX_TEXT and every Cue has at least one", () => {
  for (const cue of Object.keys(CUES) as Cue[]) {
    assert.ok(PHRASES[cue].length >= 1, cue);
    for (const text of PHRASES[cue]) assert.ok(text.length <= MAX_TEXT, `${cue}: ${JSON.stringify(text)}`);
  }
});

test("a permission request speaks, with the first phrase, for BUBBLE_MS", () => {
  const { voice } = replay([[{ type: "permission_asked" }, 100]]);
  assert.deepEqual(voice.bubble, { cue: "permission", text: FLAVOR.stoic?.permission?.[0], since: 100, until: 100 + BUBBLE_MS });
});

test("waking from sleep speaks", () => {
  const asleep: Session = { activity: "sleeping", since: 0, busy: false };
  const { voice } = replay([[{ type: "prompt_sent" }, 5]], { voice: initialVoice(), session: asleep });
  assert.equal(cueOf(voice), "woke");
});

test("going idle after LONG_WORK_MS of busy speaks, a short job does not", () => {
  const long = replay([
    [{ type: "prompt_sent" }, 0],
    [{ type: "tool_started" }, 10],
    [{ type: "session_idle" }, LONG_WORK_MS],
  ]);
  assert.equal(cueOf(long.voice), "long_work");
  const short = replay([
    [{ type: "prompt_sent" }, 0],
    [{ type: "session_idle" }, LONG_WORK_MS - 1],
  ]);
  assert.equal(cueOf(short.voice), undefined);
});

test("busySince follows the busy flag", () => {
  const busy = replay([[{ type: "prompt_sent" }, 7]]);
  assert.equal(busy.voice.busySince, 7);
  const idle = replay([[{ type: "session_idle" }, 8]], busy);
  assert.equal(idle.voice.busySince, undefined);
});

test("three failures within STREAK_MS speak once; a fourth is under cooldown", () => {
  const { voice } = replay([
    [{ type: "tool_failed" }, 0],
    [{ type: "tool_failed" }, 1_000],
  ]);
  assert.equal(cueOf(voice), undefined);
  const third = replay([[{ type: "tool_failed" }, 2_000]], { voice, session: initialSession(0) });
  assert.equal(cueOf(third.voice), "streak");
  const fourth = replay([[{ type: "tool_failed" }, 3_000 + BUBBLE_MS + QUIET_MS]], third);
  assert.equal(fourth.voice.spoken.streak?.times, 1);
});

test("failures older than STREAK_MS are forgotten", () => {
  const { voice } = replay([
    [{ type: "tool_failed" }, 0],
    [{ type: "tool_failed" }, 1],
    [{ type: "tool_failed" }, STREAK_MS + 1],
  ]);
  assert.equal(cueOf(voice), undefined);
  assert.deepEqual(voice.failures, [STREAK_MS + 1]);
});

test("compaction, retry and evolution speak", () => {
  assert.equal(cueOf(replay([[{ type: "session_compacted" }, 0]]).voice), "compacted");
  assert.equal(cueOf(replay([[{ type: "session_retried" }, 0]]).voice), "retried");
  assert.equal(cueOf(replay([[{ type: "evolved", stage: "young" }, 0]]).voice), "evolved");
  assert.equal(cueOf(replay([[{ type: "evolved", stage: "hatchling" }, 0]]).voice), "hatched");
});

test("todos_done speaks once when every todo is done, and again after the list reopens", () => {
  const partial = replay([[{ type: "todos_updated", total: 2, done: 1 }, 0]]);
  assert.equal(cueOf(partial.voice), undefined);
  const done = replay([[{ type: "todos_updated", total: 2, done: 2 }, 1]], partial);
  assert.equal(cueOf(done.voice), "todos_done");
  const again = replay([[{ type: "todos_updated", total: 2, done: 2 }, 2 + BUBBLE_MS + QUIET_MS]], done);
  assert.equal(again.voice.spoken.todos_done?.times, 1);
  const reopened = replay(
    [
      [{ type: "todos_updated", total: 3, done: 2 }, 3 + BUBBLE_MS + QUIET_MS],
      [{ type: "todos_updated", total: 3, done: 3 }, 4 + BUBBLE_MS + QUIET_MS],
    ],
    again,
  );
  assert.equal(reopened.voice.spoken.todos_done?.times, 2);
});

test("an empty todo list is never done", () => {
  assert.equal(cueOf(replay([[{ type: "todos_updated", total: 0, done: 0 }, 0]]).voice), undefined);
});

test("a big diff speaks once per Session", () => {
  const small = replay([[{ type: "diff_updated", files: BIG_DIFF_FILES - 1 }, 0]]);
  assert.equal(cueOf(small.voice), undefined);
  const big = replay([[{ type: "diff_updated", files: BIG_DIFF_FILES }, 1]], small);
  assert.equal(cueOf(big.voice), "big_diff");
  const bigger = replay([[{ type: "diff_updated", files: 50 }, 1_000_000]], big);
  assert.equal(bigger.voice.spoken.big_diff?.times, 1);
});

test("a Cue under cooldown is dropped", () => {
  const first = replay([[{ type: "permission_asked" }, 0]]);
  const second = replay([[{ type: "permission_asked" }, CUES.permission.cooldown - 1]], first);
  assert.equal(second.voice.spoken.permission?.times, 1);
  const third = replay([[{ type: "permission_asked" }, CUES.permission.cooldown]], first);
  assert.equal(third.voice.spoken.permission?.times, 2);
});

test("within QUIET_MS only a strictly higher priority speaks, and it replaces the bubble", () => {
  const woke = replay([[{ type: "prompt_sent" }, 0]], { voice: initialVoice(), session: { activity: "sleeping", since: 0, busy: false } });
  assert.equal(cueOf(woke.voice), "woke");
  const compacted = replay([[{ type: "session_compacted" }, 1]], woke);
  assert.equal(cueOf(compacted.voice), "compacted");
  assert.equal(compacted.voice.bubble?.since, 1);
  const retried = replay([[{ type: "session_retried" }, 2]], compacted);
  assert.equal(cueOf(retried.voice), "compacted", "equal priority is dropped");
  assert.equal(retried.voice.spoken.retried, undefined);
  const late = replay([[{ type: "session_retried" }, 1 + QUIET_MS]], compacted);
  assert.equal(cueOf(late.voice), "retried");
});

test("a dropped Cue is never queued", () => {
  const first = replay([[{ type: "session_compacted" }, 0]]);
  const dropped = replay([[{ type: "session_retried" }, 1]], first);
  const expired = replay([[{ type: "tick" }, BUBBLE_MS + 1]], dropped);
  assert.equal(expired.voice.bubble, undefined);
});

test("a bubble expires on the first tick at or after until", () => {
  const spoke = replay([[{ type: "permission_asked" }, 0]]);
  const early = replay([[{ type: "tick" }, BUBBLE_MS - 1]], spoke);
  assert.equal(early.voice, spoke.voice, "same object on a quiet tick");
  const gone = replay([[{ type: "tick" }, BUBBLE_MS]], spoke);
  assert.equal(gone.voice.bubble, undefined);
  assert.equal(gone.voice.spoken.permission?.times, 1, "memory survives expiry");
});

test("phrases are picked in order and wrap around", () => {
  let state = replay([[{ type: "session_compacted" }, 0]]);
  const seen = [state.voice.bubble?.text];
  const n = PHRASES.compacted.length;
  for (let i = 1; i <= n; i++) {
    state = replay([[{ type: "session_compacted" }, i * (BUBBLE_MS + QUIET_MS)]], state);
    seen.push(state.voice.bubble?.text);
  }
  assert.deepEqual(seen, [...PHRASES.compacted, PHRASES.compacted[0]]);
});

test("an event that changes nothing returns the same Voice object", () => {
  const voice = initialVoice();
  const session = initialSession(0);
  assert.equal(speak(voice, { type: "tool_finished", kind: "read" }, session, session, 1, "stoic"), voice);
  assert.equal(speak(voice, { type: "tick" }, session, session, 1, "stoic"), voice);
});

test("a reply within REPLY_MS answers a spoken May I?, replacing it despite the quiet window", () => {
  const asked = replay([[{ type: "permission_asked" }, 0]]);
  assert.equal(asked.voice.asked, 0);
  const granted = replay([[{ type: "permission_replied", granted: true }, 1]], asked);
  assert.deepEqual(granted.voice.bubble, { cue: "granted", text: FLAVOR.stoic?.granted?.[0], since: 1, until: 1 + BUBBLE_MS });
  assert.equal(granted.voice.asked, undefined, "the question is answered");
  const denied = replay([[{ type: "permission_replied", granted: false }, REPLY_MS - 1]], asked);
  assert.equal(cueOf(denied.voice), "denied");
});

test("a reply after REPLY_MS, or to a permission the Tamago never voiced, says nothing", () => {
  const asked = replay([[{ type: "permission_asked" }, 0]]);
  const late = replay([[{ type: "tick" }, BUBBLE_MS], [{ type: "permission_replied", granted: true }, REPLY_MS]], asked);
  assert.equal(cueOf(late.voice), undefined);
  assert.equal(late.voice.spoken.granted, undefined);
  assert.equal(late.voice.asked, undefined, "a late reply still closes the question");
  const quiet = replay(
    [
      [{ type: "permission_replied", granted: true }, 1],
      [{ type: "permission_asked" }, 2],
      [{ type: "permission_replied", granted: false }, 3],
    ],
    asked,
  );
  assert.equal(cueOf(quiet.voice), "granted", "the second ask was under cooldown, so its reply is not answered");
  assert.equal(quiet.voice.spoken.denied, undefined);
  const mute = replay([[{ type: "permission_replied", granted: true }, 1]]);
  assert.equal(mute.voice.bubble, undefined);
});

test("one reply per question: a second reply in the window is ignored", () => {
  const asked = replay([[{ type: "permission_asked" }, 0]]);
  const first = replay([[{ type: "permission_replied", granted: true }, 1]], asked);
  const second = replay([[{ type: "tick" }, 1 + BUBBLE_MS], [{ type: "permission_replied", granted: false }, 2 + QUIET_MS]], first);
  assert.equal(cueOf(second.voice), undefined);
  assert.equal(second.voice.spoken.denied, undefined);
});

test("a flavored Cue speaks in the Temperament's words and rotates within them", () => {
  const first = replay([[{ type: "permission_asked" }, 0]], undefined, "sarcastic");
  assert.equal(first.voice.bubble?.text, FLAVOR.sarcastic?.permission?.[0]);
  const second = replay([[{ type: "permission_asked" }, CUES.permission.cooldown + 1]], first, "sarcastic");
  assert.equal(second.voice.bubble?.text, FLAVOR.sarcastic?.permission?.[1]);
});

test("a Cue without flavor falls back to the neutral phrases", () => {
  const woke = replay([[{ type: "prompt_sent" }, 0]], { voice: initialVoice(), session: { activity: "sleeping", since: 0, busy: false } }, "dreamy");
  assert.equal(woke.voice.bubble?.text, PHRASES.woke[0]);
});

test("every flavored phrase fits in MAX_TEXT and every Temperament flavors the same Cues", () => {
  const cues = ["permission", "granted", "denied", "streak", "evolved", "hatched"] as const;
  for (const temperament of TEMPERAMENTS) {
    const flavor = FLAVOR[temperament];
    assert.ok(flavor, temperament);
    for (const cue of cues) {
      const phrases = flavor[cue];
      assert.ok(phrases && phrases.length >= 2, `${temperament}/${cue}`);
      for (const text of phrases) assert.ok(text.length <= MAX_TEXT, `${temperament}/${cue}: ${JSON.stringify(text)}`);
    }
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { MEDIAN, type Behavior } from "./behavior.ts";
import { MAX_TEXT } from "./bubble.ts";
import type { TamagoEvent } from "./events.ts";
import { TEMPERAMENTS, type Sheet, type Speaker, type Temperament } from "./sheet.ts";
import { SIGNATURE } from "./signature.ts";
import { initialSession, type Session } from "./session.ts";
import { transition } from "./transition.ts";
import {
  BIG_DIFF_FILES,
  CUES,
  FLAVOR,
  PHRASES,
  REGISTER,
  REPLY_MS,
  STREAK_MS,
  initialVoice,
  phrase,
  speak,
  type Cue,
  type Voice,
} from "./voice.ts";

const BUBBLE_MS = MEDIAN.bubbleMs;
const QUIET_MS = MEDIAN.quietMs;
const LONG_WORK_MS = MEDIAN.longWorkMs;

/** A Sheet at the median everywhere but where `patch` says. */
const sheetOf = (patch: Partial<Sheet>): Sheet => ({ cheerful: 0, sarcastic: 0, stoic: 0, dreamy: 0, energy: 5, chatter: 5, sensitivity: 5, patience: 5, ...patch });
/** A stoic cat, the default Speaker of these tests. */
const STOIC: Speaker = { hatchedAt: 1, species: "cat", sheet: sheetOf({ stoic: 8 }) };
const DRAGON: Speaker = { hatchedAt: 3, species: "dragon", sheet: sheetOf({ cheerful: 7 }) };

/** Runs events through transition and speak together, like core/window.ts does. */
function replay(
  events: Array<[TamagoEvent, number]>,
  start = { voice: initialVoice(), session: initialSession(0) },
  speaker: Speaker = STOIC,
  behavior: Behavior = MEDIAN,
) {
  let { voice, session } = start;
  for (const [event, now] of events) {
    const after = transition(session, event, now, behavior);
    voice = speak(voice, event, session, after, now, speaker, behavior);
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

test("a permission request speaks, with the phrase of its first time, for BUBBLE_MS", () => {
  const { voice } = replay([[{ type: "permission_asked" }, 100]]);
  assert.deepEqual(voice.bubble, { cue: "permission", text: phrase("permission", STOIC, 0), since: 100, until: 100 + BUBBLE_MS });
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

test("an event that changes nothing returns the same Voice object", () => {
  const voice = initialVoice();
  const session = initialSession(0);
  assert.equal(speak(voice, { type: "tool_finished", kind: "read" }, session, session, 1, STOIC), voice);
  assert.equal(speak(voice, { type: "tick" }, session, session, 1, STOIC), voice);
});

test("a reply within REPLY_MS answers a spoken May I?, replacing it despite the quiet window", () => {
  const asked = replay([[{ type: "permission_asked" }, 0]]);
  assert.equal(asked.voice.asked, 0);
  const granted = replay([[{ type: "permission_replied", granted: true }, 1]], asked);
  assert.deepEqual(granted.voice.bubble, { cue: "granted", text: phrase("granted", STOIC, 0), since: 1, until: 1 + BUBBLE_MS });
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

test("every Temperament flavors every Cue with at least two phrases that fit in MAX_TEXT, in printable ASCII", () => {
  for (const temperament of TEMPERAMENTS) {
    for (const cue of Object.keys(CUES) as Cue[]) {
      const phrases = FLAVOR[temperament][cue];
      assert.ok(phrases.length >= 2, `${temperament}/${cue}`);
      for (const text of phrases) {
        assert.ok(text.length <= MAX_TEXT, `${temperament}/${cue}: ${JSON.stringify(text)}`);
        assert.match(text, /^[\x20-\x7e]+$/, `${temperament}/${cue}: ${JSON.stringify(text)}`);
      }
    }
  }
});

test("an injected Behavior sets the Bubble length, the quiet gap, the long-work threshold and the streak count", () => {
  const chatty: Behavior = { ...MEDIAN, bubbleMs: 2_000, quietMs: 4_000, longWorkMs: 100_000, streakCount: 2 };
  const asked = replay([[{ type: "permission_asked" }, 100]], undefined, STOIC, chatty);
  assert.equal(asked.voice.bubble?.until, 100 + 2_000);

  // compacted has priority 2 and no cooldown: only the quiet gap keeps a second one from speaking
  const twice = (gap: number) => replay([[{ type: "session_compacted" }, 0], [{ type: "session_compacted" }, gap]], undefined, STOIC, chatty).voice;
  assert.equal(twice(3_999).spoken.compacted?.times, 1, "still quiet");
  assert.equal(twice(4_000).spoken.compacted?.times, 2, "the gap is over");
  assert.equal(replay([[{ type: "session_compacted" }, 0], [{ type: "session_compacted" }, 4_000]]).voice.spoken.compacted?.times, 1, "QUIET_MS without a Behavior");

  const long = replay([[{ type: "tool_started" }, 0], [{ type: "session_idle" }, 100_000]], undefined, STOIC, chatty);
  assert.equal(cueOf(long.voice), "long_work");
  const short = replay([[{ type: "tool_started" }, 0], [{ type: "session_idle" }, 99_999]], undefined, STOIC, chatty);
  assert.notEqual(cueOf(short.voice), "long_work");
  assert.notEqual(cueOf(replay([[{ type: "tool_started" }, 0], [{ type: "session_idle" }, 100_000]]).voice), "long_work", "LONG_WORK_MS without a Behavior");

  const two = replay([[{ type: "tool_failed" }, 0], [{ type: "tool_failed" }, 1]], undefined, STOIC, chatty);
  assert.equal(cueOf(two.voice), "streak");
  assert.notEqual(cueOf(replay([[{ type: "tool_failed" }, 0], [{ type: "tool_failed" }, 1]]).voice), "streak", "STREAK_COUNT is three without a Behavior");
});

/** Which Register a text of `cue` belongs to, for a Speaker whose pools are pairwise disjoint. */
function registerOf(text: string, cue: Cue, species: string): "species" | Temperament | "neutral" | undefined {
  if (SIGNATURE[species]?.[cue].includes(text)) return "species";
  for (const temperament of TEMPERAMENTS) if (FLAVOR[temperament][cue].includes(text)) return temperament;
  if (PHRASES[cue].includes(text)) return "neutral";
  return undefined;
}

/** Fails unless the Species, the four Temperaments and the neutral phrases share no text for `cue`: the tests below classify by membership. */
function assertDisjoint(cue: Cue, species: string): void {
  const pools = [SIGNATURE[species]?.[cue] ?? [], ...TEMPERAMENTS.map((temperament) => FLAVOR[temperament][cue]), PHRASES[cue]];
  const all = pools.flat();
  assert.equal(new Set(all).size, all.length, `${species}/${cue}: the pools overlap, pick another Cue for this test`);
}

test("REGISTER gives the Species the floor, the Temperament a nuance, the neutral phrases a common ground", () => {
  assert.deepEqual(REGISTER, { species: 70, temperament: 25, neutral: 5 });
});

test("phrase is deterministic, comes from one of the three Registers, and varies with the count", () => {
  assert.equal(phrase("compacted", STOIC, 3), phrase("compacted", STOIC, 3));
  const seen = new Set<string>();
  for (let times = 0; times < 30; times++) {
    const text = phrase("compacted", STOIC, times);
    assert.notEqual(registerOf(text, "compacted", "cat"), undefined, text);
    seen.add(text);
  }
  assert.ok(seen.size >= 3, "thirty occurrences say at least three different things");
});

test("over a thousand occurrences the Species speaks about 70 %, the Temperament 25 %, the neutral phrases 5 %", () => {
  assertDisjoint("compacted", "cat");
  const counts = { species: 0, temperament: 0, neutral: 0 };
  for (let times = 0; times < 1000; times++) {
    const register = registerOf(phrase("compacted", STOIC, times), "compacted", "cat");
    if (register === "species" || register === "neutral") counts[register]++;
    else counts.temperament++;
  }
  assert.ok(counts.species >= 650 && counts.species <= 750, `species ${counts.species}`);
  assert.ok(counts.temperament >= 200 && counts.temperament <= 300, `temperament ${counts.temperament}`);
  assert.ok(counts.neutral >= 30 && counts.neutral <= 70, `neutral ${counts.neutral}`);
});

test("among the Temperament's phrases, each Temperament speaks at the weight of its Stat", () => {
  assertDisjoint("compacted", "cat");
  const mixed: Speaker = { hatchedAt: 9, species: "cat", sheet: sheetOf({ sarcastic: 9, dreamy: 3 }) };
  const counts: Record<string, number> = {};
  for (let times = 0; times < 4000; times++) {
    const register = registerOf(phrase("compacted", mixed, times), "compacted", "cat");
    if (register !== undefined && register !== "species" && register !== "neutral") counts[register] = (counts[register] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  assert.ok(total >= 800, `about a quarter of 4000 belongs to the Temperament, got ${total}`);
  assert.equal(counts.cheerful ?? 0, 0, "a Stat at 0 never speaks");
  assert.equal(counts.stoic ?? 0, 0, "a Stat at 0 never speaks");
  const sarcastic = (counts.sarcastic ?? 0) / total;
  assert.ok(sarcastic >= 0.65 && sarcastic <= 0.85, `sarcastic 9 against dreamy 3 speaks about 75 %, got ${(sarcastic * 100).toFixed(1)} %`);
});

test("at the hatch the Species always speaks, and the phrase still varies", () => {
  const seen = new Set<string>();
  for (let times = 0; times < 50; times++) {
    const text = phrase("hatched", DRAGON, times);
    assert.ok(SIGNATURE.dragon?.hatched.includes(text), text);
    seen.add(text);
  }
  assert.ok(seen.size >= 2);
});

test("a Species this build does not know speaks with its Temperament where the Species would", () => {
  assertDisjoint("compacted", "cat");
  const unknown: Speaker = { hatchedAt: 5, species: "nope", sheet: sheetOf({ dreamy: 8 }) };
  for (let times = 0; times < 200; times++) {
    const register = registerOf(phrase("compacted", unknown, times), "compacted", "cat");
    assert.ok(register === "dreamy" || register === "neutral", `${times}: ${register}`);
  }
});

test("a Temperament Stat pushed below zero by a Modifier weighs nothing, and a Sheet with every Temperament at zero speaks its Temperament", () => {
  assertDisjoint("compacted", "cat");
  const negative: Speaker = { hatchedAt: 11, species: "cat", sheet: sheetOf({ stoic: 6, cheerful: -1 }) };
  const flat: Speaker = { hatchedAt: 12, species: "cat", sheet: sheetOf({}) };
  for (let times = 0; times < 300; times++) {
    const one = registerOf(phrase("compacted", negative, times), "compacted", "cat");
    assert.ok(one === "species" || one === "neutral" || one === "stoic", `${times}: ${one}`);
    const two = registerOf(phrase("compacted", flat, times), "compacted", "cat");
    assert.ok(two === "species" || two === "neutral" || two === "cheerful", `${times}: ${two}`);
  }
});

test("speak says the phrase of the Cue's count: the first time phrase 0, the next time phrase 1", () => {
  const first = replay([[{ type: "session_compacted" }, 0]]);
  assert.equal(first.voice.bubble?.text, phrase("compacted", STOIC, 0));
  const second = replay([[{ type: "session_compacted" }, BUBBLE_MS + QUIET_MS]], first);
  assert.equal(second.voice.bubble?.text, phrase("compacted", STOIC, 1));
});

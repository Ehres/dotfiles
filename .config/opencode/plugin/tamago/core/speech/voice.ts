import { MEDIAN, type Behavior } from "../creature/behavior.ts";
import type { Speaker } from "../creature/sheet.ts";
import type { TamagoEvent } from "../moment/events.ts";
import type { Session } from "../moment/session.ts";
import type { TraitId } from "../career/pick.ts";
import { DEFAULT_LANGUAGE, type Language } from "../language.ts";
import { ACCENT, opensCue, type Accent } from "./accent.ts";
import { tuningOf, type AnyCue } from "./cue.ts";
import { phrase } from "./register.ts";

/** The phrase shown above the sprite for one Cue, until `until`. */
export type Bubble = { cue: AnyCue; text: string; since: number; until: number };

/** Short memory of one Session's speech. Forgotten with the Session. */
export type Voice = {
  bubble?: Bubble;
  /** Start and priority of the last Bubble, for the quiet window. */
  last?: { at: number; priority: number };
  /** When the Tamago last voiced "May I?" and is still waiting for the answer. */
  asked?: number;
  /** Times each Cue was spoken, for the seed of the next phrase and for cooldowns. */
  spoken: Partial<Record<AnyCue, { at: number; times: number }>>;
  /** Timestamps of recent tool_failed, pruned to STREAK_MS. */
  failures: number[];
  /** When the OpenCode session became busy, for long_work. */
  busySince?: number;
  /** Whether the last todos_updated had every todo done, so todos_done fires on the edge only. */
  todosDone: boolean;
};

/** How long after voicing "May I?" a reply still deserves an answer. */
export const REPLY_MS = 30_000;
/** Files in the session diff from which the Tamago calls it a big site. */
export const BIG_DIFF_FILES = 10;
/** Window of failures that make a streak, and their count: the median of the Sheet's sensitivity Stat. */
export const STREAK_MS = 30_000;

export function initialVoice(): Voice {
  return { spoken: {}, failures: [], todosDone: false };
}

/** Bookkeeping that happens whatever the outcome, then the Cue this event raises, if any. */
function listen(
  voice: Voice,
  event: TamagoEvent,
  before: Session,
  after: Session,
  now: number,
  speaker: Speaker,
  behavior: Behavior,
  awaits: boolean,
  table: Record<TraitId, Accent>,
): { voice: Voice; cue?: AnyCue } {
  let next = voice;
  let cue: AnyCue | undefined;
  if (!before.busy && after.busy) next = { ...next, busySince: now };
  switch (event.type) {
    case "permission_asked":
      cue = "permission";
      break;
    case "permission_replied":
      if (next.asked !== undefined) {
        if (now - next.asked < REPLY_MS) cue = event.granted ? "granted" : "denied";
        next = { ...next, asked: undefined };
      }
      break;
    case "session_idle":
      if (before.busy && next.busySince !== undefined && now - next.busySince >= behavior.longWorkMs) cue = "long_work";
      else if (awaits && before.activity !== "sleeping") cue = "choice";
      break;
    case "tool_failed": {
      const failures = [...next.failures.filter((at) => now - at < STREAK_MS), now];
      next = { ...next, failures };
      if (failures.length >= behavior.streakCount) cue = "streak";
      break;
    }
    case "session_compacted":
      cue = "compacted";
      break;
    case "session_retried":
      cue = "retried";
      break;
    case "todos_updated": {
      const done = event.total > 0 && event.done === event.total;
      if (done && !next.todosDone) cue = "todos_done";
      if (done !== next.todosDone) next = { ...next, todosDone: done };
      break;
    }
    case "diff_updated":
      if (event.files >= BIG_DIFF_FILES) cue = "big_diff";
      break;
    case "evolved":
      cue = event.stage === "hatchling" ? "hatched" : "evolved";
      break;
    case "branch_changed":
      if (opensCue(speaker.traits, "branch", table)) cue = "branch";
      break;
    case "worktree_ready":
      if (opensCue(speaker.traits, "worktree", table)) cue = "worktree";
      break;
    case "files_stirred":
      // Our own edits are not news: a stirred file only speaks while the session is calm.
      if (!after.busy && opensCue(speaker.traits, "stir", table)) cue = "stir";
      break;
    default:
      break;
  }
  if (before.busy && !after.busy && next.busySince !== undefined) next = { ...next, busySince: undefined };
  if (cue === undefined && before.activity === "sleeping" && after.activity !== "sleeping") cue = "woke";
  return { voice: next, cue };
}

/**
 * Moves one Voice through an event and the Session transition it caused.
 * Pure. Returns the same object when nothing changed, so a quiet tick
 * re-renders nothing. The Behavior sets how long a Bubble stays, the quiet
 * gap, the long-work threshold and the streak count. The Speaker sets who
 * speaks: see `phrase`.
 */
export function speak(
  voice: Voice,
  event: TamagoEvent,
  before: Session,
  after: Session,
  now: number,
  speaker: Speaker,
  behavior: Behavior = MEDIAN,
  /** Whether a Draw awaits a Pick. The Voice cannot see the Career, so the Window computes it. */
  awaits = false,
  /** Every phrase the user reads is said in this Language. */
  language: Language = DEFAULT_LANGUAGE,
  /** The Accent table, injectable for tests; production always uses `ACCENT`. */
  table: Record<TraitId, Accent> = ACCENT,
): Voice {
  if (event.type === "tick") {
    return voice.bubble !== undefined && voice.bubble.until <= now ? { ...voice, bubble: undefined } : voice;
  }
  const { voice: next, cue } = listen(voice, event, before, after, now, speaker, behavior, awaits, table);
  if (cue === undefined) return next;
  const { priority, cooldown } = tuningOf(cue);
  const said = next.spoken[cue];
  if (said !== undefined && now - said.at < cooldown) return next;
  if (next.last !== undefined && now - next.last.at < behavior.quietMs && priority <= next.last.priority) return next;
  const times = said?.times ?? 0;
  const text = phrase(cue, speaker, times, language, table);
  // A Trait-opened Cue whose table owns no phrases for it says nothing: no Bubble, the Voice otherwise untouched.
  if (text === undefined) return next;
  return {
    ...next,
    bubble: { cue, text, since: now, until: now + behavior.bubbleMs },
    last: { at: now, priority },
    spoken: { ...next.spoken, [cue]: { at: now, times: times + 1 } },
    ...(cue === "permission" ? { asked: now } : {}),
  };
}

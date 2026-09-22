import { MEDIAN, type Behavior } from "../creature/behavior.ts";
import type { Speaker } from "../creature/sheet.ts";
import type { TamagoEvent } from "../moment/events.ts";
import type { Session } from "../moment/session.ts";
import { CUES, type Cue } from "./cue.ts";
import { phrase } from "./register.ts";

/** The phrase shown above the sprite for one Cue, until `until`. */
export type Bubble = { cue: Cue; text: string; since: number; until: number };

/** Short memory of one Session's speech. Forgotten with the Session. */
export type Voice = {
  bubble?: Bubble;
  /** Start and priority of the last Bubble, for the quiet window. */
  last?: { at: number; priority: number };
  /** When the Tamago last voiced "May I?" and is still waiting for the answer. */
  asked?: number;
  /** Times each Cue was spoken, for the seed of the next phrase and for cooldowns. */
  spoken: Partial<Record<Cue, { at: number; times: number }>>;
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
  behavior: Behavior,
  awaits: boolean,
): { voice: Voice; cue?: Cue } {
  let next = voice;
  let cue: Cue | undefined;
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
      else if (awaits) cue = "choice";
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
): Voice {
  if (event.type === "tick") {
    return voice.bubble !== undefined && voice.bubble.until <= now ? { ...voice, bubble: undefined } : voice;
  }
  const { voice: next, cue } = listen(voice, event, before, after, now, behavior, awaits);
  if (cue === undefined) return next;
  const { priority, cooldown } = CUES[cue];
  const said = next.spoken[cue];
  if (said !== undefined && now - said.at < cooldown) return next;
  if (next.last !== undefined && now - next.last.at < behavior.quietMs && priority <= next.last.priority) return next;
  const times = said?.times ?? 0;
  const text = phrase(cue, speaker, times);
  return {
    ...next,
    bubble: { cue, text, since: now, until: now + behavior.bubbleMs },
    last: { at: now, priority },
    spoken: { ...next.spoken, [cue]: { at: now, times: times + 1 } },
    ...(cue === "permission" ? { asked: now } : {}),
  };
}

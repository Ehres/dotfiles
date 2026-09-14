import type { TamagoEvent } from "./events.ts";
import type { Session } from "./state.ts";

/** Why the Tamago speaks. Born from events and transitions, never from content. */
export type Cue =
  | "permission"
  | "woke"
  | "long_work"
  | "big_diff"
  | "streak"
  | "compacted"
  | "retried"
  | "todos_done"
  | "evolved";

/** The phrase shown above the sprite for one Cue, until `until`. */
export type Bubble = { cue: Cue; text: string; since: number; until: number };

/** Short memory of one Session's speech. Forgotten with the Session. */
export type Voice = {
  bubble?: Bubble;
  /** Start and priority of the last Bubble, for the quiet window. */
  last?: { at: number; priority: number };
  /** Times each Cue was spoken, for deterministic phrase selection and cooldowns. */
  spoken: Partial<Record<Cue, { at: number; times: number }>>;
  /** Timestamps of recent tool_failed, pruned to STREAK_MS. */
  failures: number[];
  /** When the OpenCode session became busy, for long_work. */
  busySince?: number;
  /** Whether the last todos_updated had every todo done, so todos_done fires on the edge only. */
  todosDone: boolean;
};

/** How long a Bubble stays up. Checked on tick, so it lives up to one tick longer. */
export const BUBBLE_MS = 5_000;
/** Minimum gap between two Bubble starts, unless a strictly higher priority interrupts. */
export const QUIET_MS = 10_000;
/** Busy time after which going idle deserves a word. */
export const LONG_WORK_MS = 300_000;
/** Files in the session diff from which the Tamago calls it a big site. */
export const BIG_DIFF_FILES = 10;
/** Window and count of failures that make a streak. */
export const STREAK_MS = 30_000;
export const STREAK_COUNT = 3;

/** Tuning table: a higher priority may interrupt the quiet window; Infinity means once per Session. */
export const CUES: Record<Cue, { priority: number; cooldown: number }> = {
  permission: { priority: 1, cooldown: 120_000 },
  woke: { priority: 1, cooldown: 0 },
  long_work: { priority: 1, cooldown: 0 },
  big_diff: { priority: 1, cooldown: Infinity },
  streak: { priority: 2, cooldown: 60_000 },
  compacted: { priority: 2, cooldown: 0 },
  retried: { priority: 2, cooldown: 60_000 },
  todos_done: { priority: 2, cooldown: 0 },
  evolved: { priority: 3, cooldown: 0 },
};

/** English, like the Moods. Every phrase is at most MAX_TEXT characters; a test enforces it. */
export const PHRASES: Record<Cue, readonly [string, ...string[]]> = {
  permission: ["May I?", "Your call.", "Say the word."],
  woke: ["Mmh? Already?", "Was I out long?"],
  long_work: ["Phew. Done.", "That was a big one."],
  big_diff: ["Quite the site here.", "That's a lot of files."],
  streak: ["It keeps biting.", "Ow. Ow. Ow.", "Not my day."],
  compacted: ["My head feels empty.", "What were we doing?"],
  retried: ["Again? Fine.", "Once more, then."],
  todos_done: ["And that's a wrap.", "All ticked off."],
  evolved: ["I feel... different.", "Look at me now."],
};

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
): { voice: Voice; cue?: Cue } {
  let next = voice;
  let cue: Cue | undefined;
  if (!before.busy && after.busy) next = { ...next, busySince: now };
  switch (event.type) {
    case "permission_asked":
      cue = "permission";
      break;
    case "session_idle":
      if (before.busy && next.busySince !== undefined && now - next.busySince >= LONG_WORK_MS) cue = "long_work";
      break;
    case "tool_failed": {
      const failures = [...next.failures.filter((at) => now - at < STREAK_MS), now];
      next = { ...next, failures };
      if (failures.length >= STREAK_COUNT) cue = "streak";
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
      cue = "evolved";
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
 * re-renders nothing.
 */
export function speak(voice: Voice, event: TamagoEvent, before: Session, after: Session, now: number): Voice {
  if (event.type === "tick") {
    return voice.bubble !== undefined && voice.bubble.until <= now ? { ...voice, bubble: undefined } : voice;
  }
  const { voice: next, cue } = listen(voice, event, before, after, now);
  if (cue === undefined) return next;
  const { priority, cooldown } = CUES[cue];
  const said = next.spoken[cue];
  if (said !== undefined && now - said.at < cooldown) return next;
  if (next.last !== undefined && now - next.last.at < QUIET_MS && priority <= next.last.priority) return next;
  const times = said?.times ?? 0;
  const phrases = PHRASES[cue];
  const text = phrases[times % phrases.length] ?? phrases[0];
  return {
    ...next,
    bubble: { cue, text, since: now, until: now + BUBBLE_MS },
    last: { at: now, priority },
    spoken: { ...next.spoken, [cue]: { at: now, times: times + 1 } },
  };
}

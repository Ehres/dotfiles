import { MEDIAN, type Behavior } from "./behavior.ts";
import type { Temperament } from "./character.ts";
import type { TamagoEvent } from "./events.ts";
import { SIGNATURE } from "./signature.ts";
import type { SpeciesId } from "./species.ts";
import type { Session } from "./state.ts";

/** Why the Tamago speaks. Born from events and transitions, never from content. */
export type Cue =
  | "permission"
  | "granted"
  | "denied"
  | "woke"
  | "long_work"
  | "big_diff"
  | "streak"
  | "compacted"
  | "retried"
  | "todos_done"
  | "evolved"
  | "hatched";

/** The phrase shown above the sprite for one Cue, until `until`. */
export type Bubble = { cue: Cue; text: string; since: number; until: number };

/** Short memory of one Session's speech. Forgotten with the Session. */
export type Voice = {
  bubble?: Bubble;
  /** Start and priority of the last Bubble, for the quiet window. */
  last?: { at: number; priority: number };
  /** When the Tamago last voiced "May I?" and is still waiting for the answer. */
  asked?: number;
  /** Times each Cue was spoken, for deterministic phrase selection and cooldowns. */
  spoken: Partial<Record<Cue, { at: number; times: number }>>;
  /** Timestamps of recent tool_failed, pruned to STREAK_MS. */
  failures: number[];
  /** When the OpenCode session became busy, for long_work. */
  busySince?: number;
  /** Whether the last todos_updated had every todo done, so todos_done fires on the edge only. */
  todosDone: boolean;
};

/** How long a Bubble stays up: the median of the Sheet's chatter Stat. Checked on tick, so it lives up to one tick longer. */
export const BUBBLE_MS = MEDIAN.bubbleMs;
/** Minimum gap between two Bubble starts, unless a strictly higher priority interrupts: the median of the Sheet's chatter Stat. */
export const QUIET_MS = MEDIAN.quietMs;
/** How long after voicing "May I?" a reply still deserves an answer. */
export const REPLY_MS = 30_000;
/** Busy time after which going idle deserves a word: the median of the Sheet's patience Stat. */
export const LONG_WORK_MS = MEDIAN.longWorkMs;
/** Files in the session diff from which the Tamago calls it a big site. */
export const BIG_DIFF_FILES = 10;
/** Window of failures that make a streak, and their count: the median of the Sheet's sensitivity Stat. */
export const STREAK_MS = 30_000;
export const STREAK_COUNT = MEDIAN.streakCount;

/** Tuning table: a higher priority may interrupt the quiet window; Infinity means once per Session. */
export const CUES: Record<Cue, { priority: number; cooldown: number }> = {
  permission: { priority: 1, cooldown: 120_000 },
  granted: { priority: 2, cooldown: 0 },
  denied: { priority: 2, cooldown: 0 },
  woke: { priority: 1, cooldown: 0 },
  long_work: { priority: 1, cooldown: 0 },
  big_diff: { priority: 1, cooldown: Infinity },
  streak: { priority: 2, cooldown: 60_000 },
  compacted: { priority: 2, cooldown: 0 },
  retried: { priority: 2, cooldown: 60_000 },
  todos_done: { priority: 2, cooldown: 0 },
  evolved: { priority: 3, cooldown: 0 },
  hatched: { priority: 3, cooldown: 0 },
};

/** At least one phrase; a test bounds each to MAX_TEXT. */
export type Phrases = readonly [string, ...string[]];

/** English, like the Moods. Every phrase is at most MAX_TEXT characters; a test enforces it. */
export const PHRASES: Record<Cue, Phrases> = {
  permission: ["May I?", "Your call.", "Say the word."],
  granted: ["Thanks!", "On it.", "Much obliged."],
  denied: ["Oh. Okay.", "Fair enough.", "Noted."],
  woke: ["Mmh? Already?", "Was I out long?"],
  long_work: ["Phew. Done.", "That was a big one."],
  big_diff: ["Quite the site here.", "That's a lot of files."],
  streak: ["It keeps biting.", "Ow. Ow. Ow.", "Not my day."],
  compacted: ["My head feels empty.", "What were we doing?"],
  retried: ["Again? Fine.", "Once more, then."],
  todos_done: ["And that's a wrap.", "All ticked off."],
  evolved: ["I feel... different.", "Look at me now."],
  hatched: ["So this is what I am.", "Out at last!", "Hello, world."],
};

/** Phrases per Temperament for every Cue: the Temperament Register. English, at most MAX_TEXT characters each; a test enforces the coverage. */
export const FLAVOR: Record<Temperament, Record<Cue, Phrases>> = {
  cheerful: {
    permission: ["Can we? Can we?", "Ooh, say yes!", "Pretty please?"],
    granted: ["Yay! On it.", "Thank youuu!", "Best human."],
    denied: ["Aw. Okay!", "No worries!", "Next time then!"],
    woke: ["Morning! Is it?", "Nap's over, yay!", "Hi hi! I'm up!"],
    long_work: ["We did it! Phew!", "Big one! High five!", "Look at us go!"],
    big_diff: ["So many files! Wow!", "Big day, big diff!", "Ooh, a whole site!"],
    streak: ["We got this!", "Shake it off!", "Still smiling."],
    compacted: ["Whoa, lighter head!", "Fresh start! Fun!", "Where were we? Yay!"],
    retried: ["Try again! Woo!", "Second time lucky!", "Go go go!"],
    todos_done: ["All done! Party!", "Every box! Yay!", "We rock!"],
    evolved: ["Look at me go!", "New me, who dis?", "Ta-da!"],
    hatched: ["I'm out! Hi!", "Look, it's me!", "Best day ever."],
  },
  sarcastic: {
    permission: ["Permission, boss?", "Mother, may I?", "Shall I wait more?"],
    granted: ["How generous.", "Finally.", "About time."],
    denied: ["Figures.", "Of course not.", "Noted. Loudly."],
    woke: ["Oh. You're back.", "Was dreaming. Was.", "Rise and whatever."],
    long_work: ["Riveting, truly.", "That took a while.", "Done. Finally."],
    big_diff: ["Bold. Very bold.", "Ten files. Casual.", "Rewriting it all?"],
    streak: ["Going great, huh.", "Third time's a charm?", "Delightful."],
    compacted: ["Memory? Overrated.", "Forgot on purpose.", "Blissful amnesia."],
    retried: ["Sure, that'll work.", "Again. Groundbreaking.", "Insanity, they say."],
    todos_done: ["Wow. Boxes ticked.", "A miracle. Truly.", "Don't strain yourself."],
    evolved: ["Finally.", "Took you long enough.", "Behold. Or don't."],
    hatched: ["Took long enough.", "Behold. Me.", "Well. Here I am."],
  },
  stoic: {
    permission: ["Your call.", "Awaiting word.", "When ready."],
    granted: ["Noted.", "Proceeding.", "Very well."],
    denied: ["Understood.", "As you wish.", "Then we wait."],
    woke: ["Awake.", "Rested. Ready.", "I return."],
    long_work: ["It is done.", "Long. Finished.", "The work held."],
    big_diff: ["Many files.", "A wide change.", "So be it."],
    streak: ["It passes.", "Steady.", "Endure."],
    compacted: ["Cleared.", "Less to carry.", "Begin again."],
    retried: ["Once more.", "Again, then.", "Persist."],
    todos_done: ["Complete.", "All in order.", "Nothing remains."],
    evolved: ["So it goes.", "A new form.", "Onward."],
    hatched: ["I am here.", "It begins.", "So. This form."],
  },
  dreamy: {
    permission: ["Hm? Oh. May I?", "If you like...", "Whenever..."],
    granted: ["Oh, lovely.", "Mm, thank you.", "Off I drift."],
    denied: ["Maybe next time...", "Oh. Alright.", "Never mind, then."],
    woke: ["Mm... was I gone?", "Oh... hello again.", "Still half there..."],
    long_work: ["Was it long? Oh...", "Time drifted by...", "Done... I think."],
    big_diff: ["So many pieces...", "Everything moved...", "Like leaves, files."],
    streak: ["Ow... the stars...", "Everything spins.", "Ouch... again..."],
    compacted: ["Thoughts... gone.", "Softer now...", "What was I saying?"],
    retried: ["Once more, gently.", "Again... alright.", "Loops, like dreams."],
    todos_done: ["All done... lovely.", "Nothing left. Hm.", "Quiet now..."],
    evolved: ["Was that... me?", "Oh. I changed.", "How curious."],
    hatched: ["Oh... hello.", "Am I... out?", "What a soft light."],
  },
};

/** The phrases for a Cue: the Signature of the Species when it has one, else the Temperament's flavor. Replaced by `phrase` in the next task. */
export function phrases(cue: Cue, temperament: Temperament, species?: SpeciesId): Phrases {
  return (species === undefined ? undefined : SIGNATURE[species]?.[cue]) ?? FLAVOR[temperament][cue];
}

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
 * gap, the long-work threshold and the streak count. The Species, when given,
 * speaks its Signature over the Temperament.
 */
export function speak(
  voice: Voice,
  event: TamagoEvent,
  before: Session,
  after: Session,
  now: number,
  temperament: Temperament,
  behavior: Behavior = MEDIAN,
  species?: SpeciesId,
): Voice {
  if (event.type === "tick") {
    return voice.bubble !== undefined && voice.bubble.until <= now ? { ...voice, bubble: undefined } : voice;
  }
  const { voice: next, cue } = listen(voice, event, before, after, now, behavior);
  if (cue === undefined) return next;
  const { priority, cooldown } = CUES[cue];
  const said = next.spoken[cue];
  if (said !== undefined && now - said.at < cooldown) return next;
  if (next.last !== undefined && now - next.last.at < behavior.quietMs && priority <= next.last.priority) return next;
  const times = said?.times ?? 0;
  const pool = phrases(cue, temperament, species);
  const text = pool[times % pool.length] ?? pool[0];
  return {
    ...next,
    bubble: { cue, text, since: now, until: now + behavior.bubbleMs },
    last: { at: now, priority },
    spoken: { ...next.spoken, [cue]: { at: now, times: times + 1 } },
    ...(cue === "permission" ? { asked: now } : {}),
  };
}

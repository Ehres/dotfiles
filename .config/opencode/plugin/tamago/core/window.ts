import { behavior } from "./creature/behavior.ts";
import type { Addressed, TamagoEvent } from "./moment/events.ts";
import { count } from "./career/count.ts";
import { EMPTY_DELTA, addDelta, isEmpty, merge, sameCareer, type Career, type Delta } from "./career/career.ts";
import { cleanName } from "./career/name.ts";
import { initialSession, type Session } from "./moment/session.ts";
import { speakerOf } from "./creature/sheet.ts";
import { evolution, type StageId } from "./career/stage.ts";
import { transition } from "./moment/transition.ts";
import { initialVoice, speak, type Voice } from "./speech/voice.ts";
import { samePicks, type MilestoneId, type TraitId } from "./career/pick.ts";
import { TRAITS, type Trait } from "./choices/trait.ts";

/**
 * Everything one OpenCode window holds in memory about the Tamago: the
 * Career as shown, the Delta not yet flushed, one Session and one Voice per
 * root OpenCode session on screen, and whether the Voice is muted.
 */
export type Window = {
  career: Career;
  pending: Delta;
  sessions: Record<string, Session>;
  voices: Record<string, Voice>;
  muted: boolean;
};

/** What the window must do beyond re-rendering: toast an Evolution, refresh palette titles after a rename, refresh them and say who steps in after a Switch, refresh the Draw after a Pick. */
export type Effect = { type: "evolved"; stage: StageId } | { type: "renamed" } | { type: "switched" } | { type: "chosen" };

export type Step = { window: Window; effects: Effect[] };

export function freshWindow(career: Career, muted = false): Window {
  return { career, pending: EMPTY_DELTA, sessions: {}, voices: {}, muted };
}

/** Moves the Sessions `ids` through `event` with the Behavior of the Career, then lets each Voice hear it as the Career's Speaker unless muted. Same references when nothing changed. */
function move(window: Window, ids: readonly string[], event: TamagoEvent, now: number): Window {
  if (ids.length === 0) return window;
  const conduct = behavior(window.career);
  const before = window.sessions;
  const after: Record<string, Session> = { ...before };
  let moved = false;
  for (const id of ids) {
    const was = before[id] ?? initialSession(now);
    const is = transition(was, event, now, conduct);
    after[id] = is;
    if (is !== was) moved = true;
  }
  let voices = window.voices;
  if (!window.muted) {
    const speaker = speakerOf(window.career);
    const next = { ...voices };
    let spoke = false;
    for (const id of ids) {
      const voice = voices[id] ?? initialVoice();
      const heard = speak(voice, event, before[id] ?? initialSession(now), after[id] ?? initialSession(now), now, speaker, conduct);
      next[id] = heard;
      if (heard !== voice) spoke = true;
    }
    if (spoke) voices = next;
  }
  if (!moved && voices === window.voices) return window;
  return { ...window, sessions: moved ? after : before, voices };
}

/**
 * Shows a Career seen elsewhere, a Flush result or a re-read. Same hatch date:
 * an Evolution reaches every Session, a rename the palette. Another hatch
 * date: a Switch — another Tamago is active now — which is neither an
 * Evolution nor a rename, so nobody speaks and only the palette refreshes.
 */
export function adopt(window: Window, career: Career, now: number): Step {
  if (sameCareer(window.career, career)) return { window, effects: [] };
  if (window.career.hatchedAt !== career.hatchedAt) return { window: { ...window, career }, effects: [{ type: "switched" }] };
  const effects: Effect[] = [];
  const reached = evolution(window.career, career);
  if (window.career.name?.value !== career.name?.value) effects.push({ type: "renamed" });
  if (!samePicks(window.career.picks, career.picks)) effects.push({ type: "chosen" });
  let next: Window = { ...window, career };
  if (reached !== undefined) {
    effects.push({ type: "evolved", stage: reached });
    next = move(next, Object.keys(next.sessions), { type: "evolved", stage: reached }, now);
  }
  return { window: next, effects };
}

/** Adds a Delta earned here: shown at once, kept pending until the Flush. */
function earn(window: Window, delta: Delta, now: number): Step {
  if (isEmpty(delta)) return { window, effects: [] };
  const pending = addDelta(window.pending, delta);
  return adopt({ ...window, pending }, merge(window.career, delta), now);
}

/** One translated event: moves the Sessions it addresses, counts it once. */
export function receive(window: Window, { target, event }: Addressed, now: number): Step {
  let next = window;
  if (event.type === "session_gone") {
    if (target.type === "session") {
      const { [target.id]: _gone, ...sessions } = next.sessions;
      const { [target.id]: _silent, ...voices } = next.voices;
      next = { ...next, sessions, voices };
    }
  } else if (target.type === "session") {
    next = move(next, [target.id], event, now);
  } else if (target.type === "every") {
    next = move(next, Object.keys(next.sessions), event, now);
  }
  return earn(next, count(event), now);
}

/** Time passes for every Session: hurt heals, idle falls asleep, Bubbles expire. */
export function tick(window: Window, now: number): Window {
  return move(window, Object.keys(window.sessions), { type: "tick" }, now);
}

/**
 * A rename is a Delta: shown at once here, flushed like the counters, latest
 * wins across windows. `shown` is the Name on screen, which falls back to the
 * plugin option when the Career stores none: renaming to it changes nothing.
 */
export function rename(window: Window, input: string, now: number, shown: string | undefined = window.career.name?.value): Step {
  const value = cleanName(input);
  if (value === undefined || value === shown) return { window, effects: [] };
  return earn(window, { ...EMPTY_DELTA, rename: { value, at: now } }, now);
}

/** Muting clears every Bubble on screen; while muted no Cue is heard. */
export function setMuted(window: Window, muted: boolean): Window {
  if (window.muted === muted) return window;
  if (!muted) return { ...window, muted };
  const voices: Record<string, Voice> = {};
  for (const [id, voice] of Object.entries(window.voices)) voices[id] = voice.bubble === undefined ? voice : { ...voice, bubble: undefined };
  return { ...window, muted, voices };
}

/** The pending Delta reached the disk: forget it and show what the disk holds. */
export function flushed(window: Window, career: Career, now: number): Step {
  return adopt({ ...window, pending: EMPTY_DELTA }, career, now);
}

/**
 * A Pick is a Delta, like a rename: shown at once here, flushed with the
 * counters, and the earliest Pick per Milestone wins across windows. A
 * Milestone already picked or a Trait this build does not know changes
 * nothing, so a stale dialog can never overwrite a choice.
 */
export function pick(window: Window, milestone: MilestoneId, trait: TraitId, now: number, table: readonly Trait[] = TRAITS): Step {
  if (window.career.picks[milestone] !== undefined) return { window, effects: [] };
  if (!table.some((entry) => entry.id === trait)) return { window, effects: [] };
  return earn(window, { ...EMPTY_DELTA, picks: { [milestone]: { trait, at: now } } }, now);
}

import type { Addressed, TamagoEvent } from "./events.ts";
import { character } from "./character.ts";
import { count } from "./count.ts";
import { merge } from "./merge.ts";
import { cleanName } from "./name.ts";
import { evolution, type StageId } from "./stage.ts";
import { EMPTY_DELTA, addDelta, initialSession, isEmpty, sameCareer, type Career, type Delta, type Session } from "./state.ts";
import { transition } from "./transition.ts";
import { initialVoice, speak, type Voice } from "./voice.ts";

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

/** What the window must do beyond re-rendering: toast an Evolution, refresh palette titles after a rename. */
export type Effect = { type: "evolved"; stage: StageId } | { type: "renamed" };

export type Step = { window: Window; effects: Effect[] };

export function freshWindow(career: Career, muted = false): Window {
  return { career, pending: EMPTY_DELTA, sessions: {}, voices: {}, muted };
}

/** Moves the Sessions `ids` through `event`, then lets each Voice hear it unless muted. Same references when nothing changed. */
function move(window: Window, ids: readonly string[], event: TamagoEvent, now: number): Window {
  if (ids.length === 0) return window;
  const before = window.sessions;
  const after: Record<string, Session> = { ...before };
  let moved = false;
  for (const id of ids) {
    const was = before[id] ?? initialSession(now);
    const is = transition(was, event, now);
    after[id] = is;
    if (is !== was) moved = true;
  }
  let voices = window.voices;
  if (!window.muted) {
    const temperament = character(window.career).temperament;
    const next = { ...voices };
    let spoke = false;
    for (const id of ids) {
      const voice = voices[id] ?? initialVoice();
      const heard = speak(voice, event, before[id] ?? initialSession(now), after[id] ?? initialSession(now), now, temperament);
      next[id] = heard;
      if (heard !== voice) spoke = true;
    }
    if (spoke) voices = next;
  }
  if (!moved && voices === window.voices) return window;
  return { ...window, sessions: moved ? after : before, voices };
}

/** Shows a Career seen elsewhere, a Flush result or a re-read: an Evolution reaches every Session, a rename the palette. */
export function adopt(window: Window, career: Career, now: number): Step {
  if (sameCareer(window.career, career)) return { window, effects: [] };
  const effects: Effect[] = [];
  const reached = evolution(window.career, career);
  if (window.career.name?.value !== career.name?.value) effects.push({ type: "renamed" });
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

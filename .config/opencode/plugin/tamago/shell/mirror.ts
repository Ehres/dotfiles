import { createMemo, createSignal, type Accessor } from "solid-js";
import { sameCareer, type Career } from "../core/career/career.ts";
import type { Language } from "../core/language.ts";
import type { Session } from "../core/moment/session.ts";
import type { Voice } from "../core/speech/voice.ts";
import { tamago, type Tamago } from "../core/tamago.ts";
import type { Effect, Step, Window } from "../core/window.ts";

export type Mirror = {
  readonly current: () => Window;
  career: Accessor<Career>;
  /** One mood per root OpenCode session, keyed by session id. Never persisted. */
  sessions: Accessor<Record<string, Session>>;
  /** One Voice per root OpenCode session, keyed like `sessions`. Never persisted. */
  voices: Accessor<Record<string, Voice>>;
  /** Persisted through api.kv; when muted no Cue is heard and every Bubble is cleared. */
  muted: Accessor<boolean>;
  /** Persisted through api.kv; every phrase the user reads is said in it. */
  language: Accessor<Language>;
  /** The active Tamago, read from the Career once per change: Stage, Sheet, Behavior, Character. Derived, never stored; every window computes the same. */
  active: Accessor<Tamago>;
  /** The Name lives in the Career, so a rename in one window reaches the others on flush. */
  name: Accessor<string>;
  commit(next: Window): void;
  run(step: Step): void;
};

/**
 * The Window is the truth; core/window.ts moves it. Its parts are mirrored
 * into one signal each, so a view re-renders only for the part it reads.
 * `run` commits first, then performs the effects, so a toast reads the new Name.
 */
export function createMirror(initial: Window, defaultName: string, onEffect: (effect: Effect) => void): Mirror {
  let window = initial;
  const [career, setCareer] = createSignal<Career>(window.career, { equals: sameCareer });
  const [sessions, setSessions] = createSignal<Record<string, Session>>(window.sessions);
  const [voices, setVoices] = createSignal<Record<string, Voice>>(window.voices);
  const [muted, setMuted] = createSignal(window.muted);
  const [language, setLanguage] = createSignal<Language>(window.language);
  const active = createMemo(() => tamago(career()));
  const name = (): string => career().name?.value ?? defaultName;
  /** Makes `next` the Window and mirrors each changed part into its signal; an untouched part re-renders nobody. */
  const commit = (next: Window) => {
    const prev = window;
    window = next;
    if (next.career !== prev.career) setCareer(next.career);
    if (next.sessions !== prev.sessions) setSessions(next.sessions);
    if (next.voices !== prev.voices) setVoices(next.voices);
    if (next.muted !== prev.muted) setMuted(next.muted);
    if (next.language !== prev.language) setLanguage(next.language);
  };
  return {
    current: () => window,
    career,
    sessions,
    voices,
    muted,
    language,
    active,
    name,
    commit,
    /** Commits a Step, then performs its effects with the new Name already on screen. */
    run({ window: next, effects }: Step) {
      commit(next);
      for (const effect of effects) onEffect(effect);
    },
  };
}

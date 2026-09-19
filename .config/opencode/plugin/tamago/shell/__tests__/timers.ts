import type { Timers } from "../tick.ts";

/** Fake timers: `fire()` runs the earliest pending callback. */
export function fakeTimers() {
  const pending: { at: number; fn: () => void; id: number }[] = [];
  let id = 0;
  let clock = 0;
  const timers: Timers = {
    setTimeout: ((fn: () => void, ms: number) => {
      pending.push({ at: clock + ms, fn, id: ++id });
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout,
    clearTimeout: ((handle: unknown) => {
      const at = pending.findIndex((entry) => entry.id === handle);
      if (at >= 0) pending.splice(at, 1);
    }) as unknown as typeof clearTimeout,
  };
  const fire = () => {
    pending.sort((a, b) => a.at - b.at);
    const next = pending.shift();
    if (next === undefined) throw new Error("nothing pending");
    clock = next.at;
    next.fn();
    return next.at;
  };
  return { timers, fire, pending };
}

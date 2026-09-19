import { backoff } from "../core/store/retry.ts";
import type { Timers } from "./tick.ts";

const REAL: Timers = { setTimeout, clearTimeout };

/** The Flush loop: `persist` every `base` ms; on a thrown disk error, back off up to `max` and count consecutive failures for `onError`. */
export function createFlushLoop(deps: {
  persist: () => boolean;
  onError: (err: unknown, failures: number) => void;
  base: number;
  max: number;
  timers?: Timers;
}): { start(): void; stop(): void } {
  const timers = deps.timers ?? REAL;
  /** Consecutive disk failures. Drives the backoff and the single "cannot save" toast. */
  let failures = 0;
  let handle: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    handle = timers.setTimeout(flush, backoff(failures, deps.base, deps.max));
  };
  const flush = () => {
    try {
      deps.persist();
      failures = 0;
    } catch (err) {
      failures += 1;
      deps.onError(err, failures);
    }
    schedule();
  };
  return {
    start: schedule,
    stop() {
      if (handle !== undefined) timers.clearTimeout(handle);
      handle = undefined; // a second stop is a no-op, and a start after a stop cannot leave two loops running
    },
  };
}

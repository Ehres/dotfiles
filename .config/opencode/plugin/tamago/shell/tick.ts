export type Timers = { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout };

const REAL: Timers = { setTimeout, clearTimeout };

/** The Tick loop: after each tick, waits `interval()` (fast while a session shows effort, slow otherwise). */
export function createTicker(deps: {
  interval: () => number;
  onTick: (now: number) => void;
  now?: () => number;
  timers?: Timers;
}): { start(): void; stop(): void } {
  const timers = deps.timers ?? REAL;
  const now = deps.now ?? Date.now;
  let handle: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    handle = timers.setTimeout(tick, deps.interval());
  };
  const tick = () => {
    deps.onTick(now());
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

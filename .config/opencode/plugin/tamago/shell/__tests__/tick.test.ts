import { expect, test } from "bun:test";
import { createTicker } from "../tick.ts";
import { fakeTimers } from "./timers.ts";

test("each tick reads the clock, then waits the interval asked for now", () => {
  const { timers, fire, pending } = fakeTimers();
  const ticks: number[] = [];
  let fast = true;
  let clock = 10;
  const ticker = createTicker({
    interval: () => (fast ? 500 : 2_000),
    onTick: (now) => {
      ticks.push(now);
      clock = now + 1;
      fast = !fast;
    },
    now: () => clock,
    timers,
  });

  ticker.start();
  expect(pending.length).toBe(1);

  expect(fire()).toBe(500); // the first wait is the fast interval
  expect(ticks).toEqual([10]);

  expect(fire()).toBe(2_500); // the tick turned it slow, so the next wait is 2000
  expect(ticks).toEqual([10, 11]);

  ticker.stop();
  expect(pending.length).toBe(0);
  expect(() => ticker.stop()).not.toThrow(); // the handle is forgotten, so a second stop is a no-op
  expect(pending.length).toBe(0);
});

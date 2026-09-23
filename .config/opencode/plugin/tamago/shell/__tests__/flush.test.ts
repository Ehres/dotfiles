import { expect, test } from "bun:test";
import { createFlushLoop } from "../flush.ts";
import { fakeTimers } from "./timers.ts";

const BASE = 1_000;
const MAX = 60_000;
const IDLE = 10_000;

test("a disk error backs the flush off and counts consecutive failures; a success resets both", () => {
  const { timers, fire, pending } = fakeTimers();
  const failed: number[] = [];
  let broken = false;
  const loop = createFlushLoop({
    persist: () => {
      if (broken) throw new Error("disk");
      return true;
    },
    onError: (_err, failures) => failed.push(failures),
    base: BASE,
    max: MAX,
    timers,
  });

  loop.start();
  expect(fire()).toBe(BASE); // the first flush, one base after the start
  expect(failed).toEqual([]);

  broken = true;
  expect(fire()).toBe(2 * BASE); // the success left the next one at base
  expect(failed).toEqual([1]);

  expect(fire()).toBe(4 * BASE); // one failure: twice the base
  expect(failed).toEqual([1, 2]);

  broken = false;
  expect(fire()).toBe(8 * BASE); // two failures: four times the base
  expect(failed).toEqual([1, 2]);

  expect(fire()).toBe(9 * BASE); // the success is back to base
  expect(failed).toEqual([1, 2]);

  loop.stop();
  expect(pending.length).toBe(0);
  expect(() => loop.stop()).not.toThrow(); // the handle is forgotten, so a second stop is a no-op
  expect(pending.length).toBe(0);
});

test("a window with nothing of its own to write polls at the idle delay, and returns to base as soon as it has work", () => {
  const { timers, fire } = fakeTimers();
  let idle = true;
  const loop = createFlushLoop({
    persist: () => true,
    onError: () => {},
    base: BASE,
    max: MAX,
    idle: IDLE,
    isIdle: () => idle,
    timers,
  });

  loop.start();
  expect(fire()).toBe(IDLE); // idle when the loop was armed: the long delay
  expect(fire()).toBe(2 * IDLE); // still nothing of ours to write

  idle = false;
  expect(fire()).toBe(3 * IDLE); // this one was armed while idle; it re-arms at base
  expect(fire()).toBe(3 * IDLE + BASE); // something to write now

  idle = true;
  expect(fire()).toBe(3 * IDLE + 2 * BASE); // armed while busy
  expect(fire()).toBe(4 * IDLE + 2 * BASE); // and back to the idle delay
  loop.stop();
});

test("the backoff doubles the delay in force, idle or not", () => {
  const { timers, fire } = fakeTimers();
  const loop = createFlushLoop({
    persist: () => {
      throw new Error("disk");
    },
    onError: () => {},
    base: BASE,
    max: MAX,
    idle: IDLE,
    isIdle: () => true,
    timers,
  });

  loop.start();
  expect(fire()).toBe(IDLE); // the first attempt, one idle delay after the start
  expect(fire()).toBe(3 * IDLE); // one failure: twice the idle delay, not twice the base
  loop.stop();
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVITIES } from "./state.ts";
import { CADENCE, frameIndex, tickInterval } from "./cadence.ts";
import { MEDIAN, type Behavior } from "./behavior.ts";

const FAST_MS = MEDIAN.fastMs;
const SLOW_MS = MEDIAN.slowMs;

test("fast activities advance one frame every FAST_MS of elapsed time", () => {
  assert.equal(frameIndex("working", 0), 0);
  assert.equal(frameIndex("working", FAST_MS - 1), 0);
  assert.equal(frameIndex("working", FAST_MS), 1);
  assert.equal(frameIndex("thinking", 7 * FAST_MS), 7);
});

test("slow activities advance one frame every SLOW_MS of elapsed time", () => {
  assert.equal(frameIndex("idle", SLOW_MS - 1), 0);
  assert.equal(frameIndex("idle", SLOW_MS), 1);
  assert.equal(frameIndex("waiting", 2 * SLOW_MS), 2);
  assert.equal(frameIndex("hurt", 2 * SLOW_MS), 2);
});

test("sleeping never animates", () => {
  assert.equal(frameIndex("sleeping", 0), 0);
  assert.equal(frameIndex("sleeping", 999_999), 0);
});

test("the tick runs fast while any session thinks, works or heals, slow otherwise", () => {
  assert.equal(tickInterval([]), SLOW_MS);
  assert.equal(tickInterval(["idle", "sleeping", "waiting"]), SLOW_MS);
  assert.equal(tickInterval(["idle", "working"]), FAST_MS);
  assert.equal(tickInterval(["thinking"]), FAST_MS);
  assert.equal(tickInterval(["hurt"]), FAST_MS, "hurt recovers on a 3 s timer and must be checked often");
});

test("the slow cadence is a whole multiple of the fast one, so a mode switch never skips or repeats a frame", () => {
  assert.equal(SLOW_MS % FAST_MS, 0);
});

test("every Activity has a cadence entry naming its frame pace, so a new Activity cannot silently fall back to a default", () => {
  for (const activity of ACTIVITIES) {
    assert.ok(activity in CADENCE, `${activity} missing from CADENCE`);
    assert.ok([undefined, "fast", "slow"].includes(CADENCE[activity].frame), `${activity} frame`);
  }
});

test("frameIndex and tickInterval follow an injected Behavior; the default is still MEDIAN", () => {
  const brisk: Behavior = { ...MEDIAN, fastMs: 250, slowMs: 1_000 };
  assert.equal(frameIndex("working", 249, brisk), 0);
  assert.equal(frameIndex("working", 250, brisk), 1);
  assert.equal(frameIndex("idle", 1_000, brisk), 1);
  assert.equal(frameIndex("idle", 1_000), 0, "SLOW_MS is 2 000 without a Behavior");
  assert.equal(frameIndex("sleeping", 999_999, brisk), 0);
  assert.equal(tickInterval(["working"], brisk), 250);
  assert.equal(tickInterval(["idle", "sleeping"], brisk), 1_000);
  assert.equal(tickInterval([], brisk), 1_000);
});

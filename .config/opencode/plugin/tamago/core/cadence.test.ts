import { test } from "node:test";
import assert from "node:assert/strict";
import { frameIndex, SLOW_FRAME_TICKS } from "./cadence.ts";

test("working and thinking advance one frame per tick", () => {
  assert.equal(frameIndex("working", 7), 7);
  assert.equal(frameIndex("thinking", 7), 7);
});

test("idle, waiting and hurt advance once every SLOW_FRAME_TICKS ticks", () => {
  assert.equal(frameIndex("idle", SLOW_FRAME_TICKS - 1), 0);
  assert.equal(frameIndex("idle", SLOW_FRAME_TICKS), 1);
  assert.equal(frameIndex("waiting", 2 * SLOW_FRAME_TICKS), 2);
  assert.equal(frameIndex("hurt", 2 * SLOW_FRAME_TICKS), 2);
});

test("sleeping never animates", () => {
  assert.equal(frameIndex("sleeping", 0), 0);
  assert.equal(frameIndex("sleeping", 999), 0);
});

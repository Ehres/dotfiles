import { test } from "node:test";
import assert from "node:assert/strict";
import { SPRITE_HEIGHT, SPRITE_WIDTH, frameAt, frames } from "./sprites.ts";
import { STAGES } from "./stage.ts";
import { ACTIVITIES } from "./state.ts";

test("every stage and activity has at least one frame", () => {
  for (const { id } of STAGES) {
    for (const activity of ACTIVITIES) {
      assert.ok(frames(id, activity).length >= 1, `${id}/${activity}`);
    }
  }
});

test("every frame is exactly SPRITE_HEIGHT lines of SPRITE_WIDTH columns", () => {
  for (const { id } of STAGES) {
    for (const activity of ACTIVITIES) {
      for (const [i, frame] of frames(id, activity).entries()) {
        assert.equal(frame.length, SPRITE_HEIGHT, `${id}/${activity} frame ${i} height`);
        for (const [j, line] of frame.entries()) {
          assert.equal(line.length, SPRITE_WIDTH, `${id}/${activity} frame ${i} line ${j}: ${JSON.stringify(line)}`);
        }
      }
    }
  }
});

test("working has more than one frame so it animates, sleeping has exactly one", () => {
  assert.ok(frames("egg", "working").length > 1);
  assert.equal(frames("egg", "sleeping").length, 1);
});

test("frameAt wraps around the frame count", () => {
  const all = frames("hatchling", "idle");
  assert.deepEqual(frameAt("hatchling", "idle", all.length), all[0]);
  assert.deepEqual(frameAt("hatchling", "idle", all.length + 1), all[1]);
});

test("frames only contain printable ASCII", () => {
  for (const { id } of STAGES) {
    for (const activity of ACTIVITIES) {
      for (const frame of frames(id, activity)) {
        for (const line of frame) assert.match(line, /^[\x20-\x7e]*$/, `${id}/${activity}: ${line}`);
      }
    }
  }
});

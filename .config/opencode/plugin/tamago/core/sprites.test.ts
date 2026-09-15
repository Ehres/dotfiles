import { test } from "node:test";
import assert from "node:assert/strict";
import { HEART, SPRITE_HEIGHT, SPRITE_WIDTH, frameAt, frames, heartFrame } from "./sprites.ts";
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

test("frames and frameAt return the same objects for the same inputs, so memos stay stable", () => {
  assert.equal(frames("young", "idle"), frames("young", "idle"));
  assert.equal(frameAt("young", "idle", 0), frameAt("young", "idle", 0));
  assert.equal(frameAt("young", "idle", 0), frameAt("young", "idle", 2), "index wraps onto the same frame object");
  assert.notEqual(frameAt("young", "idle", 0), frameAt("young", "idle", 1));
});

test("the heart frame keeps the sprite size, shows happy eyes and a heart, and is stable", () => {
  for (const entry of STAGES) {
    const frame = heartFrame(entry.id);
    assert.equal(frame.length, SPRITE_HEIGHT);
    for (const line of frame) assert.equal(line.length, SPRITE_WIDTH, `${entry.id}: ${JSON.stringify(line)}`);
    assert.ok(frame[0]?.includes(HEART), `${entry.id} wears the heart on line 0`);
    assert.ok(frame.some((line) => line.includes("^ ^")), `${entry.id} smiles`);
    assert.equal(heartFrame(entry.id), frame);
  }
});

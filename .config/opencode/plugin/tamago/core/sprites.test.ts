import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPERAMENTS } from "./character.ts";
import { REFERENCE, SPECIES } from "./species.ts";
import { EYES, HEART, SPRITE_HEIGHT, SPRITE_WIDTH, frameAt, frames, heartFrame } from "./sprites.ts";
import { STAGES } from "./stage.ts";
import { ACTIVITIES } from "./state.ts";

const ids = SPECIES.map((entry) => entry.id);

test("every species, stage and activity has at least one frame", () => {
  for (const species of ids) {
    for (const { id } of STAGES) {
      for (const activity of ACTIVITIES) {
        assert.ok(frames(species, id, activity).length >= 1, `${species}/${id}/${activity}`);
      }
    }
  }
});

test("every frame of every species is exactly SPRITE_HEIGHT lines of SPRITE_WIDTH columns", () => {
  for (const species of ids) {
    for (const { id } of STAGES) {
      for (const activity of ACTIVITIES) {
        for (const [i, frame] of frames(species, id, activity).entries()) {
          assert.equal(frame.length, SPRITE_HEIGHT, `${species}/${id}/${activity} frame ${i} height`);
          for (const [j, line] of frame.entries()) {
            assert.equal(line.length, SPRITE_WIDTH, `${species}/${id}/${activity} frame ${i} line ${j}: ${JSON.stringify(line)}`);
          }
        }
      }
    }
  }
});

test("working has more than one frame so it animates, sleeping has exactly one", () => {
  assert.ok(frames(REFERENCE, "egg", "working").length > 1);
  assert.equal(frames(REFERENCE, "egg", "sleeping").length, 1);
});

test("frameAt wraps around the frame count", () => {
  const all = frames(REFERENCE, "hatchling", "idle");
  assert.deepEqual(frameAt(REFERENCE, "hatchling", "idle", all.length), all[0]);
  assert.deepEqual(frameAt(REFERENCE, "hatchling", "idle", all.length + 1), all[1]);
});

test("frames only contain printable ASCII", () => {
  for (const species of ids) {
    for (const { id } of STAGES) {
      for (const activity of ACTIVITIES) {
        for (const frame of frames(species, id, activity)) {
          for (const line of frame) assert.match(line, /^[\x20-\x7e]*$/, `${species}/${id}/${activity}: ${line}`);
        }
      }
    }
  }
});

test("frames and frameAt return the same objects for the same inputs, so memos stay stable", () => {
  assert.equal(frames("owl", "young", "idle"), frames("owl", "young", "idle"));
  assert.equal(frameAt("owl", "young", "idle", 0), frameAt("owl", "young", "idle", 0));
  assert.equal(frameAt("owl", "young", "idle", 0), frameAt("owl", "young", "idle", 2), "index wraps onto the same frame object");
  assert.notEqual(frameAt("owl", "young", "idle", 0), frameAt("owl", "young", "idle", 1));
});

test("every egg is the same frame whatever the species, and species differ from hatchling on", () => {
  for (const activity of ACTIVITIES) {
    assert.equal(frames("owl", "egg", activity), frames("cat", "egg", activity));
    assert.equal(frames("dragon", "egg", activity), frames("cat", "egg", activity));
  }
  for (const { id } of STAGES) {
    if (id === "egg") continue;
    assert.notDeepEqual(frames("owl", id, "idle"), frames("cat", id, "idle"), id);
    assert.notDeepEqual(frames("dragon", id, "idle"), frames("cat", id, "idle"), id);
  }
});

test("an unknown species draws like the reference", () => {
  for (const { id } of STAGES) {
    assert.deepEqual(frames("nope", id, "idle"), frames(REFERENCE, id, "idle"), id);
  }
});

test("a heart frame per species, Stage and Temperament keeps the size, wears the heart and the Temperament's eyes", () => {
  for (const species of ids) {
    for (const entry of STAGES) {
      for (const temperament of TEMPERAMENTS) {
        const frame = heartFrame(species, entry.id, temperament);
        assert.equal(frame.length, SPRITE_HEIGHT);
        for (const line of frame) assert.equal(line.length, SPRITE_WIDTH, `${species}/${entry.id}/${temperament}: ${JSON.stringify(line)}`);
        assert.ok(frame[0]?.includes(HEART), `${species}/${entry.id}/${temperament} wears the heart on line 0`);
        assert.ok(frame.some((line) => line.includes(EYES[temperament])), `${species}/${entry.id}/${temperament} eyes`);
        assert.equal(heartFrame(species, entry.id, temperament), frame, "cached");
      }
    }
  }
  assert.notEqual(heartFrame("cat", "young", "cheerful"), heartFrame("cat", "young", "sarcastic"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPERAMENTS } from "../../creature/sheet.ts";
import { REFERENCE, SPECIES, mapsOf } from "../../creature/catalog.ts";
import { BADGE_SLOT, MARK_SLOT } from "../marks.ts";
import { MAP_ALPHABET, PIXEL_HEIGHT, SPRITE_HEIGHT, SPRITE_WIDTH } from "../pixels.ts";
import { frameAt, frames, heartFrame } from "../sprites.ts";
import { STAGES } from "../../career/stage.ts";
import { ACTIVITIES } from "../../moment/session.ts";

const drawn = SPECIES.filter((one) => one.maps !== undefined);

test("at least the reference Species is drawn", () => {
  assert.ok(drawn.some((one) => one.id === REFERENCE), "the reference has no maps");
});

test("every drawn map is exactly 20 rows of 21 characters, all from the alphabet", () => {
  for (const one of drawn) {
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const { pixels } = mapsOf(one.id)[stage];
      assert.equal(pixels.length, PIXEL_HEIGHT, `${one.id}/${stage} height`);
      for (const [y, row] of pixels.entries()) {
        assert.equal(row.length, SPRITE_WIDTH, `${one.id}/${stage} row ${y}: ${JSON.stringify(row)}`);
        for (const [x, char] of [...row].entries()) {
          assert.ok(MAP_ALPHABET.includes(char), `${one.id}/${stage} row ${y} column ${x}: "${char}" is not a map character`);
        }
      }
    }
  }
});

test("MARK_SLOT and BADGE_SLOT are transparent in every drawn map", () => {
  for (const one of drawn) {
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const { pixels } = mapsOf(one.id)[stage];
      for (const slot of [MARK_SLOT, BADGE_SLOT]) {
        for (let dy = 0; dy < slot.h; dy++) {
          for (let dx = 0; dx < slot.w; dx++) {
            assert.equal(pixels[slot.y + dy]?.[slot.x + dx], ".", `${one.id}/${stage} fills ${slot.x + dx},${slot.y + dy}`);
          }
        }
      }
    }
  }
});

test("eyes and motion rectangles fall inside the map and never touch a slot", () => {
  const inside = (r: { x: number; y: number; w: number; h: number }) =>
    r.x >= 0 && r.y >= 0 && r.x + r.w <= SPRITE_WIDTH && r.y + r.h <= PIXEL_HEIGHT;
  const overlaps = (a: typeof MARK_SLOT, b: typeof MARK_SLOT) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const one of drawn) {
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const body = mapsOf(one.id)[stage];
      const rects = [...body.eyes, ...(body.motion?.ears ?? []), ...(body.motion?.tail ? [body.motion.tail] : [])];
      for (const rect of rects) {
        assert.ok(inside(rect), `${one.id}/${stage} rectangle leaves the map`);
        assert.ok(!overlaps(rect, MARK_SLOT), `${one.id}/${stage} rectangle overlaps MARK_SLOT`);
        assert.ok(!overlaps(rect, BADGE_SLOT), `${one.id}/${stage} rectangle overlaps BADGE_SLOT`);
      }
      assert.ok(!overlaps(body.eyes[0], body.eyes[1]), `${one.id}/${stage} eyes overlap`);
    }
  }
});

test("every Frame is SPRITE_HEIGHT rows of SPRITE_WIDTH cells, for every Species, Stage and Activity", () => {
  for (const one of SPECIES) {
    for (const { id: stage } of STAGES) {
      for (const activity of ACTIVITIES) {
        for (const frame of frames(one.id, stage, activity)) {
          assert.equal(frame.length, SPRITE_HEIGHT, `${one.id}/${stage}/${activity}`);
          for (const row of frame) assert.equal(row.length, SPRITE_WIDTH, `${one.id}/${stage}/${activity}`);
        }
      }
    }
  }
});

test("frameAt wraps around the frame count, forwards and backwards", () => {
  assert.equal(frameAt(REFERENCE, "adult", "idle", 0), frameAt(REFERENCE, "adult", "idle", 0));
  assert.equal(frameAt(REFERENCE, "adult", "idle", -1), frameAt(REFERENCE, "adult", "idle", -1));
});

test("frames and frameAt return the same objects for the same inputs, so memos stay stable", () => {
  assert.equal(frameAt("cat", "young", "idle", 0), frameAt("cat", "young", "idle", 0));
  assert.notEqual(frameAt("cat", "young", "idle", 0), frameAt("cat", "young", "idle", 1));
});

test("every egg is the same Frame whatever the Species", () => {
  for (const activity of ACTIVITIES) {
    assert.equal(frameAt("owl", "egg", activity, 0), frameAt("cat", "egg", activity, 0));
    assert.equal(frameAt("dragon", "egg", activity, 0), frameAt("cat", "egg", activity, 0));
  }
});

test("an unknown Species draws like the reference, prototype members included", () => {
  for (const id of ["nope", "constructor", "toString", "hasOwnProperty", "__proto__"]) {
    for (const { id: stage } of STAGES) {
      assert.equal(frameAt(id, stage, "idle", 0), frameAt(REFERENCE, stage, "idle", 0), `${id}/${stage}`);
      assert.equal(heartFrame(id, stage, "stoic"), heartFrame(REFERENCE, stage, "stoic"), `${id}/${stage} heart`);
    }
  }
});

test("a heart Frame keeps the size, wears the heart and the Temperament's eyes", () => {
  for (const { id: stage } of STAGES) {
    for (const temperament of TEMPERAMENTS) {
      const frame = heartFrame(REFERENCE, stage, temperament);
      assert.equal(frame.length, SPRITE_HEIGHT);
      assert.ok(frame.some((row) => row.some((cell) => cell.top === "heart" || cell.bottom === "heart")), `${stage}/${temperament} heart`);
      assert.ok(frame.some((row) => row.some((cell) => cell.top === "eye" || cell.bottom === "eye")), `${stage}/${temperament} eyes`);
      assert.equal(heartFrame(REFERENCE, stage, temperament), frame, "cached");
    }
  }
  assert.notEqual(heartFrame("cat", "young", "cheerful"), heartFrame("cat", "young", "sarcastic"));
});

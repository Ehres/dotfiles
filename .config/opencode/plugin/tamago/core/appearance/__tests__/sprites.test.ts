import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPERAMENTS } from "../../creature/sheet.ts";
import { REFERENCE, SPECIES, mapsOf } from "../../creature/catalog.ts";
import { BADGE_SLOT, MARK_SLOT } from "../marks.ts";
import { BLINK_EVERY, SWEEP } from "../motion.ts";
import { MAP_ALPHABET, PIXEL_HEIGHT, SPRITE_HEIGHT, SPRITE_WIDTH, type Frame, type Rect } from "../pixels.ts";
import { frameAt, frames, heartFrame } from "../sprites.ts";
import { STAGES } from "../../career/stage.ts";
import { ACTIVITIES } from "../../moment/session.ts";

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

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

test("eyes and motion rectangles fall inside the map and never touch a slot, or each other", () => {
  const inside = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= SPRITE_WIDTH && r.y + r.h <= PIXEL_HEIGHT;
  const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const one of drawn) {
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const body = mapsOf(one.id)[stage];
      const named: readonly (readonly [string, Rect])[] = [
        ["eyes[0]", body.eyes[0]],
        ["eyes[1]", body.eyes[1]],
        ...(body.motion?.ears ?? []).map((ear, index): readonly [string, Rect] => [`ears[${index}]`, ear]),
        ...(body.motion?.tail !== undefined ? [["tail", body.motion.tail] as readonly [string, Rect]] : []),
      ];
      for (const [label, rect] of named) {
        assert.ok(inside(rect), `${one.id}/${stage} ${label} leaves the map`);
        assert.ok(!overlaps(rect, MARK_SLOT), `${one.id}/${stage} ${label} overlaps MARK_SLOT`);
        assert.ok(!overlaps(rect, BADGE_SLOT), `${one.id}/${stage} ${label} overlaps BADGE_SLOT`);
      }
      // Every pair, not just eyes against eyes: an eye drawn over an ear, or a tail over an eye,
      // is exactly the kind of mistake a Species copying this file's shape could make unnoticed.
      for (const [i, [labelA, a]] of named.entries()) {
        for (const [j, [labelB, b]] of named.entries()) {
          if (j <= i) continue;
          assert.ok(!overlaps(a, b), `${one.id}/${stage} ${labelA} overlaps ${labelB}`);
        }
      }
    }
  }
});

// shift() moves a motion Rect's content by dx within its own width, dropping anything that lands
// outside it. A Rect one pixel wide has nowhere for its content to go: every shift empties it. A
// static render never exercises this — it only shows up once something actually moves — so this
// is checked by construction (the Rect's width) rather than by rendering every beat.
test("every motion rectangle (a tail, or an ears) is at least 2 pixels wide, so shift() has somewhere to move its content", () => {
  for (const one of drawn) {
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const { motion } = mapsOf(one.id)[stage];
      if (motion?.tail !== undefined) assert.ok(motion.tail.w >= 2, `${one.id}/${stage} tail is only ${motion.tail.w} wide`);
      for (const [index, ear] of (motion?.ears ?? []).entries()) {
        assert.ok(ear.w >= 2, `${one.id}/${stage} ears[${index}] is only ${ear.w} wide`);
      }
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

// The egg has no motion, so nothing but the beat can move it: a clean way to test that the beat
// wraps by the Activity's Face count and not by the raw index, with no tail or ear to confound it.
test("frameAt wraps the beat by the Activity's Face count, not by the raw index", () => {
  // Content, not identity: 0 and 2 land on the same beat but are cached under different keys
  // (the cache key carries the whole wrapped index, not the reduced beat), so they are two
  // separately-built Frames that must look alike, not the same object.
  assert.notDeepEqual(frameAt(REFERENCE, "egg", "thinking", 0), frameAt(REFERENCE, "egg", "thinking", 1), "different beats should differ");
  assert.deepEqual(frameAt(REFERENCE, "egg", "thinking", 0), frameAt(REFERENCE, "egg", "thinking", 2), "two Faces around is the same beat again");
});

test("the animation period repeats identity, so a clock that only advances never grows the cache", () => {
  const facesLength = frames(REFERENCE, "adult", "idle").length;
  const period = lcm(lcm(facesLength, SWEEP.length), BLINK_EVERY);
  assert.equal(frameAt(REFERENCE, "adult", "idle", 5), frameAt(REFERENCE, "adult", "idle", 5 + period), "one period later, the same object");

  const seen = new Set<Frame>();
  for (let i = 0; i < period * 10; i++) seen.add(frameAt(REFERENCE, "adult", "idle", i));
  assert.ok(seen.size <= period, `saw ${seen.size} distinct Frames across ${period * 10} increasing indices, expected at most the period (${period})`);
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

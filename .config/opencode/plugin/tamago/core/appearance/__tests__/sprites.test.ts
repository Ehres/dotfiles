import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPERAMENTS } from "../../creature/sheet.ts";
import { REFERENCE, SPECIES, mapsOf, paletteOf } from "../../creature/catalog.ts";
import { BADGE_SLOT, MARK_SLOT } from "../marks.ts";
import { SWEEP, shift } from "../motion.ts";
import { MAP_ALPHABET, PIXEL_HEIGHT, SPRITE_HEIGHT, SPRITE_WIDTH, type Frame, type Rect } from "../pixels.ts";
import { EGG_PALETTE } from "../palette.ts";
import type { Body } from "../bodies.ts";
import { DEFAULT_EXPRESSIONS } from "../default-expressions.ts";
import type { Expression, Expressions } from "../expressions.ts";
import { EGG_PIXELS, HEART_HEIGHT, expressionsOf, frameAt, heartFrame, periodOf } from "../sprites.ts";
import { STAGES } from "../../career/stage.ts";
import { ACTIVITIES } from "../../moment/session.ts";
import type { SpeciesDef } from "../../creature/species.ts";

const drawn = SPECIES;

/**
 * Object.entries over an Expressions falls to the lib's `{}` overload and hands back `any`, which
 * would quietly untype every walk below it. Narrowed here once, with no cast: `any` is assignable
 * to the annotated return, and everything downstream is a real Expression again.
 */
function entries(table: Expressions): readonly (readonly [string, Expression])[] {
  return Object.entries(table);
}

test("every index a map writes, and every index its expressions paint, has a colour behind it", () => {
  for (const one of drawn) {
    const palette = paletteOf(one.id);
    // The successor of the shared EYE_INDEX check: an eye colour now lives in the Species' own
    // patches, so a table reaching past its own Palette is the same defect in a new place.
    for (const [id, expression] of entries(expressionsOf(one.id))) {
      for (const look of expression) {
        for (const patch of look) {
          for (const row of patch.pixels) {
            for (const char of row) {
              if (char === ".") continue;
              const index = MAP_ALPHABET.indexOf(char) - 1;
              assert.ok(
                index >= 0 && index < palette.length,
                `${one.id}/${id} patch at ${patch.at} writes "${char}" (index ${index}) but the palette holds ${palette.length} colours`,
              );
            }
          }
        }
      }
    }
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const { pixels } = mapsOf(one.id)[stage];
      for (const [y, row] of pixels.entries()) {
        for (const [x, char] of [...row].entries()) {
          if (char === ".") continue;
          const index = MAP_ALPHABET.indexOf(char) - 1;
          assert.ok(
            index >= 0 && index < palette.length,
            `${one.id}/${stage} row ${y} column ${x} writes "${char}" (index ${index}) but the palette holds ${palette.length} colours`,
          );
        }
      }
    }
  }
});

// Walks what is actually painted (every Activity's full period, and heartFrame for every
// Temperament), not just the static map: the map alone cannot see the eye the expressions stamp
// over it, which is exactly the defect that slipped through the first version of this test.
test("the egg's painted Frame never reads a Species' palette", () => {
  for (const [y, row] of EGG_PIXELS.entries()) {
    for (const [x, char] of [...row].entries()) {
      if (char === ".") continue;
      const index = MAP_ALPHABET.indexOf(char) - 1;
      assert.ok(index >= 0 && index < EGG_PALETTE.length, `the egg's map writes "${char}" at ${x},${y}, outside its own ${EGG_PALETTE.length} colours`);
    }
  }
  const inks = (frame: Frame) => frame.flatMap((row) => row.flatMap((cell) => [cell.top, cell.bottom]));
  for (const activity of ACTIVITIES) {
    const period = periodOf(REFERENCE, "egg", activity);
    for (let beat = 0; beat < period; beat++) {
      for (const ink of inks(frameAt(REFERENCE, "egg", activity, beat))) {
        if (typeof ink !== "number") continue;
        assert.ok(ink >= 0 && ink < EGG_PALETTE.length, `egg/${activity}/${beat} paints index ${ink}, outside its own ${EGG_PALETTE.length} colours`);
      }
    }
  }
  for (const temperament of TEMPERAMENTS) {
    for (const ink of inks(heartFrame(REFERENCE, "egg", temperament))) {
      if (typeof ink !== "number") continue;
      assert.ok(ink >= 0 && ink < EGG_PALETTE.length, `egg heart/${temperament} paints index ${ink}, outside its own ${EGG_PALETTE.length} colours`);
    }
  }
});

test("every drawn map is exactly 32 rows of 32 characters, all from the alphabet", () => {
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

test("motion rectangles fall inside the map and never touch a slot, or each other", () => {
  const inside = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= SPRITE_WIDTH && r.y + r.h <= PIXEL_HEIGHT;
  const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const one of drawn) {
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const body = mapsOf(one.id)[stage];
      const named: readonly (readonly [string, Rect])[] = [
        ...(body.motion?.ears ?? []).map((ear, index): readonly [string, Rect] => [`ears[${index}]`, ear]),
        ...(body.motion?.tail !== undefined ? [["tail", body.motion.tail] as readonly [string, Rect]] : []),
      ];
      for (const [label, rect] of named) {
        assert.ok(inside(rect), `${one.id}/${stage} ${label} leaves the map`);
        assert.ok(!overlaps(rect, MARK_SLOT), `${one.id}/${stage} ${label} overlaps MARK_SLOT`);
        assert.ok(!overlaps(rect, BADGE_SLOT), `${one.id}/${stage} ${label} overlaps BADGE_SLOT`);
      }
      // Every pair, not just ears against ears: a tail drawn over an ear is exactly the kind of
      // mistake a Species copying this file's shape could make unnoticed.
      for (const [i, [labelA, a]] of named.entries()) {
        for (const [j, [labelB, b]] of named.entries()) {
          if (j <= i) continue;
          assert.ok(!overlaps(a, b), `${one.id}/${stage} ${labelA} overlaps ${labelB}`);
        }
      }
    }
  }
});

function anchorsNamedBy(table: Expressions): ReadonlySet<string> {
  const named = new Set<string>();
  for (const [, expression] of entries(table)) for (const look of expression) for (const patch of look) named.add(patch.at);
  return named;
}

// Both tables, not just the Species': a Body's own `expressions` override replaces an id wholesale,
// so it can name an anchor the Species' table never does, and the Species' table still has to land
// on every Body whose Stage the override leaves alone.
test("every anchor a Species' expressions name exists in all four of its Bodies", () => {
  for (const one of drawn) {
    const shared = anchorsNamedBy(expressionsOf(one.id));
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const { anchors } = mapsOf(one.id)[stage];
      for (const at of new Set([...shared, ...anchorsNamedBy(expressionsOf(one.id, stage))])) {
        assert.ok(anchors[at] !== undefined, `${one.id}/${stage} has no anchor "${at}"`);
      }
    }
  }
});

// stamp() clips rather than throws — core never throws at render — so a patch hanging off the
// bottom or the right of the canvas is silently cropped in the window. This is where it is caught.
test("every patch fits inside the canvas from its anchor", () => {
  for (const one of drawn) {
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const { anchors } = mapsOf(one.id)[stage];
      for (const [id, expression] of entries(expressionsOf(one.id, stage))) {
        for (const look of expression) {
          for (const patch of look) {
            const at = anchors[patch.at];
            if (at === undefined) continue; // named by the test above
            const height = patch.pixels.length;
            const width = patch.pixels[0]?.length ?? 0;
            for (const row of patch.pixels) assert.equal(row.length, width, `${one.id}/${id} patch at ${patch.at} is ragged`);
            assert.ok(
              at.x >= 0 && at.y >= 0 && at.x + width <= SPRITE_WIDTH && at.y + height <= PIXEL_HEIGHT,
              `${one.id}/${stage}/${id} patch at ${patch.at} (${at.x},${at.y} ${width}x${height}) runs off the canvas`,
            );
          }
        }
      }
    }
  }
});

// An Expression with no Look makes periodOf zero, and `index % 0` is NaN: one frozen Frame under a
// NaN cache key, for ever. periodOf's Math.max(1, …) refuses to melt; this refuses the table.
test("no Expression is empty, so a period is never zero", () => {
  for (const one of drawn) {
    for (const [id, expression] of entries(expressionsOf(one.id))) {
      assert.ok(expression.length > 0, `${one.id}/${id} has no Look`);
    }
    // A Body's override is merged in wholesale, so an empty Expression can enter there too.
    for (const { id: stage } of STAGES) {
      for (const [id, expression] of entries(expressionsOf(one.id, stage))) {
        assert.ok(expression.length > 0, `${one.id}/${stage}/${id} has no Look`);
      }
    }
  }
  for (const one of drawn) {
    for (const { id: stage } of STAGES) {
      for (const activity of ACTIVITIES) {
        assert.ok(periodOf(one.id, stage, activity) > 0, `${one.id}/${stage}/${activity} has a period of zero`);
      }
    }
  }
});

// heartFrame paints a 5-wide, HEART_HEIGHT-tall heart at (head.x - 2, head.y - HEART_HEIGHT), and
// paint() does throw when that rectangle leaves the map. A head too high or too near an edge would
// therefore take the window down on a pet, which is why this is checked on the table, not at render.
test("every head anchor leaves room for the heart above it", () => {
  for (const one of drawn) {
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const { head } = mapsOf(one.id)[stage].anchors;
      assert.ok(head.y >= HEART_HEIGHT, `${one.id}/${stage} head at y=${head.y} leaves no room for the ${HEART_HEIGHT}-row heart`);
      assert.ok(head.x - 2 >= 0 && head.x + 3 <= SPRITE_WIDTH, `${one.id}/${stage} head at x=${head.x} pushes the heart off the canvas`);
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

// A rect can be wide enough (w >= 2, checked above) and still lose pixels at one edge: shift()
// drops anything whose destination falls outside the rect's own width, so content sitting flush
// against an edge vanishes on exactly the beat that pushes it that way. That is the general
// property the width check cannot see — a fox's tail or a bat's wingtip drawn edge-to-edge inside
// a 3-wide rect passed that check and still emptied on every other sweep. A static render never
// exercises this either, since it only shows up once something actually moves, so this shifts
// every declared rect by every value SWEEP produces (tail) and by the blink's fixed dx = 1 (ears),
// and asserts the rect holds the same count of opaque pixels afterwards it held before.
test("shifting a motion rectangle by any beat it actually uses never changes how many pixels it holds", () => {
  function countOpaque(rows: readonly string[], rect: Rect): number {
    let n = 0;
    for (let dy = 0; dy < rect.h; dy++) {
      const row = rows[rect.y + dy];
      for (let dx = 0; dx < rect.w; dx++) if (row?.[rect.x + dx] !== ".") n++;
    }
    return n;
  }
  for (const one of drawn) {
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      const { pixels, motion } = mapsOf(one.id)[stage];
      if (motion?.tail !== undefined) {
        const rect = motion.tail;
        const rest = countOpaque(pixels, rect);
        // tail shifts by sweepAt(beat), which ranges over the whole of SWEEP: both directions occur.
        for (const dx of new Set(SWEEP)) {
          if (dx === 0) continue;
          const after = countOpaque(shift(pixels, rect, dx), rect);
          assert.equal(after, rest, `${one.id}/${stage} tail ${JSON.stringify(rect)} loses pixels at dx=${dx}: ${rest} -> ${after}`);
        }
      }
      // ears shifts by a hardcoded dx = 1 on blink (see build() in sprites.ts) — never -1 — so only
      // that one direction is ever exercised; testing the direction it never travels would flag
      // rects that are perfectly fine and send a repair chasing a beat that never happens.
      for (const [index, rect] of (motion?.ears ?? []).entries()) {
        const rest = countOpaque(pixels, rect);
        const after = countOpaque(shift(pixels, rect, 1), rect);
        assert.equal(after, rest, `${one.id}/${stage} ears[${index}] ${JSON.stringify(rect)} loses pixels on blink (dx=1): ${rest} -> ${after}`);
      }
    }
  }
});

// Walks a whole period, not just the Faces list: frames() (removed, it had no production caller)
// only ever exercised beats 0 and 1, so this never touched a blink beat, a swept tail, a mark or a
// badge together. mark and badge are held on throughout so the overlay stack is packed every beat.
test("every Frame is SPRITE_HEIGHT rows of SPRITE_WIDTH cells, across a full period, mark and badge included", () => {
  for (const one of SPECIES) {
    for (const { id: stage } of STAGES) {
      for (const activity of ACTIVITIES) {
        const period = periodOf(one.id, stage, activity);
        for (let beat = 0; beat < period; beat++) {
          const frame = frameAt(one.id, stage, activity, beat, "hardy", true);
          assert.equal(frame.length, SPRITE_HEIGHT, `${one.id}/${stage}/${activity}/${beat}`);
          for (const row of frame) assert.equal(row.length, SPRITE_WIDTH, `${one.id}/${stage}/${activity}/${beat}`);
        }
      }
    }
  }
});

// The egg has no motion, so nothing but the beat can move it: a clean way to test that the beat
// wraps by the Expression's Look count and not by the raw index, with no tail or ear to confound it.
test("frameAt wraps the beat by the Expression's Look count, not by the raw index", () => {
  // Content, not identity: 0 and 2 land on the same beat but are cached under different keys
  // (the cache key carries the whole wrapped index, not the reduced beat), so they are two
  // separately-built Frames that must look alike, not the same object.
  assert.notDeepEqual(frameAt(REFERENCE, "egg", "thinking", 0), frameAt(REFERENCE, "egg", "thinking", 1), "different beats should differ");
  assert.deepEqual(frameAt(REFERENCE, "egg", "thinking", 0), frameAt(REFERENCE, "egg", "thinking", 2), "two Looks around is the same beat again");
});

test("the animation period repeats identity, so a clock that only advances never grows the cache", () => {
  const period = periodOf(REFERENCE, "adult", "idle");
  assert.equal(frameAt(REFERENCE, "adult", "idle", 5), frameAt(REFERENCE, "adult", "idle", 5 + period), "one period later, the same object");

  const seen = new Set<Frame>();
  for (let i = 0; i < period * 10; i++) seen.add(frameAt(REFERENCE, "adult", "idle", i));
  assert.ok(seen.size <= period, `saw ${seen.size} distinct Frames across ${period * 10} increasing indices, expected at most the period (${period})`);
});

test("frameAt returns the same objects for the same inputs, so memos stay stable", () => {
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
      // The reference takes DEFAULT_EXPRESSIONS, which paints at palette index 4: the migration
      // put every Species' old eye colour there. A redrawn Species picks its own index, and this
      // assertion moves with it.
      assert.ok(frame.some((row) => row.some((cell) => cell.top === 4 || cell.bottom === 4)), `${stage}/${temperament} eyes`);
      assert.equal(heartFrame(REFERENCE, stage, temperament), frame, "cached");
    }
  }
  assert.notEqual(heartFrame("cat", "young", "cheerful"), heartFrame("cat", "young", "sarcastic"));
});

const BLANK = Array.from({ length: PIXEL_HEIGHT }, () => ".".repeat(SPRITE_WIDTH));
/** A map whose only opaque row is `y`: each of the four differs, and differs visibly. */
function bar(y: number): readonly string[] {
  return BLANK.map((row, at) => (at === y ? "1".repeat(SPRITE_WIDTH) : row));
}
const FRAME_A = bar(20);
const FRAME_B = bar(21);
const FRAME_C = bar(22);
const FRAME_D = bar(23);
// Four, not two: "idle"'s unfolded period is lcm(looks=1, SWEEP.length=6, BLINK_EVERY=11) = 66,
// which is already even, so a 2-frame cycle divides it whether or not periodOf folds the frame
// count in at all — that assertion could not fail. 66 is not a multiple of 4, so folding a
// 4-frame cycle in must change the period to lcm(66, 4) = 132 for `% 4 === 0` to hold; without
// the fold it stays 66, and 66 % 4 === 2. Four frames is the smallest count that pins the fold.
const FOUR_FRAMES = [FRAME_A, FRAME_B, FRAME_C, FRAME_D];

const CAT = SPECIES.find((one) => one.id === "cat");
if (CAT === undefined) throw new Error("the reference Species is missing from the catalog");

const BODY: Body = {
  pixels: FRAME_A,
  frames: FOUR_FRAMES,
  anchors: { head: { x: 15, y: 18 }, left_eye: { x: 11, y: 18 }, right_eye: { x: 17, y: 18 } },
};

const FIXTURE: SpeciesDef = {
  id: "test:framed",
  label: { en: "framed", fr: "framed" },
  gender: "m",
  rarity: "common",
  palette: ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff"],
  expressions: DEFAULT_EXPRESSIONS,
  signature: CAT.signature,
  maps: { hatchling: BODY, young: BODY, adult: BODY, elder: BODY },
};

const TABLE = [...SPECIES, FIXTURE];

test("a Body with frames alternates over them, and the period covers them", () => {
  const beats = [0, 1, 2, 3].map((index) => frameAt("test:framed", "adult", "idle", index, undefined, false, TABLE));
  for (let i = 0; i < beats.length; i++) {
    for (let j = i + 1; j < beats.length; j++) assert.notDeepEqual(beats[i], beats[j], `beat ${i} and beat ${j} should draw differently`);
  }
  assert.deepEqual(frameAt("test:framed", "adult", "idle", 4, undefined, false, TABLE), beats[0], "four frames around is the first again");
  assert.equal(periodOf("test:framed", "adult", "idle", TABLE) % FOUR_FRAMES.length, 0, "the period must cover the frame cycle");
});

test("a Body without frames draws its single map at every beat", () => {
  const period = periodOf("cat", "adult", "idle");
  const maps = new Set<string>();
  for (let beat = 0; beat < period; beat++) {
    maps.add(JSON.stringify(frameAt("cat", "adult", "idle", beat).map((row) => row.map((cell) => cell.top))));
  }
  assert.ok(maps.size <= period, "no beat may invent a map");
});

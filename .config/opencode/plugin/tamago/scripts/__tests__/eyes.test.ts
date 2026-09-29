import { test } from "node:test";
import assert from "node:assert/strict";
import { covers, eyeCells, lookPatches, measureEye, onBorder, parseArgs, skinAround } from "../eyes.ts";
import { Refusal } from "../png.ts";

const INK = new Set(["0", "c"]);

/**
 * A face 12 wide: skin 7, outline 3, two eyes of ink 0 at x 2..4 and x 7..9, each with a
 * highlight c in its top-left corner. Each eye's bottom pixel sits on row 5, one row lower than a
 * 3-row frame from row 2 reaches, so the frame check has something to catch.
 */
const FACE = [
  "............",
  ".3333333333.",
  ".3c0077c003.",
  ".3000770003.",
  ".3000770003.",
  ".3707777073.",
  ".3333333333.",
  "............",
];

test("a pixel next to transparency is on the border; one inside the silhouette is not", () => {
  assert.equal(onBorder(FACE, 1, 3), true);
  assert.equal(onBorder(FACE, 3, 3), false);
  assert.equal(onBorder(FACE, 0, 0), false, "a transparent pixel is not part of the outline");
});

test("the eye's cells are its ink inside the box, never a border pixel", () => {
  const cells = eyeCells(["00", "0."], { x: 0, y: 0, w: 2, h: 2 }, INK);
  assert.equal(cells.size, 0, "every pixel of this corner touches transparency");
  assert.equal(eyeCells(FACE, { x: 2, y: 2, w: 3, h: 3 }, INK).size, 9);
});

test("measureEye follows the ink past the frame, and covers says the frame is too short", () => {
  const frame = { x: 2, y: 2, w: 3, h: 3 };
  const eye = measureEye(FACE, frame, INK);
  assert.deepEqual(eye, { x: 2, y: 2, w: 3, h: 4 }, "the eye's last row is row 5");
  assert.equal(eye !== undefined && covers(frame, eye), false);
  assert.equal(eye !== undefined && covers({ ...frame, h: 4 }, eye), true);
});

test("measureEye has nothing to measure in a frame with no ink", () => {
  assert.equal(measureEye(FACE, { x: 5, y: 2, w: 2, h: 2 }, INK), undefined);
});

test("skinAround takes the commonest non-ink colour nearest the pixel", () => {
  const eye = eyeCells(FACE, { x: 2, y: 2, w: 3, h: 4 }, INK);
  assert.equal(skinAround(FACE, 4, 3, eye, INK), "7", "the skin between the eyes, not the outline");
});

test("shut draws its line one row below the middle of an even frame and erases only the eye to skin", () => {
  const [patch] = lookPatches(FACE, { x: 2, y: 2, w: 3, h: 4 }, "left", "shut", { ink: INK, skin: "7" });
  assert.deepEqual(patch, ["777", "777", "000", ".7."], "the skin beside the eye's bottom pixel is left alone");
});

test("no look ever paints a pixel of the border", () => {
  const box = { x: 1, y: 1, w: 5, h: 5 };
  for (const kind of ["shut", "cross", "caret", "arc", "lid", "glance"] as const) {
    const [patch] = lookPatches(FACE, box, "left", kind, { ink: INK, skin: "7" });
    assert.ok(patch !== undefined);
    patch.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (onBorder(FACE, box.x + c, box.y + r)) assert.equal(ch, ".", `${kind} painted the border at ${box.x + c},${box.y + r}`);
      }),
    );
  }
});

test("a glyph that cannot be centred leans toward the face on both eyes", () => {
  const [left] = lookPatches(FACE, { x: 2, y: 2, w: 4, h: 3 }, "left", "cross", { ink: INK, skin: "7" });
  const [right] = lookPatches(FACE, { x: 6, y: 2, w: 4, h: 3 }, "right", "cross", { ink: INK, skin: "7" });
  assert.equal(left?.[0]?.[1], "0", "the left cross starts one column in, toward the face");
  assert.equal(right?.[0]?.[0], "0", "the right cross starts at its frame's first column, toward the face");
});

test("--skin decides the colour of every erased eye pixel", () => {
  const [patch] = lookPatches(FACE, { x: 2, y: 2, w: 3, h: 3 }, "left", "lid", { ink: INK, skin: "5" });
  assert.deepEqual(patch, ["555", "000", "..."]);
});

test("glance is one column wider and moves each eye pixel one step right", () => {
  const [patch] = lookPatches(FACE, { x: 7, y: 2, w: 3, h: 3 }, "right", "glance", { ink: INK, skin: "7" });
  assert.equal(patch?.[0]?.length, 4);
  assert.equal(patch?.[0]?.[1], "c", "the highlight at x 7 moved to x 8");
  assert.equal(patch?.[0]?.[0], "7", "the pixel it left is skin");
});

test("shine alternates a 2 x 2 highlight between two corners and darkens the drawn highlight", () => {
  const looks = lookPatches(FACE, { x: 2, y: 2, w: 3, h: 4 }, "left", "shine", { ink: INK, light: "c" });
  assert.equal(looks.length, 2);
  const [a, b] = looks;
  assert.deepEqual(a, ["0..", ".cc", ".cc", "..."], "lower-right first, the drawn highlight darkened");
  assert.deepEqual(b, ["cc.", "cc.", "...", "..."], "then upper-left");
});

test("shine refuses to guess its highlight colour", () => {
  assert.throws(() => lookPatches(FACE, { x: 2, y: 2, w: 3, h: 3 }, "left", "shine", { ink: INK }), Refusal);
});

test("parseArgs refuses a look without --ink or --size, and reads a check", () => {
  assert.throws(() => parseArgs(["cat", "--check"]), Refusal);
  assert.throws(() => parseArgs(["cat", "adult", "cross", "--ink", "1"]), Refusal);
  assert.throws(() => parseArgs(["cat", "adult", "wink", "--ink", "1", "--size", "5x5"]), Refusal);
  const check = parseArgs(["cat", "--check", "--ink", "1,a"]);
  assert.equal(check.mode, "check");
  const look = parseArgs(["cat", "adult", "cross", "--ink", "1,a", "--size", "5x4", "--skin", "0"]);
  assert.equal(look.mode, "look");
  if (look.mode === "look") {
    assert.deepEqual(look.size, { w: 5, h: 4 });
    assert.equal(look.options.skin, "0");
  }
});

test("the single eye of a three-quarter Species leans nowhere: an off-centre glyph starts at its frame's left", () => {
  const [only] = lookPatches(FACE, { x: 2, y: 2, w: 4, h: 3 }, "only", "cross", { ink: INK, skin: "7" });
  assert.equal(only?.[0]?.[0], "0");
});

test("shine's spot option draws a single-pixel highlight even where a 2 x 2 fits", () => {
  const [a] = lookPatches(FACE, { x: 2, y: 2, w: 3, h: 4 }, "left", "shine", { ink: INK, light: "c", spot: 1 });
  assert.equal((a ?? []).join("").split("c").length - 1, 1);
});

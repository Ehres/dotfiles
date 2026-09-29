import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TEXT, TAIL_COLUMN, bubbleBorders, bubbleFrame, tailOffset } from "../bubble.ts";

/** Where every migrated Body puts its head. Passed explicitly: the column is the caller's now. */
const HEAD = 15;

test("a bubble is three lines, the middle one holding the text between parentheses", () => {
  const frame = bubbleFrame("May I?");
  assert.deepEqual(frame, [" .------. ", "( May I? )", " '---o--' "]);
});

test("every line of a bubble is text.length + 4 wide", () => {
  for (const text of ["Hi", "I feel... different.", "x".repeat(MAX_TEXT)]) {
    for (const line of bubbleFrame(text)) assert.equal(line.length, text.length + 4, JSON.stringify(text));
  }
});

test("the tail sits in TAIL_COLUMN of the bottom border, under the sprite's head", () => {
  const { top, bottom } = bubbleBorders("Was I out long?");
  assert.equal(bottom[TAIL_COLUMN], "o");
  assert.equal(top.startsWith(" ."), true);
  assert.equal(bottom.startsWith(" '"), true);
  assert.equal(bottom.replaceAll("o", "-"), top.replaceAll(".", "'"));
});

test("the tail lands on the head for every text length up to MAX_TEXT", () => {
  // Review Focus: a Bubble at MAX_TEXT above a centred Sprite.
  const head = HEAD;
  for (let length = 1; length <= MAX_TEXT; length++) {
    const text = "x".repeat(length);
    const offset = tailOffset(text, head);
    const { bottom } = bubbleBorders(text);
    const tail = bottom.indexOf("o");
    assert.ok(tail >= 0, `no tail for length ${length}`);
    assert.equal(offset + tail, head, `length ${length}: tail lands at ${offset + tail}, head is at ${head}`);
    assert.ok(offset >= 0, `length ${length} pushes the Bubble off the left edge`);
  }
});

// A head at column 4 sits left of TAIL_COLUMN, so the exact offset would be negative and the view,
// which adds it to a padding, would draw the Bubble outside the Sprite's own band. Every length is
// walked, not just the long ones: short text pulls the tail left to column 2, where the head is
// still reachable, and those must keep landing exactly rather than being clamped needlessly.
test("a bubble for a head at column 4 never starts left of zero", () => {
  for (let length = 0; length <= MAX_TEXT; length++) {
    const text = "x".repeat(length);
    const offset = tailOffset(text, 4);
    const tail = bubbleBorders(text).bottom.indexOf("o");
    assert.ok(offset >= 0, `length ${length} starts at ${offset}, left of the Sprite's own edge`);
    if (tail <= 4) assert.equal(offset + tail, 4, `length ${length}: the tail could reach the head and did not`);
    else assert.equal(offset, 0, `length ${length}: the tail cannot reach, so the Bubble sits flush at the edge`);
  }
});

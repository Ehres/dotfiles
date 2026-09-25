import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TEXT, TAIL_COLUMN, bubbleBorders, bubbleFrame, tailOffset } from "../bubble.ts";
import { SPRITE_WIDTH } from "../../appearance/pixels.ts";

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
  const head = Math.floor(SPRITE_WIDTH / 2);
  for (let length = 1; length <= MAX_TEXT; length++) {
    const text = "x".repeat(length);
    const offset = tailOffset(text);
    const { bottom } = bubbleBorders(text);
    const tail = bottom.indexOf("o");
    assert.ok(tail >= 0, `no tail for length ${length}`);
    assert.equal(offset + tail, head, `length ${length}: tail lands at ${offset + tail}, head is at ${head}`);
    assert.ok(offset >= 0, `length ${length} pushes the Bubble off the left edge`);
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TEXT, TAIL_COLUMN, bubbleBorders, bubbleFrame } from "../bubble.ts";

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

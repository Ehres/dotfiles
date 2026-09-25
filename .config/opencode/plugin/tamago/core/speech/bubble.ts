import { SPRITE_WIDTH } from "../appearance/pixels.ts";

/** Longest phrase a Bubble may hold, so it never wraps in a narrow sidebar. */
export const MAX_TEXT = 24;
/**
 * Column of the tail in the bottom border. Fixed at 5 once `text` is 3 characters or longer
 * (shorter text pulls it left, down to 2 for an empty string); tailOffset uses it to line the tail
 * up under the Sprite's own head.
 */
export const TAIL_COLUMN = 5;

/**
 * Top and bottom borders of a bubble around `text`. Both are one column
 * narrower than the middle line on each side, the usual rounded look:
 *
 *  .------.
 * ( May I? )
 *  '---o--'
 */
export function bubbleBorders(text: string): { top: string; bottom: string } {
  const width = text.length + 4;
  const dashes = "-".repeat(text.length);
  const top = ` .${dashes}.`.padEnd(width);
  const tail = dashes.slice(0, TAIL_COLUMN - 2) + "o" + dashes.slice(TAIL_COLUMN - 1);
  const bottom = ` '${tail}'`.padEnd(width);
  return { top, bottom };
}

/** The whole bubble as lines of text: every line is text.length + 4 wide. */
export function bubbleFrame(text: string): readonly string[] {
  const { top, bottom } = bubbleBorders(text);
  return [top, `( ${text} )`, bottom];
}

/**
 * How far from the Sprite's own left edge a Bubble starts, so its tail lands on the head. Never
 * negative in practice: the tail sits at column 5 at most (TAIL_COLUMN) and the head is at column
 * 10 (`Math.floor(SPRITE_WIDTH / 2)`), so no text length ever pushes the Bubble past the left edge.
 */
export function tailOffset(text: string): number {
  const { bottom } = bubbleBorders(text);
  return Math.floor(SPRITE_WIDTH / 2) - bottom.indexOf("o");
}

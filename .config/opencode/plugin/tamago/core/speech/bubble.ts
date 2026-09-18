import type { Frame } from "../appearance/sprites.ts";

/** Longest phrase a Bubble may hold, so it never wraps in a narrow sidebar. */
export const MAX_TEXT = 24;
/** Column of the tail in the bottom border; the sprite's head starts at column 2. */
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

/** The whole bubble as a Frame: every line is text.length + 4 wide. */
export function bubbleFrame(text: string): Frame {
  const { top, bottom } = bubbleBorders(text);
  return [top, `( ${text} )`, bottom];
}

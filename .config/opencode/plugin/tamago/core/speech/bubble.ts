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
 * How far from the Sprite's own left edge a Bubble starts, so its tail lands on `headColumn` — the
 * x of the Body's own `head` anchor, which is why a Species declares one.
 *
 * Clamped at zero, and that clamp is the whole reason this takes a column instead of reading a
 * constant. The tail sits at TAIL_COLUMN once the text is 3 characters or longer, so a Body whose
 * head is drawn further left than that asks for a negative offset — and the view adds this to a
 * padding, which would slide the Bubble out of the Sprite's own column band. A head that far left
 * gets a Bubble flush against the edge, aimed as near the head as the tail can reach, rather than
 * one drawn off it.
 */
export function tailOffset(text: string, headColumn: number): number {
  const { bottom } = bubbleBorders(text);
  return Math.max(0, headColumn - bottom.indexOf("o"));
}

import type { Expressions, Look } from "./expressions.ts";

/** Pins the same pattern to both eyes: every look below is symmetric. */
function eyes(pattern: readonly string[]): Look {
  return [
    { at: "left_eye", pixels: pattern },
    { at: "right_eye", pixels: pattern },
  ];
}

const OPEN = [".4.", "444", ".4."];
const SHUT = ["...", "444", "..."];

/**
 * The eleven looks the engine used to share across every Species, as patches
 * pinned to `left_eye` and `right_eye` and drawn in palette index 4, which is
 * where the migration put each Species' old eye colour.
 *
 * This exists only for Species not yet redrawn at 32 x 32, and for the shared
 * egg, whose own EGG_PALETTE was widened to reach index 4 for the same reason.
 * A redrawn Species writes its own table and must not reach for this one: its
 * indices mean nothing outside a migrated palette.
 *
 * Deleting it is an engine edit, not a catalog one: `sprites.ts` imports it for
 * the egg, so the last redraw is not finished when the last Species file stops
 * naming it — the egg needs a table of its own first, and `expressionsOf`'s
 * egg branch has to stop reaching for this one. Delete it after that, never
 * before.
 */
export const DEFAULT_EXPRESSIONS: Expressions = {
  open: [eyes(OPEN)],
  shut: [eyes(SHUT)],
  thinking: [eyes(OPEN), eyes(["...", "444", ".4."])],
  working: [eyes(OPEN)],
  waiting: [eyes(["444", "4.4", "444"])],
  hurt: [eyes(["4.4", ".4.", "4.4"])],
  sleeping: [eyes(SHUT)],
  "pet:cheerful": [eyes(["4.4", ".4.", "..."])],
  "pet:sarcastic": [eyes(["...", "444", ".4."])],
  "pet:stoic": [eyes(OPEN)],
  "pet:dreamy": [eyes(["...", "4.4", "444"])],
};

import { REFERENCE, SPECIES, known, mapsOf, tableOf } from "../creature/catalog.ts";
import type { Anchors, Body } from "./bodies.ts";
import { DEFAULT_EXPRESSIONS } from "./default-expressions.ts";
import { expressionOf, idOf, petIdOf, type Expressions, type Look, type Point } from "./expressions.ts";
import { BADGE, BADGE_SLOT, MARK, MARK_SLOT } from "./marks.ts";
import { BLINK_EVERY, SWEEP, blinksAt, shift, sweepAt } from "./motion.ts";
import { PIXEL_HEIGHT, SPRITE_WIDTH, pack, paint, type Frame, type Pattern } from "./pixels.ts";
import type { Temperament } from "../creature/sheet.ts";
import type { SpeciesDef, SpeciesId } from "../creature/species.ts";
import type { StageId } from "../career/stage.ts";
import type { TraitId } from "../career/pick.ts";
import type { Activity } from "../moment/session.ts";

export { PIXEL_HEIGHT, SPRITE_HEIGHT, SPRITE_WIDTH, type Cell, type Frame, type Ink } from "./pixels.ts";

/** The egg's own map: indices into EGG_PALETTE, never a Species' Palette. Exported for its own catalog test. */
export const EGG_PIXELS: readonly string[] = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  ".............000................",
  "............0011100.............",
  "...........011111110............",
  "..........01111111110...........",
  "..........01111111110...........",
  ".........0111111111110..........",
  ".........0111111111110..........",
  ".........0111222111110..........",
  ".........0111222111110..........",
  ".........0111111122210..........",
  ".........0111111122210..........",
  ".........0111111111110..........",
  ".........0111222111110..........",
  ".........0111222111110..........",
  ".........0111111111110..........",
  ".........0111111111110..........",
  "..........01111111110...........",
  "..........01111111110...........",
  "...........011111110............",
  "............0000000.............",
];

/** The egg every Species hatches from: what is inside only shows at hatchling. */
const EGG: Body = {
  pixels: EGG_PIXELS,
  anchors: { head: { x: 15, y: 18 }, left_eye: { x: 11, y: 18 }, right_eye: { x: 17, y: 18 } },
};

/** How long the heart stays on the sprite after a pet. */
export const PET_MS = 2_000;

/** Rows the heart occupies above the head anchor. */
export const HEART_HEIGHT = 5;
/** The heart drawn over the head while petted. Pixels now, not a character. */
const HEART: Pattern = [".#.#.", "#####", "#####", ".###.", "..#.."];

/** The body to draw: the common egg, else the Species' map, else the reference's. */
function body(species: SpeciesId, stage: StageId, table: readonly SpeciesDef[] = SPECIES): Body {
  if (stage === "egg") return EGG;
  return mapsOf(species, table)[stage];
}

/** The cache key: every egg shares one entry, an unknown Species shares the reference's. */
function keyOf(species: SpeciesId, stage: StageId, table: readonly SpeciesDef[] = SPECIES): string {
  if (stage === "egg") return "egg";
  return `${known(species, table) ? species : REFERENCE}/${stage}`;
}

/**
 * The Expressions of a Species: its own, merged with the Body's override for
 * that Stage. The egg takes the migrated table whatever hatches from it: its
 * map and its eyes are drawn in EGG_PALETTE, where a redrawn Species' own
 * indices would mean nothing, and every egg has to stay the one same Frame
 * because they all share one cache key.
 */
export function expressionsOf(species: SpeciesId, stage?: StageId, table: readonly SpeciesDef[] = SPECIES): Expressions {
  if (stage === "egg") return DEFAULT_EXPRESSIONS;
  const own = tableOf(species, table);
  if (stage === undefined) return own;
  return { ...own, ...(mapsOf(species, table)[stage].expressions ?? {}) };
}

/** Where the head is: the Body's anchor, the egg's own for an egg. */
export function headOf(species: SpeciesId, stage: StageId, table: readonly SpeciesDef[] = SPECIES): Point {
  return stage === "egg" ? EGG.anchors.head : mapsOf(species, table)[stage].anchors.head;
}

/** Stamps a Look onto the rows: each patch at its anchor, `.` leaving what is under it alone. */
function stamp(rows: readonly string[], anchors: Anchors, look: Look): string[] {
  const next = rows.slice();
  for (const patch of look) {
    const at = anchors[patch.at];
    if (at === undefined) continue; // core never throws at render; the catalog test is where this is caught
    for (const [dy, line] of patch.pixels.entries()) {
      const row = next[at.y + dy];
      if (row === undefined) continue;
      const chars = row.split("");
      for (const [dx, char] of [...line].entries()) {
        if (char === ".") continue;
        if (at.x + dx < SPRITE_WIDTH) chars[at.x + dx] = char;
      }
      next[at.y + dy] = chars.join("");
    }
  }
  return next;
}

/** Builds one Frame: the map, moved, then the Look, then the overlays, then packed. */
function build(one: Body, look: Look, beat: number, mark: TraitId | undefined, badge: boolean): Frame {
  let rows: readonly string[] = one.frames?.[beat % one.frames.length] ?? one.pixels;
  const motion = one.motion;
  if (motion?.tail !== undefined) rows = shift(rows, motion.tail, sweepAt(beat));
  if (motion?.ears !== undefined && blinksAt(beat)) for (const ear of motion.ears) rows = shift(rows, ear, 1);
  rows = stamp(rows, one.anchors, look);
  const pattern = mark === undefined ? undefined : MARK[mark]?.pattern;
  if (pattern !== undefined) rows = paint(rows, MARK_SLOT, pattern, "mark");
  if (badge) rows = paint(rows, BADGE_SLOT, BADGE, "badge");
  return pack(rows);
}

const CACHE = new Map<string, Frame>();

function cached(key: string, make: () => Frame): Frame {
  const hit = CACHE.get(key);
  if (hit !== undefined) return hit;
  const built = make();
  CACHE.set(key, built);
  return built;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

/**
 * How many beats before the whole animation repeats: the Look cycle, the tail sweep, the blink
 * cadence and the Body's own `frames` cycle all wrap within it, and nothing past it can change a
 * Frame. Computed, never hardcoded, so an Expression with a different Look count still gets the
 * right period. Exported so a test can walk a whole period without duplicating the arithmetic.
 *
 * Math.max(1, …) is load-bearing, not defensive noise: an Expression with no Look would make this
 * zero, and `index % 0` is NaN — one frozen Frame under a NaN cache key, for ever. The catalog test
 * refuses an empty Expression; this refuses to melt if one ever slips past it.
 */
export function periodOf(species: SpeciesId, stage: StageId, activity: Activity, table: readonly SpeciesDef[] = SPECIES): number {
  const looks = Math.max(1, expressionOf(expressionsOf(species, stage, table), idOf(activity)).length);
  const frames = Math.max(1, body(species, stage, table).frames?.length ?? 1);
  return lcm(lcm(lcm(looks, SWEEP.length), BLINK_EVERY), frames);
}

export function frameAt(
  species: SpeciesId,
  stage: StageId,
  activity: Activity,
  index: number,
  mark?: TraitId,
  badge = false,
  table: readonly SpeciesDef[] = SPECIES,
): Frame {
  const period = periodOf(species, stage, activity, table);
  // Wrapped once, up front: sweepAt and blinksAt already wrap internally on shorter periods that
  // divide this one, so this changes nothing about the Frame while keeping the cache — and the
  // clock-driven index passed in from the view — bounded instead of growing forever.
  const wrapped = ((index % period) + period) % period;
  const blinking = activity !== "sleeping" && blinksAt(wrapped);
  const expression = expressionOf(expressionsOf(species, stage, table), blinking ? "shut" : idOf(activity));
  const beat = wrapped % Math.max(1, expression.length);
  const key = `${keyOf(species, stage, table)}/${activity}/${wrapped}/${mark ?? ""}/${badge}`;
  return cached(key, () => build(body(species, stage, table), expression[beat] ?? [], wrapped, mark, badge));
}

/** The Sprite while petted: the Temperament's expression and a heart above the head. */
export function heartFrame(
  species: SpeciesId,
  stage: StageId,
  temperament: Temperament,
  mark?: TraitId,
  badge = false,
  table: readonly SpeciesDef[] = SPECIES,
): Frame {
  const key = `${keyOf(species, stage, table)}/heart/${temperament}/${mark ?? ""}/${badge}`;
  return cached(key, () => {
    const one = body(species, stage, table);
    const expression = expressionOf(expressionsOf(species, stage, table), petIdOf(temperament));
    // The first Look only: a pet is one still Frame held for PET_MS, with no beat to alternate on.
    let rows: readonly string[] = stamp(one.pixels, one.anchors, expression[0] ?? []);
    const head = one.anchors.head;
    rows = paint(rows, { x: head.x - 2, y: head.y - HEART_HEIGHT, w: 5, h: HEART_HEIGHT }, HEART, "heart");
    const pattern = mark === undefined ? undefined : MARK[mark]?.pattern;
    if (pattern !== undefined) rows = paint(rows, MARK_SLOT, pattern, "mark");
    if (badge) rows = paint(rows, BADGE_SLOT, BADGE, "badge");
    return pack(rows);
  });
}

export { BADGE_SLOT, MARK_SLOT };

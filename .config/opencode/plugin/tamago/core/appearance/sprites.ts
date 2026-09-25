import { REFERENCE, known, mapsOf } from "../creature/catalog.ts";
import type { Body } from "./bodies.ts";
import { BADGE, BADGE_SLOT, MARK, MARK_SLOT } from "./marks.ts";
import { BLINK_EVERY, SWEEP, blinksAt, shift, sweepAt } from "./motion.ts";
import { PIXEL_HEIGHT, SPRITE_WIDTH, pack, paint, type Frame, type Pattern } from "./pixels.ts";
import type { Temperament } from "../creature/sheet.ts";
import type { SpeciesId } from "../creature/species.ts";
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
  eyes: [
    { x: 11, y: 18, w: 3, h: 3 },
    { x: 17, y: 18, w: 3, h: 3 },
  ],
};

/** The 3 x 3 eye patterns, one set per Activity, alternated by the cadence. */
const FACES: Record<Activity, readonly Pattern[]> = {
  idle: [[".#.", "###", ".#."]],
  thinking: [[".#.", "###", ".#."], ["...", "###", ".#."]],
  working: [[".#.", "###", ".#."]],
  waiting: [["###", "#.#", "###"]],
  hurt: [["#.#", ".#.", "#.#"]],
  sleeping: [["...", "###", "..."]],
};

const SHUT: Pattern = ["...", "###", "..."];

/** Eyes of a petted Tamago, per Temperament. */
export const EYES: Record<Temperament, Pattern> = {
  cheerful: ["#.#", ".#.", "..."],
  sarcastic: ["...", "###", ".#."],
  stoic: [".#.", "###", ".#."],
  dreamy: ["...", "#.#", "###"],
};

/** How long the heart stays on the sprite after a pet. */
export const PET_MS = 2_000;
/** The heart drawn over the head while petted. Pixels now, not a character. */
const HEART: Pattern = [".#.#.", "#####", "#####", ".###.", "..#.."];
const HEART_AT = { x: 13, y: 13, w: 5, h: 5 };

/**
 * Where the migration put every Species' old eye colour. Task 4 deletes this
 * along with the engine's shared Faces: once a Species owns its expressions,
 * an eye is drawn in whatever colours that Species chose. Exported so a
 * catalog test can assert every Species' own Palette (and EGG_PALETTE) still
 * reaches this far.
 */
export const EYE_INDEX = 4;

/** The body to draw: the common egg, else the Species' map, else the reference's. */
function body(species: SpeciesId, stage: StageId): Body {
  if (stage === "egg") return EGG;
  return mapsOf(species)[stage];
}

/** The cache key: every egg shares one entry, an unknown Species shares the reference's. */
function keyOf(species: SpeciesId, stage: StageId): string {
  if (stage === "egg") return "egg";
  return `${known(species) ? species : REFERENCE}/${stage}`;
}

/** Builds one Frame: the map, moved, then the overlays, then packed. */
function build(one: Body, face: Pattern, beat: number, mark: TraitId | undefined, badge: boolean): Frame {
  let rows: readonly string[] = one.pixels;
  const motion = one.motion;
  if (motion?.tail !== undefined) rows = shift(rows, motion.tail, sweepAt(beat));
  if (motion?.ears !== undefined && blinksAt(beat)) for (const ear of motion.ears) rows = shift(rows, ear, 1);
  for (const eye of one.eyes) rows = paint(rows, eye, face, EYE_INDEX);
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
 * How many beats before the whole animation repeats: the Face cycle, the tail sweep and the blink
 * cadence all wrap within it, and nothing past it can change a Frame. Computed, never hardcoded, so
 * an Activity with a different Face count still gets the right period. Exported so a test can walk
 * a whole period without duplicating the arithmetic.
 */
export function periodOf(activity: Activity): number {
  return lcm(lcm(FACES[activity].length, SWEEP.length), BLINK_EVERY);
}

export function frameAt(
  species: SpeciesId,
  stage: StageId,
  activity: Activity,
  index: number,
  mark?: TraitId,
  badge = false,
): Frame {
  const faces = FACES[activity];
  const period = periodOf(activity);
  // Wrapped once, up front: sweepAt and blinksAt already wrap internally on shorter periods that
  // divide this one, so this changes nothing about the Frame while keeping the cache — and the
  // clock-driven index passed in from the view — bounded instead of growing forever.
  const wrapped = ((index % period) + period) % period;
  const beat = wrapped % faces.length;
  const key = `${keyOf(species, stage)}/${activity}/${wrapped}/${mark ?? ""}/${badge}`;
  return cached(key, () => {
    const one = body(species, stage);
    const blinking = activity !== "sleeping" && blinksAt(wrapped);
    return build(one, blinking ? SHUT : (faces[beat] ?? SHUT), wrapped, mark, badge);
  });
}

/** The Sprite while petted: the Temperament's eyes and a heart over the head. */
export function heartFrame(
  species: SpeciesId,
  stage: StageId,
  temperament: Temperament,
  mark?: TraitId,
  badge = false,
): Frame {
  const key = `${keyOf(species, stage)}/heart/${temperament}/${mark ?? ""}/${badge}`;
  return cached(key, () => {
    const one = body(species, stage);
    let rows: readonly string[] = one.pixels;
    for (const eye of one.eyes) rows = paint(rows, eye, EYES[temperament], EYE_INDEX);
    rows = paint(rows, HEART_AT, HEART, "heart");
    const pattern = mark === undefined ? undefined : MARK[mark]?.pattern;
    if (pattern !== undefined) rows = paint(rows, MARK_SLOT, pattern, "mark");
    if (badge) rows = paint(rows, BADGE_SLOT, BADGE, "badge");
    return pack(rows);
  });
}

export { BADGE_SLOT, MARK_SLOT };

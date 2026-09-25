import { REFERENCE, known, mapsOf } from "../creature/catalog.ts";
import type { Body } from "./bodies.ts";
import { BADGE, BADGE_SLOT, MARK, MARK_SLOT } from "./marks.ts";
import { blinksAt, shift, sweepAt } from "./motion.ts";
import { PIXEL_HEIGHT, SPRITE_WIDTH, pack, paint, type Frame, type Pattern } from "./pixels.ts";
import type { Temperament } from "../creature/sheet.ts";
import type { SpeciesId } from "../creature/species.ts";
import type { StageId } from "../career/stage.ts";
import type { TraitId } from "../career/pick.ts";
import type { Activity } from "../moment/session.ts";

export { PIXEL_HEIGHT, SPRITE_HEIGHT, SPRITE_WIDTH, type Cell, type Frame, type Role } from "./pixels.ts";

/** The egg every Species hatches from: what is inside only shows at hatchling. */
const EGG: Body = {
  pixels: [
    "........ooo..........",
    ".......ooaaaoo.......",
    "......oaaaaaaao......",
    ".....oaaaaaaaaao.....",
    ".....oaaaaaaaaao.....",
    "....oaaaaaaaaaaao....",
    "....oaaaaaaaaaaao....",
    "....oaaabbbaaaaao....",
    "....oaaabbbaaaaao....",
    "....oaaaaaaabbbao....",
    "....oaaaaaaabbbao....",
    "....oaaaaaaaaaaao....",
    "....oaaabbbaaaaao....",
    "....oaaabbbaaaaao....",
    "....oaaaaaaaaaaao....",
    "....oaaaaaaaaaaao....",
    ".....oaaaaaaaaao.....",
    ".....oaaaaaaaaao.....",
    "......oaaaaaaao......",
    ".......ooooooo.......",
  ],
  eyes: [
    { x: 6, y: 6, w: 3, h: 3 },
    { x: 12, y: 6, w: 3, h: 3 },
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
const HEART_AT = { x: 8, y: 1, w: 5, h: 5 };

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
  for (const eye of one.eyes) rows = paint(rows, eye, face, "eye");
  const pattern = mark === undefined ? undefined : MARK[mark];
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

/** Every Frame of an Activity, in cadence order, for the callers that count them. */
export function frames(species: SpeciesId, stage: StageId, activity: Activity): readonly Frame[] {
  return FACES[activity].map((_, index) => frameAt(species, stage, activity, index));
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
  const beat = ((index % faces.length) + faces.length) % faces.length;
  const key = `${keyOf(species, stage)}/${activity}/${index}/${mark ?? ""}/${badge}`;
  return cached(key, () => {
    const one = body(species, stage);
    const blinking = activity !== "sleeping" && blinksAt(index);
    return build(one, blinking ? SHUT : (faces[beat] ?? SHUT), index, mark, badge);
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
    for (const eye of one.eyes) rows = paint(rows, eye, EYES[temperament], "eye");
    rows = paint(rows, HEART_AT, HEART, "heart");
    const pattern = mark === undefined ? undefined : MARK[mark];
    if (pattern !== undefined) rows = paint(rows, MARK_SLOT, pattern, "mark");
    if (badge) rows = paint(rows, BADGE_SLOT, BADGE, "badge");
    return pack(rows);
  });
}

export { BADGE_SLOT, MARK_SLOT };

import { REFERENCE, bodiesOf, known } from "../creature/catalog.ts";
import type { Body } from "./bodies.ts";
import { MARK_COLUMN, MARK_LINE } from "./marks.ts";
import type { Temperament } from "../creature/sheet.ts";
import type { SpeciesId } from "../creature/species.ts";
import type { StageId } from "../career/stage.ts";
import type { Activity } from "../moment/session.ts";

export const SPRITE_WIDTH = 11;
export const SPRITE_HEIGHT = 5;

export type Frame = readonly string[];

type Face = { eyes: string; mark: string };

/** Pads every line to SPRITE_WIDTH so a short line never shifts the layout. */
function fit(lines: string[]): Frame {
  return lines.map((line) => line.padEnd(SPRITE_WIDTH));
}

/** The egg every Species hatches from: what is inside only shows at hatchling. */
const EGG: Body = (e, m) => [
  `   .---.  ${m}`,
  "  /     \\",
  ` |  ${e}  |`,
  "  \\     /",
  "   '---'",
];

/** The body to draw: the common egg, else the Species' body, else the reference's for a Species this build does not know. */
function body(species: SpeciesId, stage: StageId): Body {
  if (stage === "egg") return EGG;
  return bodiesOf(species)[stage];
}

/** The cache key: every egg shares one entry so identity holds across Species; an unknown Species shares the reference's. */
function keyOf(species: SpeciesId, stage: StageId): string {
  if (stage === "egg") return "egg";
  return `${known(species) ? species : REFERENCE}/${stage}`;
}

const FACES: Record<Activity, readonly Face[]> = {
  idle: [
    { eyes: "o o", mark: " " },
    { eyes: "- -", mark: " " },
  ],
  thinking: [
    { eyes: "o o", mark: "." },
    { eyes: "o o", mark: "?" },
  ],
  working: [
    { eyes: "o o", mark: "|" },
    { eyes: "o o", mark: "/" },
    { eyes: "o o", mark: "-" },
    { eyes: "o o", mark: "\\" },
  ],
  waiting: [
    { eyes: "O O", mark: "!" },
    { eyes: "O O", mark: " " },
  ],
  hurt: [
    { eyes: "x x", mark: "*" },
    { eyes: "x x", mark: " " },
  ],
  sleeping: [{ eyes: "- -", mark: "z" }],
};

/** One entry per species × stage × activity; frames never change, so callers can rely on identity. */
const CACHE = new Map<string, readonly Frame[]>();

export function frames(species: SpeciesId, stage: StageId, activity: Activity): readonly Frame[] {
  const key = `${keyOf(species, stage)}/${activity}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const draw = body(species, stage);
  const built = FACES[activity].map((face) => fit(draw(face.eyes, face.mark)));
  CACHE.set(key, built);
  return built;
}

/** Writes `mark` over the overlay cell of a Frame. */
function overlay(frame: Frame, mark: string): Frame {
  return frame.map((line, index) => (index === MARK_LINE ? line.slice(0, MARK_COLUMN) + mark + line.slice(MARK_COLUMN + 1) : line));
}

const MARKED = new Map<string, readonly Frame[]>();

/** The Frames of an Activity with a Trait mark written on them, cached like the bare ones so identity stays stable. */
function markedFrames(species: SpeciesId, stage: StageId, activity: Activity, mark: string): readonly Frame[] {
  const key = `${keyOf(species, stage)}/${activity}/${mark}`;
  const hit = MARKED.get(key);
  if (hit) return hit;
  const built = frames(species, stage, activity).map((frame) => overlay(frame, mark));
  MARKED.set(key, built);
  return built;
}

/** How long the heart stays on the sprite after a pet. */
export const PET_MS = 2_000;
/** Not ASCII: one column in most terminals, two in a few, where line 0 overflows for PET_MS. */
export const HEART = "♥";

/** Eyes of a petted Tamago, per Temperament. Three columns, like every Face. */
export const EYES: Record<Temperament, string> = {
  cheerful: "^ ^",
  sarcastic: "- o",
  stoic: "o o",
  dreamy: "~ ~",
};
const HEARTS = new Map<string, Frame>();

/** The Sprite while petted, whatever the Activity: the Temperament's eyes and a heart for the mark. Cached, so identity is stable. */
export function heartFrame(species: SpeciesId, stage: StageId, temperament: Temperament, mark?: string): Frame {
  const key = `${keyOf(species, stage)}/${temperament}/${mark ?? ""}`;
  const hit = HEARTS.get(key);
  if (hit) return hit;
  const drawn = fit(body(species, stage)(EYES[temperament], HEART));
  const built = mark === undefined || mark === "" ? drawn : overlay(drawn, mark);
  HEARTS.set(key, built);
  return built;
}

export function frameAt(species: SpeciesId, stage: StageId, activity: Activity, index: number, mark?: string): Frame {
  const all = mark === undefined || mark === "" ? frames(species, stage, activity) : markedFrames(species, stage, activity, mark);
  const frame = all[((index % all.length) + all.length) % all.length];
  return frame ?? fit([]);
}

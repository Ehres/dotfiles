import { BODIES, type Body } from "./bodies.ts";
import type { Temperament } from "./sheet.ts";
import { REFERENCE, type SpeciesId } from "./species.ts";
import type { StageId } from "./stage.ts";
import type { Activity } from "./state.ts";

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

/** Whether this build draws that Species itself; anything else draws as the reference. */
function known(species: SpeciesId): boolean {
  return Object.hasOwn(BODIES, species);
}

/** The body to draw: the common egg, else the Species' body, else the reference's for a Species this build does not know. */
function body(species: SpeciesId, stage: StageId): Body {
  if (stage === "egg") return EGG;
  return BODIES[known(species) ? species : REFERENCE]![stage];
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
export function heartFrame(species: SpeciesId, stage: StageId, temperament: Temperament): Frame {
  const key = `${keyOf(species, stage)}/${temperament}`;
  const hit = HEARTS.get(key);
  if (hit) return hit;
  const built = fit(body(species, stage)(EYES[temperament], HEART));
  HEARTS.set(key, built);
  return built;
}

export function frameAt(species: SpeciesId, stage: StageId, activity: Activity, index: number): Frame {
  const all = frames(species, stage, activity);
  const frame = all[((index % all.length) + all.length) % all.length];
  return frame ?? fit([]);
}

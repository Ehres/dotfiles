import type { StageId } from "./stage.ts";
import type { Activity } from "./state.ts";

export const SPRITE_WIDTH = 11;
export const SPRITE_HEIGHT = 5;

export type Frame = readonly string[];

type Face = { eyes: string; mark: string };
type Body = (eyes: string, mark: string) => string[];

/** Pads every line to SPRITE_WIDTH so a short line never shifts the layout. */
function fit(lines: string[]): Frame {
  return lines.map((line) => line.padEnd(SPRITE_WIDTH));
}

const BODIES: Record<StageId, Body> = {
  egg: (e, m) => [
    `   .---.  ${m}`,
    "  /     \\",
    ` |  ${e}  |`,
    "  \\     /",
    "   '---'",
  ],
  hatchling: (e, m) => [
    `   .---.  ${m}`,
    `  ( ${e} )`,
    "   \\ ^ /",
    "    '-'",
    "",
  ],
  young: (e, m) => [
    `   .---.  ${m}`,
    `  ( ${e} )`,
    "  /| ^ |\\",
    "   |___|",
    "   /   \\",
  ],
  adult: (e, m) => [
    `  /\\   /\\ ${m}`,
    `  ( ${e} )`,
    " /| ^^^ |\\",
    "  |_____|",
    "  /|   |\\",
  ],
  elder: (e, m) => [
    `  \\|/ \\|/ ${m}`,
    `  ( ${e} )`,
    " /|~^^^~|\\",
    "  |_____|",
    "  /|   |\\",
  ],
};

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

/** One entry per stage × activity pair; frames never change, so callers can rely on identity. */
const CACHE = new Map<string, readonly Frame[]>();

export function frames(stage: StageId, activity: Activity): readonly Frame[] {
  const key = `${stage}/${activity}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const body = BODIES[stage];
  const built = FACES[activity].map((face) => fit(body(face.eyes, face.mark)));
  CACHE.set(key, built);
  return built;
}

/** How long the heart stays on the sprite after a pet. */
export const PET_MS = 2_000;
/** Not ASCII: one column in most terminals, two in a few, where line 0 overflows for PET_MS. */
export const HEART = "♥";
const HEARTS = new Map<StageId, Frame>();

/** The Sprite while petted, whatever the Activity: happy eyes and a heart for the mark. Cached, so identity is stable. */
export function heartFrame(stage: StageId): Frame {
  const hit = HEARTS.get(stage);
  if (hit) return hit;
  const built = fit(BODIES[stage]("^ ^", HEART));
  HEARTS.set(stage, built);
  return built;
}

export function frameAt(stage: StageId, activity: Activity, index: number): Frame {
  const all = frames(stage, activity);
  const frame = all[((index % all.length) + all.length) % all.length];
  return frame ?? fit([]);
}

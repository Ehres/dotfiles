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

export function frames(stage: StageId, activity: Activity): readonly Frame[] {
  const body = BODIES[stage];
  return FACES[activity].map((face) => fit(body(face.eyes, face.mark)));
}

export function frameAt(stage: StageId, activity: Activity, index: number): Frame {
  const all = frames(stage, activity);
  const frame = all[((index % all.length) + all.length) % all.length];
  return frame ?? fit([]);
}

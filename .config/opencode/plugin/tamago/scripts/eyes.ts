// scripts/eyes.ts — measures a Species' drawn eyes and prints the patches that redraw them.
//
//   node scripts/eyes.ts frog --check --ink 0,c,d                           does every eye frame cover its eye?
//   node scripts/eyes.ts frog young cross --size 5x4 --ink 0,c,d --skin 7   the patches of one look
//
// The eyes are read from the map the importer wrote, so this runs after the import and the
// anchors, before the expressions. A patch never touches a pixel on the silhouette's border: an
// eye drawn on the outline (a frog's) keeps its outline whatever the look.
import { mapsOf, SPECIES } from "../core/creature/catalog.ts";
import { expressionsOf } from "../core/appearance/sprites.ts";
import type { Grown } from "../core/appearance/bodies.ts";
import type { Rect } from "../core/appearance/pixels.ts";
import { Refusal } from "./png.ts";

export type Side = "left" | "right";

export const LOOKS = ["shut", "cross", "caret", "arc", "lid", "shine", "glance"] as const;
export type LookKind = (typeof LOOKS)[number];

export type LookOptions = {
  /** The map characters that make up an eye: its dark ink and its highlights. */
  ink: ReadonlySet<string>;
  /** The character a line, a cross or a lid is drawn in. Defaults to the first of `ink`. */
  dark?: string;
  /** The character a highlight is drawn in; `shine` requires it. */
  light?: string;
  /** The skin an erased eye pixel becomes. Without it, each pixel takes the skin around it. */
  skin?: string;
  /** Rows to move the glyph down from its centred place. */
  down?: number;
};

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function at(map: readonly string[], x: number, y: number): string {
  return map[y]?.[x] ?? ".";
}

const key = (x: number, y: number): string => `${x},${y}`;

/** An opaque pixel next to a transparent one, or to the canvas' edge: part of the silhouette's outline. */
export function onBorder(map: readonly string[], x: number, y: number): boolean {
  if (at(map, x, y) === ".") return false;
  return NEIGHBOURS.some(([dx, dy]) => at(map, x + dx, y + dy) === ".");
}

/** The eye's own pixels inside `box`: eye ink, not on the border. */
export function eyeCells(map: readonly string[], box: Rect, ink: ReadonlySet<string>): Set<string> {
  const cells = new Set<string>();
  for (let y = box.y; y < box.y + box.h; y++)
    for (let x = box.x; x < box.x + box.w; x++) if (ink.has(at(map, x, y)) && !onBorder(map, x, y)) cells.add(key(x, y));
  return cells;
}

/**
 * The whole eye reached from the ink inside `box`, 4-connected and never crossing the border,
 * as the smallest rectangle holding it; undefined when `box` holds no ink at all.
 */
export function measureEye(map: readonly string[], box: Rect, ink: ReadonlySet<string>): Rect | undefined {
  const seen = new Set<string>();
  const stack = [...eyeCells(map, box, ink)].map((cell) => cell.split(",").map(Number) as [number, number]);
  while (stack.length > 0) {
    const [x, y] = stack.pop() ?? [0, 0];
    if (seen.has(key(x, y))) continue;
    seen.add(key(x, y));
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (ink.has(at(map, nx, ny)) && !onBorder(map, nx, ny) && !seen.has(key(nx, ny))) stack.push([nx, ny]);
    }
  }
  if (seen.size === 0) return undefined;
  const points = [...seen].map((cell) => cell.split(",").map(Number) as [number, number]);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 };
}

/** Whether `frame` holds all of `eye`. */
export function covers(frame: Rect, eye: Rect): boolean {
  return eye.x >= frame.x && eye.y >= frame.y && eye.x + eye.w <= frame.x + frame.w && eye.y + eye.h <= frame.y + frame.h;
}

/** The commonest opaque colour around a pixel that is neither ink nor part of the eye, nearest ring first. */
export function skinAround(map: readonly string[], x: number, y: number, eye: ReadonlySet<string>, ink: ReadonlySet<string>): string {
  for (let radius = 1; radius <= 3; radius++) {
    const counts = new Map<string, number>();
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const px = at(map, x + dx, y + dy);
        if (px === "." || ink.has(px) || eye.has(key(x + dx, y + dy))) continue;
        counts.set(px, (counts.get(px) ?? 0) + 1);
      }
    const best = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (best !== undefined) return best[0];
  }
  return ".";
}

const GLYPHS: Record<"cross" | "caret" | "arc", readonly string[]> = {
  cross: ["1.1", ".1.", "1.1"],
  caret: [".11.", "1..1"],
  arc: ["1..1", ".11."],
};

type Cell = { x: number; y: number; row: number; col: number; eye: boolean; border: boolean };

/** One patch over `box`, one character per pixel from `paint`; a border pixel is never painted. */
function over(map: readonly string[], box: Rect, ink: ReadonlySet<string>, paint: (cell: Cell) => string): string[] {
  const eye = eyeCells(map, box, ink);
  const rows: string[] = [];
  for (let row = 0; row < box.h; row++) {
    let line = "";
    for (let col = 0; col < box.w; col++) {
      const x = box.x + col;
      const y = box.y + row;
      const border = at(map, x, y) === "." || onBorder(map, x, y);
      line += border ? "." : paint({ x, y, row, col, eye: eye.has(key(x, y)), border });
    }
    rows.push(line);
  }
  return rows;
}

/**
 * The patches of one look over the eye at `box`, one per Look: a single one for every kind but
 * `shine`, which alternates a highlight between two corners of the eye. A glyph that cannot sit in
 * the middle of an eye of even width leans toward the face on both sides, so the pair stays
 * symmetric; `glance` is one column wider than `box`, room for the eye it moves right.
 */
export function lookPatches(map: readonly string[], box: Rect, side: Side, kind: LookKind, options: LookOptions): string[][] {
  const { ink } = options;
  const dark = options.dark ?? [...ink][0] ?? "0";
  const eye = eyeCells(map, box, ink);
  const skin = (x: number, y: number): string => options.skin ?? skinAround(map, x, y, eye, ink);

  if (kind === "shut" || kind === "lid") {
    const line = Math.floor((box.h - 1) / 2) + (kind === "shut" && box.h % 2 === 0 ? 1 : 0);
    const lidRow = Math.floor((box.h - 1) / 2);
    return [
      over(map, box, ink, (cell) => {
        if (kind === "lid") {
          if (cell.row > lidRow) return ".";
          if (cell.row === lidRow) return cell.eye ? dark : ".";
          return cell.eye ? skin(cell.x, cell.y) : ".";
        }
        if (cell.row === line) return dark;
        return cell.eye ? skin(cell.x, cell.y) : ".";
      }),
    ];
  }

  if (kind === "cross" || kind === "caret" || kind === "arc") {
    const glyph = GLYPHS[kind];
    const width = glyph[0]?.length ?? 0;
    const ox = side === "left" ? Math.ceil((box.w - width) / 2) : Math.floor((box.w - width) / 2);
    const oy = Math.floor((box.h - glyph.length) / 2) + (options.down ?? 0);
    return [
      over(map, box, ink, (cell) => {
        const on = glyph[cell.row - oy]?.[cell.col - ox] === "1";
        if (on) return dark;
        return cell.eye ? skin(cell.x, cell.y) : ".";
      }),
    ];
  }

  if (kind === "glance") {
    const wide = { ...box, w: box.w + 1 };
    return [
      over(map, wide, ink, (cell) => {
        if (eye.has(key(cell.x - 1, cell.y))) return at(map, cell.x - 1, cell.y);
        return cell.eye ? skin(cell.x, cell.y) : ".";
      }),
    ];
  }

  // shine: a 2 x 2 highlight in the eye's lower-right corner, then in its upper-left, the drawn highlights darkened meanwhile
  const light = options.light;
  if (light === undefined) throw new Refusal("shine needs --light, the character a highlight is drawn in");
  const dim = (x: number, y: number): boolean => eye.has(key(x, y));
  const blocks: [number, number][] = [];
  for (const cell of eye) {
    const [x, y] = cell.split(",").map(Number) as [number, number];
    if (dim(x + 1, y) && dim(x, y + 1) && dim(x + 1, y + 1)) blocks.push([x, y]);
  }
  const size = blocks.length >= 2 ? 2 : 1;
  const pool = size === 2 ? blocks : [...eye].map((cell) => cell.split(",").map(Number) as [number, number]);
  if (pool.length === 0) throw new Refusal("shine found no eye ink in the frame");
  const byCorner = [...pool].sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  const corners = [byCorner[byCorner.length - 1], byCorner[0]] as [number, number][];
  return corners.map(([hx, hy]) =>
    over(map, box, ink, (cell) => {
      if (cell.x >= hx && cell.x < hx + size && cell.y >= hy && cell.y < hy + size) return light;
      return cell.eye && at(map, cell.x, cell.y) === light ? dark : ".";
    }),
  );
}

/** A look for both eyes, as pasted into an Expressions table: one Look per patch pair. */
export function formatLook(left: readonly (readonly string[])[], right: readonly (readonly string[])[], leftAt = "left_eye", rightAt = "right_eye"): string {
  const quote = (rows: readonly string[]): string => `[${rows.map((row) => JSON.stringify(row)).join(", ")}]`;
  const looks = left.map(
    (patch, i) => `  [\n    { at: "${leftAt}", pixels: ${quote(patch)} },\n    { at: "${rightAt}", pixels: ${quote(right[i] ?? [])} },\n  ],`,
  );
  return `[\n${looks.join("\n")}\n]`;
}

export type Report = { stage: Grown; side: Side; frame: Rect; eye: Rect | undefined; covered: boolean };

/** Every eye of every Stage against the frame its `shut` patch is drawn over. */
export function check(id: string, ink: ReadonlySet<string>): Report[] {
  const maps = mapsOf(id);
  const reports: Report[] = [];
  for (const stage of ["hatchling", "young", "adult", "elder"] as const) {
    const body = maps[stage];
    const shut = expressionsOf(id, stage).shut[0] ?? [];
    for (const side of ["left", "right"] as const) {
      const anchor = body.anchors[`${side}_eye`];
      const patch = shut.find((one) => one.at === `${side}_eye`);
      if (anchor === undefined || patch === undefined) continue;
      const frame = { x: anchor.x, y: anchor.y, w: patch.pixels[0]?.length ?? 0, h: patch.pixels.length };
      const eye = measureEye(body.pixels, frame, ink);
      reports.push({ stage, side, frame, eye, covered: eye !== undefined && covers(frame, eye) });
    }
  }
  return reports;
}

const rect = (r: Rect): string => `x ${r.x}-${r.x + r.w - 1}, y ${r.y}-${r.y + r.h - 1} (${r.w} x ${r.h})`;

export function formatReport(reports: readonly Report[]): string {
  return reports
    .map(({ stage, side, frame, eye, covered }) => {
      const verdict = eye === undefined ? "NO INK in the frame" : covered ? "ok" : `TOO SMALL, the eye is ${rect(eye)}`;
      return `${stage.padEnd(9)} ${side.padEnd(5)} frame ${rect(frame)}  ${verdict}`;
    })
    .join("\n");
}

export type Args =
  | { mode: "check"; id: string; options: LookOptions }
  | { mode: "look"; id: string; stage: Grown; kind: LookKind; size: { w: number; h: number }; options: LookOptions };

export function parseArgs(argv: readonly string[]): Args {
  let rest = [...argv];
  function take(flag: string): string | undefined {
    const i = rest.indexOf(flag);
    if (i === -1) return undefined;
    const value = rest[i + 1];
    if (value === undefined || value.startsWith("--")) throw new Refusal(`${flag} requires a value`);
    rest = rest.filter((_, j) => j !== i && j !== i + 1);
    return value;
  }
  const checking = rest.includes("--check");
  rest = rest.filter((arg) => arg !== "--check");
  const inkArg = take("--ink");
  if (inkArg === undefined) throw new Refusal("--ink is required: the map characters an eye is drawn in, e.g. --ink 0,c");
  const ink = new Set(inkArg.split(",").map((one) => one.trim()).filter((one) => one.length === 1));
  const options: LookOptions = { ink };
  const dark = take("--dark");
  const light = take("--light");
  const skin = take("--skin");
  const down = take("--down");
  if (dark !== undefined) options.dark = dark;
  if (light !== undefined) options.light = light;
  if (skin !== undefined) options.skin = skin;
  if (down !== undefined) options.down = Number(down);
  const sizeArg = take("--size");
  const [id, stage, kind] = rest;
  if (id === undefined || !SPECIES.some((one) => one.id === id)) throw new Refusal(`unknown Species "${id ?? ""}"`);
  if (checking) return { mode: "check", id, options };
  if (stage !== "hatchling" && stage !== "young" && stage !== "adult" && stage !== "elder") throw new Refusal(`unknown Stage "${stage ?? ""}"`);
  if (!LOOKS.includes(kind as LookKind)) throw new Refusal(`unknown look "${kind ?? ""}", one of ${LOOKS.join(", ")}`);
  const size = /^(\d+)x(\d+)$/.exec(sizeArg ?? "");
  if (size === null) throw new Refusal("--size WxH is required: the eye frame, as --check measures it");
  return { mode: "look", id, stage, kind: kind as LookKind, size: { w: Number(size[1]), h: Number(size[2]) }, options };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "check") {
    const reports = check(args.id, args.options.ink);
    console.log(formatReport(reports));
    if (reports.some((one) => !one.covered)) process.exitCode = 1;
    return;
  }
  const body = mapsOf(args.id)[args.stage];
  const patches = (["left", "right"] as const).map((side) => {
    const anchor = body.anchors[`${side}_eye`];
    if (anchor === undefined) throw new Refusal(`${args.stage} has no ${side}_eye anchor`);
    return lookPatches(body.pixels, { x: anchor.x, y: anchor.y, ...args.size }, side, args.kind, args.options);
  });
  console.log(formatLook(patches[0] ?? [], patches[1] ?? []));
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    if (error instanceof Refusal) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

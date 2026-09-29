// scripts/preview.ts — run: node scripts/preview.ts cat adult [--plain]
//
//   node scripts/preview.ts frog --stages [look]    the four grown Stages side by side, at real size
//   node scripts/preview.ts frog --live [look|all]  the same, animated; `all` walks every look in turn
//   node scripts/preview.ts --png a.png b.png ...   raw PNGs side by side at real size, before any import
//
// A look is an Activity (idle, thinking, working, waiting, hurt, sleeping) or pet:<Temperament>,
// the still Frame a pet holds under the heart. Stop --live with Ctrl-C.
import { SPECIES, mapsOf, paletteOf } from "../core/creature/catalog.ts";
import { expressionsOf, frameAt, headOf, heartFrame } from "../core/appearance/sprites.ts";
import { ACTIVITIES, type Activity } from "../core/moment/session.ts";
import { TEMPERAMENTS, type Temperament } from "../core/creature/sheet.ts";
import { basename } from "node:path";
import { decodePng, Refusal, type Image } from "./png.ts";
import { readPng } from "./import.ts";
import type { Cell, Frame, Ink, Rect } from "../core/appearance/pixels.ts";
import type { Point } from "../core/appearance/expressions.ts";
import { EGG_PALETTE, type Palette } from "../core/appearance/palette.ts";
import type { Grown } from "../core/appearance/bodies.ts";
import { STAGES, type StageId } from "../core/career/stage.ts";

const GLYPH = { both: "█", top: "▀", bottom: "▄", none: " " };
const RESET = "\x1b[0m";

/**
 * mark, badge and heart are never in a Species' Palette — the view layer
 * paints them from the OpenCode theme at render time. These three are
 * stand-ins so the preview can still show where they land; they are not the
 * real colours.
 */
const THEME_STAND_IN: Record<"mark" | "badge" | "heart", string> = {
  mark: "#e0af68",
  badge: "#bb9af7",
  heart: "#f7768e",
};

function rgb(hex: string): readonly [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function fg(hex: string): string {
  const [r, g, b] = rgb(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}

function bg(hex: string): string {
  const [r, g, b] = rgb(hex);
  return `\x1b[48;2;${r};${g};${b}m`;
}

/** Magenta so an index with no colour behind it is visible rather than silent. */
function colorOf(ink: Ink, palette: Palette): string {
  if (ink === "mark" || ink === "badge" || ink === "heart") return THEME_STAND_IN[ink];
  return palette[ink] ?? "#ff00ff";
}

/** One glyph, coloured per the view layer's rule: bg is set only under an opaque bottom pixel. */
function drawCell(cell: Cell, palette: Palette): string {
  const { top, bottom } = cell;
  if (top === null && bottom === null) return GLYPH.none;
  if (top !== null && bottom !== null) {
    if (top === bottom) return `${fg(colorOf(top, palette))}${GLYPH.both}${RESET}`;
    return `${fg(colorOf(top, palette))}${bg(colorOf(bottom, palette))}${GLYPH.top}${RESET}`;
  }
  if (top !== null) return `${fg(colorOf(top, palette))}${GLYPH.top}${RESET}`;
  if (bottom !== null) return `${fg(colorOf(bottom, palette))}${GLYPH.bottom}${RESET}`;
  return GLYPH.none;
}

function draw(frame: Frame, palette: Palette): string {
  return frame.map((row) => `${row.map((cell) => drawCell(cell, palette)).join("")}${RESET}`).join("\n");
}

/** The monochrome fallback for a terminal without truecolor: every non-null pixel is a block. */
function drawPlain(frame: Frame): string {
  return frame
    .map((row) =>
      row
        .map((cell) => (cell.top && cell.bottom ? GLYPH.both : cell.top ? GLYPH.top : cell.bottom ? GLYPH.bottom : GLYPH.none))
        .join(""),
    )
    .join("\n");
}

function rectLine(label: string, rect: Rect | undefined): string {
  if (rect === undefined) return `  ${label}: none`;
  return `  ${label}: x=${rect.x} y=${rect.y} w=${rect.w} h=${rect.h}`;
}

function pointLine(label: string, point: Point): string {
  return `  ${label}: x=${point.x} y=${point.y}`;
}

/**
 * A short, readable summary of the anchors, the motion rectangles and the
 * expressions this Species declares, in place of a raw JSON dump. `head`
 * leads: the heart and the Bubble's tail are aimed at it.
 */
function summarize(id: string, stage: StageId): string {
  // The egg is the engine's own shared body, so only what a caller can reach is printed: its head,
  // which the heart and the Bubble aim at, and the migrated table every egg is drawn with.
  if (stage === "egg") {
    return [
      "anchors: the shared egg's own, not this Species'",
      pointLine("head", headOf(id, stage)),
      `expressions: ${Object.keys(expressionsOf(id, stage)).join(", ")}`,
    ].join("\n");
  }
  const map = mapsOf(id)[stage as Grown];
  const named = Object.entries(map.anchors).filter(([name]) => name !== "head");
  named.sort(([a], [b]) => a.localeCompare(b));
  const lines = [
    "anchors:",
    pointLine("head", map.anchors.head),
    ...named.map(([name, point]) => pointLine(name, point)),
    "rectangles:",
    rectLine("motion.tail", map.motion?.tail),
  ];
  if (map.motion?.ears === undefined) lines.push(rectLine("motion.ears", undefined));
  else map.motion.ears.forEach((ear, index) => lines.push(rectLine(`motion.ears[${index}]`, ear)));
  lines.push(`expressions: ${Object.keys(expressionsOf(id, stage)).join(", ")}`);
  return lines.join("\n");
}

const GROWN: readonly Grown[] = ["hatchling", "young", "adult", "elder"];

/** Every look a Sprite can wear: the six Activities, then a pet for each Temperament. */
const LOOK_NAMES: readonly string[] = [...ACTIVITIES, ...TEMPERAMENTS.map((one) => `pet:${one}`)];

/** The Frame of one look at one tick, through the same functions the view calls. */
function frameOf(id: string, stage: Grown, look: string, tick: number): Frame {
  if (look.startsWith("pet:")) return heartFrame(id, stage, look.slice(4) as Temperament);
  return frameAt(id, stage, look as Activity, tick);
}

/** Frames side by side, `gap` columns apart, as terminal lines. */
function sideBySide(frames: readonly Frame[], palette: Palette, gap = 3): string[] {
  const height = Math.max(...frames.map((frame) => frame.length));
  const lines: string[] = [];
  for (let row = 0; row < height; row++) {
    lines.push(frames.map((frame) => (frame[row] ?? []).map((cell) => drawCell(cell, palette)).join("") + RESET).join(" ".repeat(gap)));
  }
  return lines;
}

function header(look: string): string {
  return GROWN.map((stage) => stage.padEnd(32)).join("   ") + `  ${look}`;
}

/**
 * A decoded PNG as terminal lines, two pixels a character like the view, straight from its RGBA:
 * a pixler draw has not been mapped onto a Palette yet, and may hold more colours than one allows.
 */
function pngLines(image: Image): string[] {
  const at = (x: number, y: number): string | null => {
    if (y >= image.height) return null;
    const i = (y * image.width + x) * 4;
    if ((image.pixels[i + 3] ?? 0) < 128) return null;
    return `${image.pixels[i] ?? 0};${image.pixels[i + 1] ?? 0};${image.pixels[i + 2] ?? 0}`;
  };
  const lines: string[] = [];
  for (let y = 0; y < image.height; y += 2) {
    let line = "";
    for (let x = 0; x < image.width; x++) {
      const top = at(x, y);
      const bottom = at(x, y + 1);
      if (top !== null && bottom !== null) line += `\x1b[38;2;${top}m\x1b[48;2;${bottom}m${GLYPH.top}${RESET}`;
      else if (top !== null) line += `\x1b[38;2;${top}m${GLYPH.top}${RESET}`;
      else if (bottom !== null) line += `\x1b[38;2;${bottom}m${GLYPH.bottom}${RESET}`;
      else line += GLYPH.none;
    }
    lines.push(line);
  }
  return lines;
}

const args = process.argv.slice(2);

if (args[0] === "--png") {
  const paths = args.slice(1);
  if (paths.length === 0) {
    console.error("usage: node scripts/preview.ts --png <image.png>...");
    process.exit(1);
  }
  let images: Image[];
  try {
    images = paths.map((path) => decodePng(readPng(path)));
  } catch (error) {
    // a missing file or a PNG this decoder refuses is named in one line, like the importer does, never a stack dump
    if (!(error instanceof Refusal)) throw error;
    console.error(error.message);
    process.exit(1);
  }
  const width = Math.max(...images.map((image) => image.width));
  console.log(paths.map((path) => basename(path).padEnd(width)).join("   "));
  const drawn = images.map(pngLines);
  const rows = Math.max(...drawn.map((lines) => lines.length));
  for (let row = 0; row < rows; row++) console.log(drawn.map((lines) => lines[row] ?? " ".repeat(width)).join("   "));
  process.exit(0);
}

const plain = args.includes("--plain");
const stages = args.includes("--stages");
const live = args.includes("--live");
const [id = "cat", second] = args.filter((arg) => !arg.startsWith("--"));
const stage = second ?? "adult";

if (!SPECIES.some((one) => one.id === id)) {
  console.error(`unknown Species "${id}". Known: ${SPECIES.map((one) => one.id).join(", ")}`);
  process.exit(1);
}

if (stages || live) {
  const wanted = second ?? (live ? "all" : "idle");
  if (wanted !== "all" && !LOOK_NAMES.includes(wanted)) {
    console.error(`unknown look "${wanted}". Known: ${LOOK_NAMES.join(", ")}, all`);
    process.exit(1);
  }
  const palette = paletteOf(id);
  if (!live) {
    console.log(header(wanted));
    console.log(sideBySide(GROWN.map((one) => frameOf(id, one, wanted, 0)), palette).join("\n"));
  } else {
    // Every look shows for about five seconds, a pet for two and a half: long enough to see a blink or an alternation.
    const scenes = (wanted === "all" ? LOOK_NAMES : [wanted]).map((look) => ({ look, ticks: look.startsWith("pet:") ? 6 : 12 }));
    let scene = 0;
    let beat = 0;
    let tick = 0;
    process.stdout.write("\x1b[2J\x1b[?25l");
    process.on("SIGINT", () => {
      process.stdout.write("\x1b[?25h\n");
      process.exit(0);
    });
    setInterval(() => {
      const { look, ticks } = scenes[scene] ?? { look: "idle", ticks: 12 };
      const lines = sideBySide(GROWN.map((one) => frameOf(id, one, look, tick)), palette);
      process.stdout.write(`\x1b[H${header(look)}\x1b[K\n${lines.join("\n")}`);
      tick++;
      if (++beat >= ticks) {
        beat = 0;
        scene = (scene + 1) % scenes.length;
      }
    }, 400);
  }
} else {
  if (!STAGES.some((one) => one.id === stage)) {
    console.error(`unknown Stage "${stage}". Known: ${STAGES.map((one) => one.id).join(", ")}`);
    process.exit(1);
  }

  console.log(`${id} / ${stage}\n`);
  const frame = frameAt(id, stage as StageId, "idle", 0);
  const palette = stage === "egg" ? EGG_PALETTE : paletteOf(id);
  console.log(plain ? drawPlain(frame) : draw(frame, palette));
  console.log(`\n${summarize(id, stage as StageId)}`);
}

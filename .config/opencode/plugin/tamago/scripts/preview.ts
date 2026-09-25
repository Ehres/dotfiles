// scripts/preview.ts — run: node scripts/preview.ts cat adult [--plain]
import { SPECIES, mapsOf, paletteOf } from "../core/creature/catalog.ts";
import { expressionsOf, frameAt, headOf } from "../core/appearance/sprites.ts";
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

const args = process.argv.slice(2);
const plain = args.includes("--plain");
const [id = "cat", stage = "adult"] = args.filter((arg) => arg !== "--plain");

if (!SPECIES.some((one) => one.id === id)) {
  console.error(`unknown Species "${id}". Known: ${SPECIES.map((one) => one.id).join(", ")}`);
  process.exit(1);
}

if (!STAGES.some((one) => one.id === stage)) {
  console.error(`unknown Stage "${stage}". Known: ${STAGES.map((one) => one.id).join(", ")}`);
  process.exit(1);
}

console.log(`${id} / ${stage}\n`);
const frame = frameAt(id, stage as StageId, "idle", 0);
const palette = stage === "egg" ? EGG_PALETTE : paletteOf(id);
console.log(plain ? drawPlain(frame) : draw(frame, palette));
console.log(`\n${summarize(id, stage as StageId)}`);

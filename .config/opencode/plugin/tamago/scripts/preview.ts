// scripts/preview.ts — run: node scripts/preview.ts cat adult [--plain] [--light]
import { SPECIES, mapsOf, paletteOf } from "../core/creature/catalog.ts";
import { frameAt } from "../core/appearance/sprites.ts";
import type { Cell, Frame, Rect, Role } from "../core/appearance/pixels.ts";
import type { Skin } from "../core/appearance/palette.ts";
import type { Grown } from "../core/appearance/bodies.ts";
import type { StageId } from "../core/career/stage.ts";

const GLYPH = { both: "█", top: "▀", bottom: "▄", none: " " };
const RESET = "\x1b[0m";

/**
 * mark, badge and heart are never in a Species' Skin — the view layer paints
 * them from the OpenCode theme at render time. These three are stand-ins so
 * the preview can still show where they land; they are not the real colours.
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

function colorOf(role: Role, skin: Skin): string {
  if (role === "mark" || role === "badge" || role === "heart") return THEME_STAND_IN[role];
  return skin[role];
}

/** One glyph, coloured per the view layer's rule: bg is set only under an opaque bottom pixel. */
function drawCell(cell: Cell, skin: Skin): string {
  const { top, bottom } = cell;
  if (top === null && bottom === null) return GLYPH.none;
  if (top !== null && bottom !== null) {
    if (top === bottom) return `${fg(colorOf(top, skin))}${GLYPH.both}${RESET}`;
    return `${fg(colorOf(top, skin))}${bg(colorOf(bottom, skin))}${GLYPH.top}${RESET}`;
  }
  if (top !== null) return `${fg(colorOf(top, skin))}${GLYPH.top}${RESET}`;
  return `${fg(colorOf(bottom as Role, skin))}${GLYPH.bottom}${RESET}`;
}

function draw(frame: Frame, skin: Skin): string {
  return frame.map((row) => `${row.map((cell) => drawCell(cell, skin)).join("")}${RESET}`).join("\n");
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

/** A short, readable summary of the eyes and motion rectangles, in place of a raw JSON dump. */
function summarize(id: string, stage: StageId): string {
  if (stage === "egg") return "rectangles: n/a (the egg is a shared body, not a Species map)";
  const map = mapsOf(id)[stage as Grown];
  const lines = [
    "rectangles:",
    rectLine("eyes[0]", map.eyes[0]),
    rectLine("eyes[1]", map.eyes[1]),
    rectLine("motion.tail", map.motion?.tail),
  ];
  if (map.motion?.ears === undefined) lines.push(rectLine("motion.ears", undefined));
  else map.motion.ears.forEach((ear, index) => lines.push(rectLine(`motion.ears[${index}]`, ear)));
  return lines.join("\n");
}

const args = process.argv.slice(2);
const plain = args.includes("--plain");
const variant = args.includes("--light") ? "light" : "dark";
const [id = "cat", stage = "adult"] = args.filter((arg) => arg !== "--plain" && arg !== "--light");

if (!SPECIES.some((one) => one.id === id)) {
  console.error(`unknown Species "${id}". Known: ${SPECIES.map((one) => one.id).join(", ")}`);
  process.exit(1);
}

console.log(`${id} / ${stage} / ${variant}\n`);
const frame = frameAt(id, stage as StageId, "idle", 0);
console.log(plain ? drawPlain(frame) : draw(frame, paletteOf(id, variant)));
console.log(`\n${summarize(id, stage as StageId)}`);

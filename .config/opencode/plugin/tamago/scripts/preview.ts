// scripts/preview.ts — run: node scripts/preview.ts cat adult
import { SPECIES, mapsOf } from "../core/creature/catalog.ts";
import { frameAt } from "../core/appearance/sprites.ts";
import type { Frame } from "../core/appearance/pixels.ts";

const GLYPH = { both: "█", top: "▀", bottom: "▄", none: " " };

function draw(frame: Frame): string {
  return frame
    .map((row) =>
      row
        .map((cell) => (cell.top && cell.bottom ? GLYPH.both : cell.top ? GLYPH.top : cell.bottom ? GLYPH.bottom : GLYPH.none))
        .join(""),
    )
    .join("\n");
}

const [, , id = "cat", stage = "adult"] = process.argv;
if (!SPECIES.some((one) => one.id === id)) {
  console.error(`unknown Species "${id}". Known: ${SPECIES.map((one) => one.id).join(", ")}`);
  process.exit(1);
}
console.log(`${id} / ${stage}\n`);
console.log(draw(frameAt(id, stage as never, "idle", 0)));
console.log(`\nrectangles: ${JSON.stringify(stage === "egg" ? {} : mapsOf(id)[stage as never], null, 0).slice(0, 400)}`);

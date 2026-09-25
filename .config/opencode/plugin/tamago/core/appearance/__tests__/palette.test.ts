import { test } from "node:test";
import assert from "node:assert/strict";
import { EGG_PALETTE, PALETTE_MAX } from "../palette.ts";
import { REFERENCE, SPECIES, paletteOf } from "../../creature/catalog.ts";
import type { SpeciesDef } from "../../creature/species.ts";

const HEX = /^#[0-9a-f]{6}$/;

test("every Species' palette holds between 1 and PALETTE_MAX lowercase #rrggbb colours", () => {
  for (const one of SPECIES) {
    assert.ok(one.palette.length >= 1 && one.palette.length <= PALETTE_MAX, `${one.id} has ${one.palette.length} colours`);
    for (const [index, color] of one.palette.entries()) {
      assert.match(color, HEX, `${one.id}[${index}]`);
    }
  }
});

test("EGG_PALETTE is none of the Species' own palettes", () => {
  for (const one of SPECIES) {
    assert.notDeepEqual(one.palette, EGG_PALETTE, one.id);
  }
});

// view/sprite.tsx:85 passes a Species id read straight off a save file, which is exactly "a
// Species this build does not draw" — and sprites.ts's own map fallback (keyOf/body) must agree
// with this one, or a Tamago whose id this build dropped would draw one Species' map in another's
// colours.
test("paletteOf falls back to the reference for a Species this build does not draw", () => {
  const FIXTURE: readonly SpeciesDef[] = [
    {
      ...SPECIES.find((one) => one.id === REFERENCE)!,
      palette: ["#111111", "#222222", "#333333", "#444444", "#555555"],
    },
  ];
  assert.deepEqual(paletteOf("no-such-species", FIXTURE), paletteOf(REFERENCE, FIXTURE));
  assert.deepEqual(paletteOf("__proto__", FIXTURE), paletteOf(REFERENCE, FIXTURE));
  assert.deepEqual(paletteOf("constructor", FIXTURE), paletteOf(REFERENCE, FIXTURE));
});

test("paletteOf throws when neither the requested Species nor the reference has a Palette", () => {
  // palette is required on SpeciesDef now; this simulates a malformed table (a bad cast, bad
  // data on disk) to prove paletteOf's defensive throw still fires instead of reading undefined.
  const EMPTY_FIXTURE = [{ ...SPECIES.find((one) => one.id === REFERENCE)!, palette: undefined }] as unknown as readonly SpeciesDef[];
  assert.throws(() => paletteOf("no-such-species", EMPTY_FIXTURE), /no Palette on the reference Species/);
});

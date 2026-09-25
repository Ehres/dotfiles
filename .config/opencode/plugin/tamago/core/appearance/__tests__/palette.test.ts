import { test } from "node:test";
import assert from "node:assert/strict";
import { EGG_PALETTE, PALETTE_MAX } from "../palette.ts";
import { SPECIES } from "../../creature/catalog.ts";

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
    assert.notStrictEqual(one.palette, EGG_PALETTE, one.id);
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { MAP_ROLES, PAINTED_ROLES, SKIN_ROLES, type Skin } from "../palette.ts";
import { REFERENCE, SPECIES } from "../../creature/catalog.ts";
import { paletteOf } from "../../creature/catalog.ts";
import type { SpeciesDef } from "../../creature/species.ts";

const HEX = /^#[0-9a-f]{6}$/;

test("the Role partition is complete and correct: MAP, PAINTED, and SKIN lists", () => {
  assert.deepEqual([...MAP_ROLES], ["outline", "primary", "secondary", "accent"]);
  assert.deepEqual([...PAINTED_ROLES], ["eye", "mark", "badge", "heart"]);
  assert.deepEqual([...SKIN_ROLES], ["outline", "primary", "secondary", "accent", "eye"]);
});

test("Skin's keys agree with SKIN_ROLES at runtime", () => {
  const skin: Skin = {
    outline: "#111111",
    primary: "#222222",
    secondary: "#333333",
    accent: "#444444",
    eye: "#555555",
  };
  const keysFromType = Object.keys(skin).sort();
  const rolesFromArray = [...SKIN_ROLES].sort();
  assert.deepEqual(keysFromType, rolesFromArray);
});

test("every Species that declares Palettes covers every Skin Role in both variants, in lowercase hex", () => {
  for (const one of SPECIES) {
    if (one.palettes === undefined) continue;
    for (const variant of ["dark", "light"] as const) {
      const skin: Skin = one.palettes[variant];
      for (const role of SKIN_ROLES) {
        assert.match(skin[role] ?? "", HEX, `${one.id}/${variant}/${role}`);
      }
    }
  }
});

test("paletteOf falls back to the reference for a Species this build does not draw", () => {
  const FIXTURE: readonly SpeciesDef[] = [
    {
      ...SPECIES.find((one) => one.id === REFERENCE)!,
      palettes: {
        dark: {
          outline: "#111111",
          primary: "#222222",
          secondary: "#333333",
          accent: "#444444",
          eye: "#555555",
        },
        light: {
          outline: "#aaaaaa",
          primary: "#bbbbbb",
          secondary: "#cccccc",
          accent: "#dddddd",
          eye: "#eeeeee",
        },
      },
    },
  ];
  assert.deepEqual(paletteOf("no-such-species", "dark", FIXTURE), paletteOf(REFERENCE, "dark", FIXTURE));
  assert.deepEqual(paletteOf("__proto__", "dark", FIXTURE), paletteOf(REFERENCE, "dark", FIXTURE));
  assert.deepEqual(paletteOf("constructor", "light", FIXTURE), paletteOf(REFERENCE, "light", FIXTURE));
});

test("the two variants of a Species differ: a light theme is not the dark one", () => {
  const FIXTURE: readonly SpeciesDef[] = [
    {
      ...SPECIES.find((one) => one.id === REFERENCE)!,
      palettes: {
        dark: {
          outline: "#111111",
          primary: "#222222",
          secondary: "#333333",
          accent: "#444444",
          eye: "#555555",
        },
        light: {
          outline: "#aaaaaa",
          primary: "#bbbbbb",
          secondary: "#cccccc",
          accent: "#dddddd",
          eye: "#eeeeee",
        },
      },
    },
  ];
  assert.notDeepEqual(paletteOf(REFERENCE, "dark", FIXTURE), paletteOf(REFERENCE, "light", FIXTURE));
});

test("paletteOf throws when neither the requested Species nor the reference has Palettes", () => {
  const EMPTY_FIXTURE: readonly SpeciesDef[] = [
    SPECIES.find((one) => one.id === REFERENCE)!,
  ];
  assert.throws(
    () => paletteOf("no-such-species", "dark", EMPTY_FIXTURE),
    /no Palettes on the reference Species/,
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { expressionOf, idOf, petIdOf, type Expressions } from "../expressions.ts";

const open = [[{ at: "left_eye", pixels: ["4"] }]];
const shut = [[{ at: "left_eye", pixels: ["."] }]];
const minimal: Expressions = { open, shut };

test("idle asks for open; every other Activity asks for its own name", () => {
  assert.equal(idOf("idle"), "open");
  assert.equal(idOf("sleeping"), "sleeping");
  assert.equal(petIdOf("dreamy"), "pet:dreamy");
});

test("a Species that gave only open and shut falls back to open for everything else", () => {
  assert.equal(expressionOf(minimal, "hurt"), open);
  assert.equal(expressionOf(minimal, "pet:stoic"), open);
  assert.equal(expressionOf(minimal, "shut"), shut);
});

test("a declared Expression wins over the fallback", () => {
  const hurt = [[{ at: "left_eye", pixels: ["0"] }]];
  assert.equal(expressionOf({ ...minimal, hurt }, "hurt"), hurt);
});

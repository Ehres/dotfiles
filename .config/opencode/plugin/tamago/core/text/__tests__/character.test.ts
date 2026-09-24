import { test } from "node:test";
import assert from "node:assert/strict";
import { describe } from "../character.ts";

test("the character reads as the Temperament alone before young", () => {
  assert.equal(describe({ temperament: "stoic" }, "en"), "stoic");
  assert.equal(describe({ temperament: "stoic" }, "fr"), "stoïque");
});

test("the Stance agrees with the Craft in French", () => {
  const character = { temperament: "sarcastic", vocation: { craft: "shell", stance: "prudent" } } as const;
  assert.equal(describe(character, "en"), "sarcastic · prudent shell");
  assert.equal(describe(character, "fr"), "sarcastique · mécano prudent");
});

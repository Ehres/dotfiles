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

test("the Stance agrees with each Craft's own gender in French, for every Craft", () => {
  assert.equal(describe({ temperament: "stoic", vocation: { craft: "scribe", stance: "bold" } }, "fr"), "stoïque · scribe audacieux");
  assert.equal(describe({ temperament: "stoic", vocation: { craft: "shell", stance: "bold" } }, "fr"), "stoïque · mécano audacieux");
  assert.equal(describe({ temperament: "stoic", vocation: { craft: "sage", stance: "bold" } }, "fr"), "stoïque · érudit audacieux");
});

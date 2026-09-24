import { test } from "node:test";
import assert from "node:assert/strict";
import { word, type Word } from "../word.ts";

const COMMON: Word = { en: "common", fr: { m: "commun", f: "commune" } };
const RARE: Word = { en: "rare", fr: { m: "rare", f: "rare" } };

test("English agrees with nothing", () => {
  assert.equal(word(COMMON, "en", "m"), "common");
  assert.equal(word(COMMON, "en", "f"), "common");
});

test("French agrees in gender", () => {
  assert.equal(word(COMMON, "fr", "m"), "commun");
  assert.equal(word(COMMON, "fr", "f"), "commune");
});

test("an invariable French word is still written twice, so no caller has to know which are", () => {
  assert.equal(word(RARE, "fr", "m"), "rare");
  assert.equal(word(RARE, "fr", "f"), "rare");
});

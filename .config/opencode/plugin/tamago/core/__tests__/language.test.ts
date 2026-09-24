import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LANGUAGE, isLanguage, resolveLanguage, say } from "../language.ts";

test("the stored choice wins over the plugin option", () => {
  assert.equal(resolveLanguage("fr", "en"), "fr");
  assert.equal(resolveLanguage("en", "fr"), "en");
});

test("the plugin option is the default until the user has chosen", () => {
  assert.equal(resolveLanguage(undefined, "fr"), "fr");
  assert.equal(resolveLanguage(null, "fr"), "fr");
});

test("an unknown value falls through to the next layer, never throws", () => {
  assert.equal(resolveLanguage("kl", "fr"), "fr", "an unknown stored value falls to the option");
  assert.equal(resolveLanguage("kl", "kl"), DEFAULT_LANGUAGE, "two unknown values fall to English");
  assert.equal(resolveLanguage(42, { any: "shape" }), DEFAULT_LANGUAGE);
  assert.equal(resolveLanguage(undefined, undefined), DEFAULT_LANGUAGE);
});

test("isLanguage narrows only the two Languages", () => {
  assert.equal(isLanguage("fr"), true);
  assert.equal(isLanguage("FR"), false, "no case folding: the value is written by us, not typed by a user");
  assert.equal(isLanguage(""), false);
});

test("say reads the Phrase in the given Language", () => {
  assert.equal(say({ en: "Purr.", fr: "Rrron." }, "fr"), "Rrron.");
  assert.equal(say({ en: "Purr.", fr: "Rrron." }, "en"), "Purr.");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { bar, fmt } from "../format.ts";

test("fmt groups thousands with commas", () => {
  assert.equal(fmt(0, "en"), "0");
  assert.equal(fmt(1840, "en"), "1,840");
  assert.equal(fmt(20000, "en"), "20,000");
});

test("thousands are grouped with a comma in English and a plain space in French", () => {
  assert.equal(fmt(2147, "en"), "2,147");
  assert.equal(fmt(2147, "fr"), "2 147");
  assert.equal(fmt(41467, "fr"), "41 467");
  assert.equal(fmt(0, "fr"), "0");
  assert.equal(fmt(2147, "fr").includes(" "), false, "a plain U+0020, so ICU data cannot move it under us");
});

test("bar fills proportionally and clamps to [0, 1]", () => {
  assert.equal(bar(0, 10), "[----------]");
  assert.equal(bar(0.5, 10), "[#####-----]");
  assert.equal(bar(1, 10), "[##########]");
  assert.equal(bar(2, 4), "[####]");
  assert.equal(bar(-1, 4), "[----]");
});

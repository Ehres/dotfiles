import { test } from "node:test";
import assert from "node:assert/strict";
import { bar, fmt } from "./format.ts";

test("fmt groups thousands with commas", () => {
  assert.equal(fmt(0), "0");
  assert.equal(fmt(1840), "1,840");
  assert.equal(fmt(20000), "20,000");
});

test("bar fills proportionally and clamps to [0, 1]", () => {
  assert.equal(bar(0, 10), "[----------]");
  assert.equal(bar(0.5, 10), "[#####-----]");
  assert.equal(bar(1, 10), "[##########]");
  assert.equal(bar(2, 4), "[####]");
  assert.equal(bar(-1, 4), "[----]");
});

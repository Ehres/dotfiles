import { test } from "node:test";
import assert from "node:assert/strict";
import { NAME_MAX, cleanName, latest } from "../name.ts";

test("cleanName trims, drops empty input and cuts at NAME_MAX", () => {
  assert.equal(cleanName("  Pixel "), "Pixel");
  assert.equal(cleanName("   "), undefined);
  assert.equal(cleanName(""), undefined);
  assert.equal(cleanName("a".repeat(NAME_MAX + 5)), "a".repeat(NAME_MAX));
});

test("latest keeps the most recent rename, and the greater value on a tie", () => {
  const old = { value: "Pixel", at: 1 };
  const recent = { value: "Mochi", at: 2 };
  assert.equal(latest(old, recent), recent);
  assert.equal(latest(recent, old), recent);
  assert.equal(latest(undefined, old), old);
  assert.equal(latest(old, undefined), old);
  assert.equal(latest(undefined, undefined), undefined);
  assert.equal(latest({ value: "A", at: 5 }, { value: "B", at: 5 })?.value, "B");
  assert.equal(latest({ value: "B", at: 5 }, { value: "A", at: 5 })?.value, "B");
});

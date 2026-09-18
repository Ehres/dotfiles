import { test } from "node:test";
import assert from "node:assert/strict";
import { WARN_AFTER, backoff } from "../retry.ts";

test("no failure keeps the base delay", () => {
  assert.equal(backoff(0, 2_000, 60_000), 2_000);
});

test("each consecutive failure doubles the delay", () => {
  assert.equal(backoff(1, 2_000, 60_000), 4_000);
  assert.equal(backoff(2, 2_000, 60_000), 8_000);
  assert.equal(backoff(3, 2_000, 60_000), 16_000);
});

test("the delay never exceeds the cap", () => {
  assert.equal(backoff(10, 2_000, 60_000), 60_000);
  assert.equal(backoff(1_000, 2_000, 60_000), 60_000);
});

test("the user is warned after a small number of consecutive failures", () => {
  assert.equal(WARN_AFTER, 3);
});

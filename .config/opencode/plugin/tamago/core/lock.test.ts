import { test } from "node:test";
import assert from "node:assert/strict";
import { LOCK_STALE_MS, decideLock } from "./lock.ts";

test("a free lock is acquired", () => {
  assert.equal(decideLock({ held: false, now: 1000 }), "acquire");
});

test("a fresh lock makes us wait", () => {
  assert.equal(decideLock({ held: true, heldSinceMs: 1000, now: 1000 + LOCK_STALE_MS - 1 }), "wait");
});

test("a lock older than LOCK_STALE_MS is stolen", () => {
  assert.equal(decideLock({ held: true, heldSinceMs: 1000, now: 1000 + LOCK_STALE_MS }), "steal");
});

test("a held lock with unknown age makes us wait", () => {
  assert.equal(decideLock({ held: true, now: 5000 }), "wait");
});

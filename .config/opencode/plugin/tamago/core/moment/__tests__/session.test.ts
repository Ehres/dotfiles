import { test } from "node:test";
import assert from "node:assert/strict";
import { initialSession } from "../session.ts";

test("initialSession starts idle and not busy", () => {
  assert.deepEqual(initialSession(42), { activity: "idle", since: 42, busy: false });
});

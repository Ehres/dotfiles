import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVITIES } from "../../moment/session.ts";
import { MOOD } from "../mood.ts";

test("every Activity has a Mood, short enough for the sidebar caption", () => {
  for (const activity of ACTIVITIES) {
    assert.ok(MOOD[activity].length > 0);
    assert.ok(MOOD[activity].length <= 12, `${activity}: ${MOOD[activity]}`);
  }
});

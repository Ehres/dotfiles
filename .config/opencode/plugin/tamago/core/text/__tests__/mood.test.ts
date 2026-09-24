import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVITIES } from "../../moment/session.ts";
import { MOOD, mood } from "../mood.ts";

test("every Activity has a Mood, short enough for the sidebar caption", () => {
  for (const activity of ACTIVITIES) {
    assert.ok(MOOD[activity].length > 0);
    assert.ok(MOOD[activity].length <= 12, `${activity}: ${MOOD[activity]}`);
  }
});

test("mood reads English by default and every Activity in both languages", () => {
  for (const activity of ACTIVITIES) {
    assert.equal(mood(activity), MOOD[activity]);
    assert.equal(mood(activity, "en"), MOOD[activity]);
    assert.ok(mood(activity, "fr").length > 0, activity);
  }
  assert.equal(mood("idle", "fr"), "tranquille");
  assert.equal(mood("thinking", "fr"), "réfléchit...");
  assert.equal(mood("working", "fr"), "travaille");
  assert.equal(mood("waiting", "fr"), "t'attend");
  assert.equal(mood("hurt", "fr"), "aïe");
  assert.equal(mood("sleeping", "fr"), "zzz");
});

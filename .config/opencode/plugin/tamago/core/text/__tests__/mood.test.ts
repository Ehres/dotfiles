import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVITIES } from "../../moment/session.ts";
import { mood } from "../mood.ts";

test("every Activity has a Mood, short enough for the sidebar caption, in both languages", () => {
  for (const activity of ACTIVITIES) {
    assert.ok(mood(activity, "en").length > 0);
    assert.ok(mood(activity, "en").length <= 12, `${activity}: ${mood(activity, "en")}`);
    assert.ok(mood(activity, "fr").length > 0, activity);
  }
  assert.equal(mood("idle", "fr"), "tranquille");
  assert.equal(mood("thinking", "fr"), "réfléchit...");
  assert.equal(mood("working", "fr"), "travaille");
  assert.equal(mood("waiting", "fr"), "t'attend");
  assert.equal(mood("hurt", "fr"), "aïe");
  assert.equal(mood("sleeping", "fr"), "zzz");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVITIES } from "../../moment/session.ts";
import { say } from "../../language.ts";
import { MOOD_TEXT } from "../mood.ts";

test("every Activity has a Mood, short enough for the sidebar caption, in both languages", () => {
  for (const activity of ACTIVITIES) {
    for (const language of ["en", "fr"] as const) {
      const written = say(MOOD_TEXT[activity], language);
      assert.ok(written.length > 0, `${activity}/${language}`);
      assert.ok(written.length <= 12, `${activity}/${language}: ${written}`);
    }
  }
  assert.equal(say(MOOD_TEXT.idle, "fr"), "tranquille");
  assert.equal(say(MOOD_TEXT.thinking, "fr"), "réfléchit...");
  assert.equal(say(MOOD_TEXT.working, "fr"), "travaille");
  assert.equal(say(MOOD_TEXT.waiting, "fr"), "t'attend");
  assert.equal(say(MOOD_TEXT.hurt, "fr"), "aïe");
  assert.equal(say(MOOD_TEXT.sleeping, "fr"), "zzz");
});

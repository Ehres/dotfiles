import { test } from "node:test";
import assert from "node:assert/strict";
import { MARK, markOf } from "../marks.ts";
import { frameAt, heartFrame } from "../sprites.ts";

test("every shipped Trait has a one-column mark", () => {
  for (const [id, mark] of Object.entries(MARK)) assert.equal(mark.length, 1, `${id} is not one column`);
});

test("the mark shown is the most recent Pick's; none without a held Trait", () => {
  assert.equal(markOf([]), undefined);
  assert.equal(markOf(["hardy"]), MARK.hardy);
  assert.equal(markOf(["hardy", "proud"]), MARK.proud);
  assert.equal(markOf(["hardy", "nonesuch"]), MARK.hardy); // an unknown Trait is ignored, never an error
});

test("the mark is overlaid on the top-left cell and nothing else moves", () => {
  const bare = frameAt("cat", "adult", "idle", 0);
  const marked = frameAt("cat", "adult", "idle", 0, "+");
  assert.equal(marked[0], `+${(bare[0] ?? "").slice(1)}`);
  assert.deepEqual(marked.slice(1), bare.slice(1));
  assert.equal(marked.length, bare.length);
});

test("a marked Frame is cached, so the same call gives the same reference", () => {
  assert.equal(frameAt("cat", "adult", "idle", 0, "+"), frameAt("cat", "adult", "idle", 0, "+"));
  assert.equal(heartFrame("cat", "adult", "cheerful", "+"), heartFrame("cat", "adult", "cheerful", "+"));
});

test("the heart and the mark live in different cells", () => {
  const petted = heartFrame("cat", "adult", "cheerful", "+");
  assert.equal((petted[0] ?? "")[0], "+");
  assert.ok((petted[0] ?? "").includes("♥"));
});

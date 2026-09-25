import { test } from "node:test";
import assert from "node:assert/strict";
import { BADGE, BADGE_SLOT, MARK, MARK_SLOT, markOf } from "../marks.ts";

test("every Trait has a 3 x 3 pattern, and so does the badge", () => {
  for (const [id, pattern] of Object.entries(MARK)) {
    assert.equal(pattern.length, MARK_SLOT.h, id);
    for (const row of pattern) assert.equal(row.length, MARK_SLOT.w, id);
    assert.ok(pattern.some((row) => row.includes("#")), `${id} draws nothing`);
  }
  assert.equal(BADGE.length, BADGE_SLOT.h);
  for (const row of BADGE) assert.equal(row.length, BADGE_SLOT.w);
});

test("no two Traits draw the same pattern", () => {
  const seen = new Set(Object.values(MARK).map((pattern) => pattern.join("/")));
  assert.equal(seen.size, Object.keys(MARK).length);
});

test("the two slots are 3 x 3, in opposite top corners, and do not overlap", () => {
  assert.deepEqual(MARK_SLOT, { x: 0, y: 0, w: 3, h: 3 });
  assert.deepEqual(BADGE_SLOT, { x: 18, y: 0, w: 3, h: 3 });
  assert.ok(MARK_SLOT.x + MARK_SLOT.w <= BADGE_SLOT.x, "the slots overlap");
});

test("markOf returns the most recent Pick that has a mark, as a TraitId", () => {
  assert.equal(markOf([]), undefined);
  assert.equal(markOf(["hardy", "proud"]), "proud");
  assert.equal(markOf(["proud", "hardy"]), "hardy");
});

test("a Trait id that names an Object.prototype member has no mark, rather than a phantom one", () => {
  for (const id of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"]) {
    assert.equal(markOf([id]), undefined, id);
    assert.equal(markOf(["hardy", id]), "hardy", `${id} must not mask a real earlier Pick`);
  }
});

test("the badge differs from every pattern in MARK", () => {
  const badgeStr = BADGE.join("/");
  for (const [id, pattern] of Object.entries(MARK)) {
    const patternStr = pattern.join("/");
    assert.notEqual(badgeStr, patternStr, `BADGE is identical to MARK.${id}`);
  }
});

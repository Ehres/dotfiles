import assert from "node:assert/strict";
import { test } from "node:test";
import { reviewSplitArgs, rexAnchor } from "./rex.ts";

test("the review needs both Rex IDs so it cannot split an unrelated pane", () => {
  assert.equal(rexAnchor({ REX_SESSION: "session:mine" }), null);
  assert.equal(rexAnchor({ REX_BLOCK: "block:mine" }), null);
  assert.deepEqual(rexAnchor({ REX_SESSION: "session:mine", REX_BLOCK: "block:mine" }), {
    session: "session:mine", block: "block:mine",
  });
});

test("Rex waits for a focused 60-percent right split and preserves command arguments", () => {
  const root = "/a worktree";
  const path = "a file's $(literal).md";
  assert.deepEqual(
    reviewSplitArgs(root, { session: "session:mine", block: "block:mine" }, ["--file", path]),
    [
      "split", "-s", "session:mine", "-b", "block:mine", "--split=right", "--ratio", "60",
      "--label", "open-review", "-c", root, "--wait", "--", "tuicr", "--file", path,
    ],
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSessionList, readComments } from "./tuicr.ts";

// Verbatim shape of `tuicr review list --all`, trimmed to the fields used.
const SAMPLE = `[
  {
    "slug": "Ehres/dotfiles@master/staged-and-unstaged/5084c62",
    "kind": "local",
    "path": "/sessions/db89.json",
    "updated_at": "2026-08-05T14:02:21.603027+00:00",
    "comment_count": 1,
    "reviewed_count": 0,
    "file_count": 6,
    "anchor": "master",
    "active": false
  }
]`;

test("the session list is parsed into rows", () => {
  const rows = parseSessionList(SAMPLE);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.path, "/sessions/db89.json");
  assert.equal(rows[0]?.comment_count, 1);
});

test("unparseable output yields no rows rather than throwing", () => {
  assert.deepEqual(parseSessionList(""), []);
  assert.deepEqual(parseSessionList("tuicr: something went wrong"), []);
  assert.deepEqual(parseSessionList("{}"), []);
});

// Defect: a failed read-back must not read as "no comments" — that silently
// discards a review the human actually wrote. A nonexistent session path
// makes the real tuicr binary exit non-zero, which is a safe, read-only way
// to exercise this without touching tmux or a TUI.
test("a session that fails to read back reports failure, not emptiness", () => {
  assert.equal(readComments("/nonexistent/session-does-not-exist.json"), null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { electSession, renderCommentIndex } from "./session.ts";
import type { Comment, SessionRow } from "./types.ts";

function row(over: Partial<SessionRow> = {}): SessionRow {
  return {
    slug: "o/r@feature/staged-and-unstaged/abc1234",
    kind: "local",
    path: "/sessions/one.json",
    updated_at: "2026-08-07T10:00:00.000Z",
    comment_count: 0,
    ...over,
  };
}

test("a session that did not exist before is the one", () => {
  const before = [row({ path: "/sessions/old.json" })];
  const fresh = row({ path: "/sessions/new.json", comment_count: 2 });
  assert.equal(electSession(before, [...before, fresh])?.path, "/sessions/new.json");
});

test("a session whose updated_at moved is the one", () => {
  const before = [row({ path: "/sessions/a.json" }), row({ path: "/sessions/b.json" })];
  const after = [
    row({ path: "/sessions/a.json" }),
    row({ path: "/sessions/b.json", updated_at: "2026-08-07T11:00:00.000Z", comment_count: 1 }),
  ];
  assert.equal(electSession(before, after)?.path, "/sessions/b.json");
});

test("with several moved, the most recently updated wins", () => {
  const before = [row({ path: "/a.json" }), row({ path: "/b.json" })];
  const after = [
    row({ path: "/a.json", updated_at: "2026-08-07T11:00:00.000Z" }),
    row({ path: "/b.json", updated_at: "2026-08-07T12:00:00.000Z" }),
  ];
  assert.equal(electSession(before, after)?.path, "/b.json");
});

// tuicr writes its session file at startup, so "nothing moved" means the popup
// never got that far — not that the user saved nothing.
test("nothing moved yields null", () => {
  const same = [row()];
  assert.equal(electSession(same, same), null);
  assert.equal(electSession([], []), null);
});

test("a session that vanished is not elected", () => {
  const before = [row({ path: "/gone.json" })];
  assert.equal(electSession(before, []), null);
});

test("the index gives one scannable line per comment", () => {
  const comments: Comment[] = [
    {
      location: "line",
      path: "src/main.ts",
      start_line: 42,
      end_line: 42,
      side: "new",
      comment_type: "none",
      content: "this branch is unreachable",
    },
    {
      location: "range",
      path: "src/base.ts",
      start_line: 10,
      end_line: 14,
      side: "old",
      comment_type: "none",
      content: "was this deliberate?",
    },
    {
      location: "file",
      path: "src/plan.ts",
      start_line: null,
      end_line: null,
      side: "new",
      comment_type: "none",
      content: "whole-file remark",
    },
    {
      location: "review",
      path: null,
      start_line: null,
      end_line: null,
      side: "new",
      comment_type: "none",
      content: "overall this reads well",
    },
  ];
  assert.equal(
    renderCommentIndex(comments),
    [
      "src/main.ts:42 — this branch is unreachable",
      "src/base.ts:10-14 (old side) — was this deliberate?",
      "src/plan.ts — whole-file remark",
      "(review) — overall this reads well",
    ].join("\n"),
  );
});

test("the index truncates long comments and flattens newlines", () => {
  const long = "x".repeat(200);
  const line = renderCommentIndex([
    {
      location: "line",
      path: "a.ts",
      start_line: 1,
      end_line: 1,
      side: "new",
      comment_type: "none",
      content: `first\nsecond ${long}`,
    },
  ]);
  assert.match(line, /^a\.ts:1 — first second x+…$/);
  assert.ok(line.length < 110);
});

test("no comments renders an explicit line", () => {
  assert.equal(renderCommentIndex([]), "(no comments)");
});

test("the real format: tuicr's microsecond precision with numeric offset", () => {
  const before = [
    row({
      path: "/sessions/a.json",
      updated_at: "2026-08-05T14:02:21.603027+00:00",
    }),
    row({
      path: "/sessions/b.json",
      updated_at: "2026-08-05T14:02:21.000000+00:00",
    }),
  ];
  const after = [
    row({
      path: "/sessions/a.json",
      updated_at: "2026-08-05T14:02:21.603027+00:00",
    }),
    row({
      path: "/sessions/b.json",
      updated_at: "2026-08-05T14:02:22.100000+00:00",
    }),
  ];
  assert.equal(electSession(before, after)?.path, "/sessions/b.json");
});

test("sub-millisecond difference: same millisecond, different microseconds", () => {
  const before = [
    row({
      path: "/sessions/a.json",
      updated_at: "2026-08-05T14:02:21.603027+00:00",
    }),
    row({
      path: "/sessions/b.json",
      updated_at: "2026-08-05T14:02:21.600000+00:00",
    }),
  ];
  const after = [
    row({
      path: "/sessions/a.json",
      updated_at: "2026-08-05T14:02:21.603027+00:00",
    }),
    row({
      path: "/sessions/b.json",
      updated_at: "2026-08-05T14:02:21.603999+00:00",
    }),
  ];
  assert.equal(electSession(before, after)?.path, "/sessions/b.json");
});

test("identical timestamps: elected row is independent of array order", () => {
  const before = [
    row({
      path: "/sessions/a.json",
      updated_at: "2026-08-05T14:02:21.603027+00:00",
    }),
    row({
      path: "/sessions/b.json",
      updated_at: "2026-08-05T14:02:21.000000+00:00",
    }),
  ];
  const after1 = [
    row({
      path: "/sessions/a.json",
      updated_at: "2026-08-05T14:02:22.100000+00:00",
    }),
    row({
      path: "/sessions/b.json",
      updated_at: "2026-08-05T14:02:22.100000+00:00",
    }),
  ];
  const after2 = [
    row({
      path: "/sessions/b.json",
      updated_at: "2026-08-05T14:02:22.100000+00:00",
    }),
    row({
      path: "/sessions/a.json",
      updated_at: "2026-08-05T14:02:22.100000+00:00",
    }),
  ];

  const elected1 = electSession(before, after1)?.path;
  const elected2 = electSession(before, after2)?.path;
  assert.equal(elected1, elected2);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPlan } from "./plan.ts";
import type { PlanInput } from "./types.ts";

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    target: {
      description: "the branch's commits plus the working tree",
      tuicrArgs: ["-r", "fork00..HEAD", "-w", "--no-update-check"],
      stat: { kind: "diff", args: ["fork00"] },
      notes: [],
      emptyReason: null,
    },
    facts: {
      root: "/repo",
      gitDir: "/repo/.git",
      commonDir: "/repo/.git",
      branch: "feature",
      head: "head00",
      work: { staged: 3, unstaged: 2, untracked: ["new.ts"], dirty: true },
      refs: { reflogName: null, candidates: [] },
    },
    base: { ref: "origin/master", how: "created-from reflog", mergeBase: "fork00", commits: 7 },
    shortstat: "12 files changed, 340 insertions(+), 88 deletions(-)",
    churn: [
      { path: "src/main.ts", changed: 128 },
      { path: "src/base.ts", changed: 64 },
    ],
    untracked: [{ path: "new.ts", lines: 41 }],
    ...over,
  };
}

test("the plan carries every field, in order", () => {
  const lines = renderPlan(input()).split("\n");
  assert.equal(lines[0], "mode: the branch's commits plus the working tree");
  assert.equal(lines[1], "base: origin/master (created-from reflog) frozen at fork00");
  assert.equal(lines[2], "commits: 7    working tree: dirty (3 staged, 2 unstaged, 1 untracked)");
  assert.equal(lines[3], "tuicr: -r fork00..HEAD -w --no-update-check");
  assert.equal(lines[4], "stat: 12 files changed, 340 insertions(+), 88 deletions(-)");
});

test("untracked files are listed with their line counts", () => {
  const text = renderPlan(input());
  assert.match(text, /untracked \(not in the stat above\):\n\s+41\s+new\.ts/);
});

test("churn is listed after the stat", () => {
  const text = renderPlan(input());
  assert.match(text, /churn \(added\+deleted, top 10\):\n\s+128\s+src\/main\.ts\n\s+64\s+src\/base\.ts/);
});

test("a clean tree says so and lists nothing", () => {
  const base = input();
  const text = renderPlan({
    ...base,
    facts: { ...base.facts, work: { staged: 0, unstaged: 0, untracked: [], dirty: false } },
    untracked: [],
  });
  assert.match(text, /working tree: clean/);
  assert.doesNotMatch(text, /untracked/);
});

test("no base means no base line", () => {
  const text = renderPlan(input({ base: null }));
  assert.doesNotMatch(text, /^base:/m);
  assert.doesNotMatch(text, /^commits:/m);
  assert.match(text, /working tree:/);
});

test("notes are printed, one per line", () => {
  const base = input();
  const text = renderPlan({
    ...base,
    target: { ...base.target, notes: ["no previous review recorded", "so here is everything"] },
  });
  assert.match(text, /note: no previous review recorded\nnote: so here is everything/);
});

test("a pass-through target says why there is no stat", () => {
  const base = input();
  const text = renderPlan({
    ...base,
    target: {
      description: "pull request 123",
      tuicrArgs: ["pr", "123", "--no-update-check"],
      stat: { kind: "none", reason: "pass-through, no local stat" },
      notes: [],
      emptyReason: null,
    },
    shortstat: null,
    churn: [],
    untracked: [],
  });
  assert.match(text, /stat: pass-through, no local stat/);
  assert.doesNotMatch(text, /churn/);
});

test("a file target reports the file and its length", () => {
  const base = input();
  const text = renderPlan({
    ...base,
    target: {
      description: "the file docs/plan.md",
      tuicrArgs: ["--file", "docs/plan.md", "--no-update-check"],
      stat: { kind: "file", path: "docs/plan.md" },
      notes: [],
      emptyReason: null,
    },
    shortstat: null,
    churn: [],
    untracked: [{ path: "docs/plan.md", lines: 212 }],
  });
  assert.match(text, /file: docs\/plan\.md \(212 lines\)/);
});

test("an empty stat is reported rather than left blank", () => {
  const text = renderPlan(input({ shortstat: "" }));
  assert.match(text, /stat: no textual changes/);
});

test("churn is capped at ten rows", () => {
  const many = Array.from({ length: 15 }, (_, i) => ({ path: `f${i}.ts`, changed: 100 - i }));
  const text = renderPlan(input({ churn: many }));
  const rows = text.split("\n").filter((line) => /^\s+\d+\s+f\d+\.ts$/.test(line));
  assert.equal(rows.length, 10);
});

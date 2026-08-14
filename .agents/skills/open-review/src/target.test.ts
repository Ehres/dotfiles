import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrTarget, buildTarget } from "./target.ts";
import { parseArgs } from "./args.ts";
import type { BaseChoice, RepoFacts, TargetInput } from "./types.ts";

const BASE: BaseChoice = {
  ref: "origin/master",
  how: "created-from reflog",
  mergeBase: "fork00",
  commits: 3,
};

function facts(over: Partial<RepoFacts> = {}): RepoFacts {
  return {
    root: "/repo",
    gitDir: "/repo/.git",
    commonDir: "/repo/.git",
    branch: "feature",
    head: "head00",
    work: { staged: 0, unstaged: 0, untracked: [], dirty: false },
    refs: { reflogName: null, candidates: [] },
    ...over,
  };
}

function dirty(): RepoFacts {
  return facts({ work: { staged: 1, unstaged: 0, untracked: [], dirty: true } });
}

function input(over: Partial<TargetInput> = {}): TargetInput {
  return {
    intent: parseArgs([]),
    facts: facts(),
    base: BASE,
    lastReviewed: null,
    ...over,
  };
}

test("auto with commits and a dirty tree reviews both, and stats to the worktree", () => {
  const target = buildTarget(input({ facts: dirty() }));
  assert.deepEqual(target.tuicrArgs, ["-r", "fork00..HEAD", "-w", "--no-update-check"]);
  assert.deepEqual(target.stat, { kind: "diff", args: ["fork00"] });
  assert.equal(target.emptyReason, null);
});

test("auto with commits and a clean tree stats between two commits", () => {
  const target = buildTarget(input());
  assert.deepEqual(target.tuicrArgs, ["-r", "fork00..HEAD", "--no-update-check"]);
  assert.deepEqual(target.stat, { kind: "diff", args: ["fork00", "HEAD"] });
});

test("auto with no commits and a dirty tree reviews the working tree", () => {
  const target = buildTarget(
    input({ facts: dirty(), base: { ...BASE, commits: 0 } }),
  );
  assert.deepEqual(target.tuicrArgs, ["-w", "--no-update-check"]);
  assert.deepEqual(target.stat, { kind: "diff", args: ["HEAD"] });
});

test("auto with nothing at all is empty and names the base", () => {
  const target = buildTarget(input({ base: { ...BASE, commits: 0 } }));
  assert.match(target.emptyReason ?? "", /clean.*origin\/master/);
});

test("auto with no base but a dirty tree falls back to the working tree, with a note", () => {
  const target = buildTarget(input({ facts: dirty(), base: null }));
  assert.deepEqual(target.tuicrArgs, ["-w", "--no-update-check"]);
  assert.match(target.notes.join(" "), /no base/i);
});

test("an unborn HEAD reviews the working tree", () => {
  const target = buildTarget(
    input({
      base: null,
      facts: facts({
        head: null,
        work: { staged: 0, unstaged: 0, untracked: ["a.txt"], dirty: true },
      }),
    }),
  );
  assert.deepEqual(target.tuicrArgs, ["-w", "--no-update-check"]);
});

// Defect 9: a detached HEAD parked on an upstream commit has no commits of its
// own, but base resolution still found a real ancestor branch far behind it and
// put every commit since into the review.
function containedInMain(over: Partial<RepoFacts> = {}): RepoFacts {
  return facts({
    branch: null,
    refs: {
      reflogName: null,
      candidates: [
        // origin/main holds HEAD plus 108 commits more, so it is no ancestor of it.
        { ref: "origin/main", sha: "main99", mergeBase: "head00", distance: 0 },
        { ref: "origin/stale", sha: "fork00", mergeBase: "fork00", distance: 76 },
      ],
    },
    ...over,
  });
}

const STALE_BASE: BaseChoice = {
  ref: "origin/stale",
  how: "nearest ancestor branch",
  mergeBase: "fork00",
  commits: 76,
};

test("HEAD already contained in a branch reviews the working tree alone, with a note", () => {
  const target = buildTarget(
    input({
      facts: containedInMain({ work: { staged: 0, unstaged: 4, untracked: [], dirty: true } }),
      base: STALE_BASE,
    }),
  );
  assert.deepEqual(target.tuicrArgs, ["-w", "--no-update-check"]);
  assert.deepEqual(target.stat, { kind: "diff", args: ["HEAD"] });
  assert.match(target.notes.join(" "), /origin\/main/);
});

test("HEAD already contained in a branch, with a clean tree, is empty rather than the whole branch", () => {
  const target = buildTarget(input({ facts: containedInMain(), base: STALE_BASE }));
  assert.match(target.emptyReason ?? "", /origin\/main/);
});

// The branch's own remote copy does not count as containment: someone else
// pushing on top of your branch must not empty out your review.
test("a feature branch whose remote copy is ahead still reviews its own commits", () => {
  const target = buildTarget(
    input({
      facts: facts({
        refs: {
          reflogName: null,
          candidates: [{ ref: "origin/feature", sha: "remote9", mergeBase: "head00", distance: 0 }],
        },
      }),
    }),
  );
  assert.deepEqual(target.tuicrArgs, ["-r", "fork00..HEAD", "--no-update-check"]);
});

// Defect 1's other half: the filter must reach both tuicr and the diffstat, so
// the plan's numbers describe what the popup shows.
test("a path filter reaches tuicr and is carried in the target", () => {
  const target = buildTarget(input({ intent: parseArgs(["-p", "src/"]), facts: dirty() }));
  assert.deepEqual(target.tuicrArgs, [
    "-r",
    "fork00..HEAD",
    "-w",
    "-p",
    "src/",
    "--no-update-check",
  ]);
});

test("an explicit revset is honoured literally, three dots included", () => {
  const two = buildTarget(input({ intent: parseArgs(["-r", "main..HEAD"]) }));
  assert.deepEqual(two.tuicrArgs, ["-r", "main..HEAD", "--no-update-check"]);
  assert.deepEqual(two.stat, { kind: "diff", args: ["main..HEAD"] });

  const three = buildTarget(input({ intent: parseArgs(["-r", "main...HEAD"]) }));
  assert.deepEqual(three.stat, { kind: "diff", args: ["main...HEAD"] });
});

test("-w states that it widens past what was staged", () => {
  const target = buildTarget(input({ intent: parseArgs(["-w"]), facts: dirty() }));
  assert.deepEqual(target.tuicrArgs, ["-w", "--no-update-check"]);
  assert.deepEqual(target.stat, { kind: "diff", args: ["HEAD"] });
  assert.match(target.notes.join(" "), /staged.*unstaged.*untracked/i);
});

test("-w on a clean tree is empty", () => {
  assert.ok(buildTarget(input({ intent: parseArgs(["-w"]) })).emptyReason);
});

test("pr passes through and claims no local stat", () => {
  const target = buildTarget(input({ intent: parseArgs(["pr", "123"]) }));
  assert.deepEqual(target.tuicrArgs, ["pr", "123", "--no-update-check"]);
  assert.equal(target.stat.kind, "none");
});

// Defect 8: the old script died on "not a git repository" before it looked at
// its arguments, while `tuicr pr <url>` needs no checkout at all.
test("a pr target needs no repository facts", () => {
  const target = buildPrTarget(parseArgs(["pr", "https://github.com/o/r/pull/1"]));
  assert.deepEqual(target.tuicrArgs, [
    "pr",
    "https://github.com/o/r/pull/1",
    "--no-update-check",
  ]);
  assert.equal(target.emptyReason, null);
});

test("--file carries the path and stats the file", () => {
  const target = buildTarget(input({ intent: parseArgs(["--file", "docs/plan.md"]) }));
  assert.deepEqual(target.tuicrArgs, ["--file", "docs/plan.md", "--no-update-check"]);
  assert.deepEqual(target.stat, { kind: "file", path: "docs/plan.md" });
});

test("passthrough flags are appended", () => {
  const target = buildTarget(input({ intent: parseArgs(["--theme", "tokyonight"]) }));
  assert.deepEqual(target.tuicrArgs, [
    "-r",
    "fork00..HEAD",
    "--theme",
    "tokyonight",
    "--no-update-check",
  ]);
});

test("--since-last targets the delta and stays dirty-aware", () => {
  const target = buildTarget(
    input({
      intent: parseArgs(["--since-last"]),
      facts: dirty(),
      lastReviewed: { sha: "seen00", isAncestor: true, commits: 2 },
    }),
  );
  assert.deepEqual(target.tuicrArgs, ["-r", "seen00..HEAD", "-w", "--no-update-check"]);
  assert.deepEqual(target.stat, { kind: "diff", args: ["seen00"] });
});

test("--since-last with no record falls back to auto, out loud", () => {
  const target = buildTarget(input({ intent: parseArgs(["--since-last"]) }));
  assert.deepEqual(target.tuicrArgs, ["-r", "fork00..HEAD", "--no-update-check"]);
  assert.match(target.notes.join(" "), /no previous review/i);
});

test("--since-last after a rebase falls back to auto, out loud", () => {
  const target = buildTarget(
    input({
      intent: parseArgs(["--since-last"]),
      lastReviewed: { sha: "gone00", isAncestor: false, commits: 0 },
    }),
  );
  assert.deepEqual(target.tuicrArgs, ["-r", "fork00..HEAD", "--no-update-check"]);
  assert.match(target.notes.join(" "), /no longer an ancestor/i);
});

test("--since-last with nothing new is empty", () => {
  const target = buildTarget(
    input({ lastReviewed: { sha: "head00", isAncestor: true, commits: 0 }, intent: parseArgs(["--since-last"]) }),
  );
  assert.match(target.emptyReason ?? "", /nothing new/i);
});

test("--since-last with no new commits but a dirty tree reviews the working tree", () => {
  const target = buildTarget(
    input({
      intent: parseArgs(["--since-last"]),
      facts: dirty(),
      lastReviewed: { sha: "seen00", isAncestor: true, commits: 0 },
    }),
  );
  assert.deepEqual(target.tuicrArgs, ["-w", "--no-update-check"]);
  assert.deepEqual(target.stat, { kind: "diff", args: ["HEAD"] });
  assert.equal(target.emptyReason, null);
});

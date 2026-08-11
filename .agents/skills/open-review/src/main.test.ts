import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "./main.ts";
import { planPath, writeLastReviewed } from "./state.ts";
import { EXIT } from "./constants.ts";
import { makeRepo } from "./testrepo.ts";

// main() writes its plan to stdout, and node:test's own reporter writes to
// that same stdout between subtests. Capturing main()'s output by swapping
// process.stdout.write in-process was tried first and rejected: it collides
// with the reporter's writable-stream bookkeeping and silently drops every
// subtest that reports while the swap is active, with no failure raised —
// the suite reports fewer tests than were declared and looks green. A real
// child process keeps the two streams apart with no such hazard, and doubles
// as coverage for the file's actual CLI entry point, which the in-process
// resolve() tests above never exercise.
const mainScript = fileURLToPath(new URL("./main.ts", import.meta.url));

function runMain(argv: string[], cwd: string): { exitCode: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [mainScript, ...argv], { cwd, encoding: "utf8" });
  return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("a dirty branch resolves a plan naming both halves", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("mine.txt", "1\n2\n3\n");
    repo.commit("f1");
    repo.write("dirty.txt", "x\n");

    const { plan, target } = resolve(repo.dir, []);
    assert.match(plan, /^mode: the branch's commits plus the working tree$/m);
    assert.match(plan, /^base: master \(created-from reflog\) frozen at [0-9a-f]{40}$/m);
    assert.match(plan, /^commits: 1 {4}working tree: dirty \(0 staged, 0 unstaged, 1 untracked\)$/m);
    assert.match(plan, /^stat: 1 file changed, 3 insertions\(\+\)$/m);
    assert.match(plan, /untracked \(not in the stat above\):\n\s+1\s+dirty\.txt/);
    assert.deepEqual(target.tuicrArgs.slice(0, 1), ["-r"]);
  } finally {
    repo.cleanup();
  }
});

// Defect 2, end to end: the commit that landed on master after the fork must
// appear nowhere in the stat or the churn.
test("a base that advanced after the fork contributes nothing to the stat", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("mine.txt", "1\n2\n");
    repo.commit("f1");
    repo.run("checkout", "-q", "master");
    repo.write("theirs.txt", "1\n2\n3\n4\n5\n");
    repo.commit("c2");
    repo.run("checkout", "-q", "feature");

    const { plan } = resolve(repo.dir, []);
    assert.match(plan, /^commits: 1 {4}working tree: clean$/m);
    assert.match(plan, /^stat: 1 file changed, 2 insertions\(\+\)$/m);
    assert.doesNotMatch(plan, /theirs\.txt/);
    assert.match(plan, /churn[\s\S]*mine\.txt/);
  } finally {
    repo.cleanup();
  }
});

// Defect 3: the plan used to say nothing but the argv as soon as a target was
// named.
test("an explicitly named target still gets a stat and a churn list", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    repo.write("a.txt", "a\nb\n");

    const { plan } = resolve(repo.dir, ["-w"]);
    assert.match(plan, /^stat: 1 file changed, 1 insertion\(\+\)$/m);
    assert.match(plan, /churn \(added\+deleted, top 10\):\n\s+1\s+a\.txt/);
    assert.match(plan, /note: -w covers staged, unstaged and untracked/);
  } finally {
    repo.cleanup();
  }
});

// Defect 1, end to end: the filter must shrink the numbers, not just ride along.
test("a path filter narrows the stat as well as the argv", () => {
  const repo = makeRepo();
  try {
    repo.write("keep/a.txt", "a\n");
    repo.write("drop/b.txt", "b\n");
    repo.commit("c1");
    repo.write("keep/a.txt", "a\nkept\n");
    repo.write("drop/b.txt", "b\ndropped\n");

    const { plan, target } = resolve(repo.dir, ["-p", "keep"]);
    assert.ok(target.tuicrArgs.includes("-p"));
    assert.match(plan, /^stat: 1 file changed, 1 insertion\(\+\)$/m);
    assert.doesNotMatch(plan, /drop\/b\.txt/);
  } finally {
    repo.cleanup();
  }
});

test("a clean tree with no commits resolves to nothing to review", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    const { target } = resolve(repo.dir, []);
    assert.ok(target.emptyReason);
  } finally {
    repo.cleanup();
  }
});

test("--file reports the file's length", () => {
  const repo = makeRepo();
  try {
    repo.write("docs/plan.md", "one\ntwo\nthree\n");
    repo.commit("c1");
    const { plan } = resolve(repo.dir, ["--file", "docs/plan.md"]);
    assert.match(plan, /^file: docs\/plan\.md \(3 lines\)$/m);
  } finally {
    repo.cleanup();
  }
});

test("--since-last targets only what arrived after the recorded head", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("first.txt", "1\n");
    repo.commit("f1");
    const reviewed = repo.run("rev-parse", "HEAD");
    repo.write("second.txt", "2\n");
    repo.commit("f2");

    const facts = resolve(repo.dir, []).facts;
    writeLastReviewed(facts.commonDir, "feature", reviewed);

    const { plan, target } = resolve(repo.dir, ["--since-last"]);
    assert.ok(target.tuicrArgs.includes(`${reviewed}..HEAD`));
    assert.match(plan, /^stat: 1 file changed, 1 insertion\(\+\)$/m);
    assert.doesNotMatch(plan, /first\.txt/);
  } finally {
    repo.cleanup();
  }
});

// main()'s branch dispatch, covering only branches that return before ever
// reaching launch(): Task 9 gives launch a real body, and a test that reached
// it would try to drive tmux.

test("--help prints usage and exits ok, without touching a repository", () => {
  const { exitCode, stdout } = runMain(["--help"], "/");
  assert.equal(exitCode, EXIT.ok);
  assert.match(stdout, /open-review — open a tuicr review in a tmux popup/);
});

test("outside a repository, main errors out", () => {
  const dir = mkdtempSync(join(tmpdir(), "open-review-non-repo-"));
  try {
    const { exitCode } = runMain([], dir);
    assert.equal(exitCode, EXIT.error);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Regression for the pr path skipping the dry-run short-circuit the
// with-facts path already had: --dry-run must resolve and print, never reach
// launch. Today launch is still a stub, so this passes either way; the
// meaningful guard is that a dry run leaves no trace in a directory outside
// any repository, since there is no gitDir to compute a plan path from at
// all — a real launch would have to do more than print to be observable
// here, and once Task 9 fills launch in this stays the right assertion.
test("--dry-run on the pr path never reaches launch", () => {
  const dir = mkdtempSync(join(tmpdir(), "open-review-non-repo-"));
  try {
    const { exitCode, stdout } = runMain(["--dry-run", "pr", "https://github.com/o/r/pull/1"], dir);
    assert.equal(exitCode, EXIT.ok);
    assert.match(stdout, /^mode: /m);
    assert.deepEqual(readdirSync(dir), [], "a dry run must leave no trace outside any repository");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a clean tree with no commits to review exits with EXIT.nothing", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    const { exitCode } = runMain([], repo.dir);
    assert.equal(exitCode, EXIT.nothing);
  } finally {
    repo.cleanup();
  }
});

test("--dry-run writes the plan then clears it, rather than leaving it for --plan to find", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    repo.write("a.txt", "a\nb\n");
    const { exitCode } = runMain(["--dry-run"], repo.dir);
    assert.equal(exitCode, EXIT.ok);
    assert.equal(existsSync(planPath(join(repo.dir, ".git"))), false);
  } finally {
    repo.cleanup();
  }
});

test("--plan with no launch in flight errors out rather than hanging forever", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    const { exitCode } = runMain(["--plan"], repo.dir);
    assert.equal(exitCode, EXIT.error);
  } finally {
    repo.cleanup();
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inScope, launch, resolve } from "./main.ts";
import { planPath, writeLastReviewed, writePlan } from "./state.ts";
import { EXIT } from "./constants.ts";
import { makeRepo } from "./testrepo.ts";
import type { LaunchDeps } from "./main.ts";
import type { RepoFacts, SessionRow, Target } from "./types.ts";

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

// TMUX is stripped unconditionally, not just when a test expects to hit it:
// the whole point of these subprocess tests is that a broken fix could send
// one further than the test expects, and the child must land on "not inside
// tmux" in that case rather than on a real tmux binary — the developer
// running this suite may well be inside tmux themselves.
function runMain(
  argv: string[],
  cwd: string,
  opts: { timeout?: number } = {},
): { exitCode: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string } {
  const { TMUX: _tmux, ...env } = process.env;
  const result = spawnSync(process.execPath, [mainScript, ...argv], {
    cwd,
    env,
    encoding: "utf8",
    timeout: opts.timeout,
  });
  return { exitCode: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr };
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

// Important 4, first half: a working tree dirty only with untracked files has
// an empty `git diff` and is still a real review — the guard against E
// overreaching and swallowing this legitimate case along with the bogus ones.
test("a working tree dirty only with untracked files still launches", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    repo.write("new.txt", "new\n");

    const { target } = resolve(repo.dir, []);
    assert.equal(target.emptyReason, null);
    assert.deepEqual(target.tuicrArgs, ["-w", "--no-update-check"]);
  } finally {
    repo.cleanup();
  }
});

// Important 4, second half: a path filter that matches nothing must not open
// a popup with nothing to show — verified live in the review as exit 0 with
// "stat: no textual changes", which main.ts must instead turn into emptyReason.
test("a path filter matching nothing in scope is empty, not a launch with nothing to show", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("mine.txt", "1\n");
    repo.commit("f1");

    const { target } = resolve(repo.dir, ["-p", "no-such-dir"]);
    assert.ok(target.emptyReason);
  } finally {
    repo.cleanup();
  }
});

// Important 4, second half continued: an unresolvable revset must surface as
// a failure naming the revset, not collapse into "no textual changes" and
// then read as an empty-but-real review.
test("an unresolvable revset is an error, not an empty review", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");

    const { target, plan } = resolve(repo.dir, ["-r", "bogus..HEAD"]);
    assert.ok(target.emptyReason);
    assert.match(target.emptyReason ?? "", /bogus/);
    assert.doesNotMatch(plan, /no textual changes/);
  } finally {
    repo.cleanup();
  }
});

test("inScope matches a path filter the way git diff -- <path> would", () => {
  assert.equal(inScope("src/a.ts", null), true);
  assert.equal(inScope("keep/a.ts", "keep"), true);
  assert.equal(inScope("keep/a.ts", "keep/"), true);
  assert.equal(inScope("keep.ts", "keep"), false);
  assert.equal(inScope("drop/b.ts", "keep"), false);
  assert.equal(inScope("keep", "keep"), true);
});

// Important 7: an explicit -r, pr or --file target never had base detection
// run for it — verified live in the review as `base:`/`commits:` lines
// printed above `tuicr: -r bogus..HEAD`, stating something about the review
// that Component 4 says should never have been computed at all.
test("an explicit revset never reports a detected base", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("b.txt", "b\n");
    repo.commit("f1");

    const { plan } = resolve(repo.dir, ["-r", "master..feature"]);
    assert.doesNotMatch(plan, /^base:/m);
    assert.doesNotMatch(plan, /^commits:/m);
  } finally {
    repo.cleanup();
  }
});

// On a plain single-commit repo chooseBase() already returns null with no
// fix at all, which would make this pass whether or not the gate exists — so
// the fixture below stacks a feature branch on master first, exactly like
// the revset test above, to guarantee a base is there to wrongly report.
test("--file never reports a detected base", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("docs/plan.md", "one\ntwo\n");
    repo.commit("f1");

    const { plan } = resolve(repo.dir, ["--file", "docs/plan.md"]);
    assert.doesNotMatch(plan, /^base:/m);
    assert.doesNotMatch(plan, /^commits:/m);
  } finally {
    repo.cleanup();
  }
});

test("pr inside a repository never reports a detected base", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("b.txt", "b\n");
    repo.commit("f1");

    const { plan } = resolve(repo.dir, ["pr", "123"]);
    assert.doesNotMatch(plan, /^base:/m);
    assert.doesNotMatch(plan, /^commits:/m);
  } finally {
    repo.cleanup();
  }
});

// main()'s branch dispatch. The tests immediately below cover only branches
// that return before ever reaching launch(); launch() itself is exercised
// further down, in-process with fake dependencies rather than through this
// subprocess helper, since only in-process calls can hand it a JS function.

test("--help prints usage and exits ok, without touching a repository", () => {
  const { exitCode, stdout } = runMain(["--help"], "/");
  assert.equal(exitCode, EXIT.ok);
  assert.match(stdout, /open-review — open a tuicr review in a tmux side pane/);
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
// launch. The meaningful guard is that a dry run leaves no trace in a
// directory outside any repository, since there is no gitDir to compute a
// plan path from at all — a real launch would have to do more than print to
// be observable here.
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

// Important 4, at the process boundary: the emptyReason check in main() runs
// before launch() is ever called (EXIT.nothing is not returned from inside
// launch() anywhere in this file), so exit 2 here is itself the proof the
// popup opener was never reached — no fake needed, and no tmux touched.
test("-p matching nothing in scope exits EXIT.nothing before ever reaching the popup", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("mine.txt", "1\n");
    repo.commit("f1");
    const { exitCode, stderr } = runMain(["-p", "no-such-dir"], repo.dir);
    assert.equal(exitCode, EXIT.nothing);
    assert.match(stderr, /nothing to review/);
  } finally {
    repo.cleanup();
  }
});

test("-r bogus..HEAD exits EXIT.nothing before ever reaching the popup", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    const { exitCode, stderr } = runMain(["-r", "bogus..HEAD"], repo.dir);
    assert.equal(exitCode, EXIT.nothing);
    assert.match(stderr, /nothing to review/);
  } finally {
    repo.cleanup();
  }
});

// The one cheap --exec test named in the review: the emptyReason check runs
// before main() ever looks at the action, so --exec on a clean tree must
// exit 2 without ever reaching execInPlace (which would try to run tuicr).
test("--exec on a clean tree exits before ever reaching tuicr", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    const { exitCode } = runMain(["--exec"], repo.dir);
    assert.equal(exitCode, EXIT.nothing);
  } finally {
    repo.cleanup();
  }
});

// Important 1, proven rather than asserted on output alone: a symlink to a
// FIFO placed past the cap blocks forever if countLines ever reads through
// it (a bare FIFO is invisible to `git status`, which only reports regular
// files and symlinks — the symlink is what makes it show up as untracked at
// all). A hang here — caught by the timeout rather than left to wedge the
// suite — would mean the cap saved only the display, not the reads. u00..u09
// sort before the symlink, so the cap keeps exactly the real files.
test("the untracked cap saves the reads, not just the display", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a\n");
    repo.commit("c1");
    for (let i = 0; i < 10; i++) repo.write(`u${String(i).padStart(2, "0")}.txt`, "x\n");
    execFileSync("mkfifo", [join(repo.dir, "blocking-fifo")]);
    execFileSync("ln", ["-s", "blocking-fifo", join(repo.dir, "u10-link")]);

    const { exitCode, signal, stdout } = runMain(["--dry-run"], repo.dir, { timeout: 5000 });
    assert.equal(signal, null, "countLines must not have touched a path past the cap — the process hung");
    assert.equal(exitCode, EXIT.ok);
    assert.match(stdout, /… and 1 more$/m);
    const shown = stdout.split("\n").filter((line) => /^\s+\d+\s+u\d\d\.txt$/.test(line));
    assert.equal(shown.length, 10);
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

// launch()'s wiring, in-process with fake dependencies. This is the seam
// Important 2, 3 and 5 all live behind: every exit-code decision below is
// asserted directly, with no tmux and no tuicr ever touched. `insideTmux()`
// itself is not injectable — it only reads process.env["TMUX"], so it is
// toggled directly, restored in a finally, and never causes a real tmux
// binary to run either way.

async function withTmuxEnv<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const original = process.env["TMUX"];
  if (value === undefined) delete process.env["TMUX"];
  else process.env["TMUX"] = value;
  try {
    return await fn();
  } finally {
    if (original === undefined) delete process.env["TMUX"];
    else process.env["TMUX"] = original;
  }
}

function fakeFacts(gitDir: string): RepoFacts {
  return {
    root: gitDir,
    gitDir,
    commonDir: gitDir,
    branch: "feature",
    head: "abc123",
    work: { staged: 0, unstaged: 0, untracked: [], dirty: false },
    refs: { reflogName: null, candidates: [] },
  };
}

function fakeTarget(): Target {
  return {
    description: "test target",
    tuicrArgs: ["-w", "--no-update-check"],
    stat: { kind: "diff", args: ["HEAD"] },
    notes: [],
    emptyReason: null,
  };
}

function fakeSession(over: Partial<SessionRow> = {}): SessionRow {
  return {
    slug: "o/r@feature/staged-and-unstaged/abc123",
    kind: "local",
    path: "/sessions/one.json",
    updated_at: "2026-08-07T10:00:00.000Z",
    comment_count: 0,
    ...over,
  };
}

function launchDir(): string {
  return mkdtempSync(join(tmpdir(), "open-review-launch-"));
}

function readyLaunchDeps(overrides: Partial<LaunchDeps> = {}): LaunchDeps {
  return {
    currentPane: () => "%1",
    reviewSessionAlive: () => false,
    openReviewPane: () => "%2",
    waitForReviewStarted: async () => "started",
    waitForReviewSessionGone: async () => {},
    listSessions: () => [],
    readComments: () => [],
    writeLastReviewed: () => {},
    ...overrides,
  };
}

// Important 2, exit 1 of 3: not inside tmux.
test("launch: not inside tmux clears the plan before erroring", async () => {
  const gitDir = launchDir();
  try {
    writePlan(gitDir, "mode: test");
    const exitCode = await withTmuxEnv(undefined, () =>
      launch(gitDir, fakeTarget(), fakeFacts(gitDir), "launch"),
    );
    assert.equal(exitCode, EXIT.error);
    assert.equal(existsSync(planPath(gitDir)), false);
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
  }
});

test("launch: no invoking tmux pane clears the plan before erroring", async () => {
  const gitDir = launchDir();
  let opened = false;
  try {
    writePlan(gitDir, "mode: test");
    const exitCode = await withTmuxEnv("fake-tmux-socket", () =>
      launch(gitDir, fakeTarget(), fakeFacts(gitDir), "launch", readyLaunchDeps({
        currentPane: () => null,
        openReviewPane: () => {
          opened = true;
          return "%2";
        },
      })),
    );
    assert.equal(exitCode, EXIT.error);
    assert.equal(existsSync(planPath(gitDir)), false);
    assert.equal(opened, false);
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
  }
});

test("launch: a review already open clears the plan before reporting busy", async () => {
  const gitDir = launchDir();
  try {
    writePlan(gitDir, "mode: test");
    const exitCode = await withTmuxEnv("fake-tmux-socket", () =>
      launch(gitDir, fakeTarget(), fakeFacts(gitDir), "launch", readyLaunchDeps({
        reviewSessionAlive: () => true,
      })),
    );
    assert.equal(exitCode, EXIT.busy);
    assert.equal(existsSync(planPath(gitDir)), false);
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
  }
});

test("launch: pane creation failure clears the plan and never waits for startup", async () => {
  const gitDir = launchDir();
  let waitedForStart = false;
  try {
    writePlan(gitDir, "mode: test");
    const exitCode = await withTmuxEnv("fake-tmux-socket", () =>
      launch(gitDir, fakeTarget(), fakeFacts(gitDir), "launch", readyLaunchDeps({
        openReviewPane: () => null,
        waitForReviewStarted: async () => {
          waitedForStart = true;
          return "started";
        },
      })),
    );
    assert.equal(exitCode, EXIT.error);
    assert.equal(existsSync(planPath(gitDir)), false);
    assert.equal(waitedForStart, false);
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
  }
});

for (const start of ["pane-gone", "timeout"] as const) {
  test(`launch: ${start} before a live session clears the plan and never waits for completion`, async () => {
    const gitDir = launchDir();
    let waitedForCompletion = false;
    try {
      writePlan(gitDir, "mode: test");
      const exitCode = await withTmuxEnv("fake-tmux-socket", () =>
        launch(gitDir, fakeTarget(), fakeFacts(gitDir), "launch", readyLaunchDeps({
          waitForReviewStarted: async () => start,
          waitForReviewSessionGone: async () => {
            waitedForCompletion = true;
          },
        })),
      );
      assert.equal(exitCode, EXIT.error);
      assert.equal(existsSync(planPath(gitDir)), false);
      assert.equal(waitedForCompletion, false);
    } finally {
      rmSync(gitDir, { recursive: true, force: true });
    }
  });
}

test("launch: a session that appears as its pane closes still waits and reads back", async () => {
  const gitDir = launchDir();
  let sessionAliveCalls = 0;
  let waited = false;
  let readCommentsCalled = false;
  const session = fakeSession({ path: "/sessions/survived.json", comment_count: 1 });
  try {
    let listCall = 0;
    const exitCode = await withTmuxEnv("fake-tmux-socket", () =>
      launch(gitDir, fakeTarget(), fakeFacts(gitDir), "launch", readyLaunchDeps({
        reviewSessionAlive: () => ++sessionAliveCalls > 1,
        waitForReviewStarted: async () => "pane-gone",
        waitForReviewSessionGone: async () => {
          waited = true;
        },
        listSessions: () => (listCall++ === 0 ? [] : [session]),
        readComments: (path) => {
          readCommentsCalled = true;
          assert.equal(path, session.path);
          return [{
            location: "review",
            path: null,
            start_line: null,
            end_line: null,
            side: "new",
            comment_type: "none",
            content: "hi",
          }];
        },
      })),
    );
    assert.equal(waited, true);
    assert.equal(readCommentsCalled, true);
    assert.equal(exitCode, EXIT.ok);
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
  }
});

// Important 5: a local session is keyed on branch + HEAD sha, so re-reviewing
// at the same HEAD reuses it. tuicr touches the session file at startup, so
// updated_at moves (electing it) even when comment_count did not — the exact
// case that used to read as exit 0 with a stale review instead of exit 3.
test("launch: a reused session with an unchanged comment count is not presented as new comments", async () => {
  const gitDir = launchDir();
  let readCommentsCalled = false;
  try {
    const before = [fakeSession({ path: "/sessions/reused.json", updated_at: "t1", comment_count: 3 })];
    const after = [fakeSession({ path: "/sessions/reused.json", updated_at: "t2", comment_count: 3 })];
    let listCall = 0;
    const exitCode = await withTmuxEnv("fake-tmux-socket", () =>
      launch(gitDir, fakeTarget(), fakeFacts(gitDir), "launch", readyLaunchDeps({
        listSessions: () => (listCall++ === 0 ? before : after),
        readComments: () => {
          readCommentsCalled = true;
          return [];
        },
      })),
    );
    // Before the fix, only `elected.comment_count === 0` was checked, so this
    // returned EXIT.ok and presented all 3 comments as this review's output.
    assert.equal(exitCode, EXIT.noComments);
    assert.equal(readCommentsCalled, false, "none of the comments are new, so there is nothing to read back");
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
  }
});

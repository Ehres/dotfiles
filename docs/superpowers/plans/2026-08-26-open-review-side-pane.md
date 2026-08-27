# Open Review Side Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the modal tmux popup used by agent-launched tuicr reviews with a focused 60%-width right pane while preserving the persistent review session, recovery, completion signal, and automatic comment read-back.

**Architecture:** Keep `_popup_tuicr` as the process owner and attach to it from a pane created beside the invoking OpenCode pane. Split terminal concerns into pane creation, startup-state observation, and review-session completion; keep target resolution and comment election unchanged.

**Tech Stack:** TypeScript on Node 24 native type stripping, `node:test`, tmux 3.7b, tuicr, GNU Stow dotfiles.

## Global Constraints

- Implement the approved spec at `docs/superpowers/specs/2026-08-26-open-review-side-pane-design.md`.
- Only skill-launched reviews change surface; `.tmux.conf` and the manual `prefix + R` popup stay unchanged.
- Create a focused right pane with `split-window -h -l 60%`; do not pass `-d`.
- Target the invoking OpenCode pane explicitly through `$TMUX_PANE`.
- Keep `scripts/tmux-popup --kill tuicr`, `_popup_tuicr`, `C-q`, Escape handling, and popup-based recovery.
- Poll startup every 50 ms for at most 5 seconds; check the review session before checking whether the side pane survived.
- Keep existing exit-code meanings, review resolution, plans, session election, `--since-last`, and comment read-back.
- Add no runtime dependency. Type-only imports use `import type`; relative imports include `.ts`; do not use `enum`, `namespace`, or constructor parameter properties.
- Preserve all pre-existing worktree changes. At plan-writing time, `.agents/skills/open-review/SKILL.md`, `FAILURES.md`, `src/target.test.ts`, and `src/types.ts` already contain unrelated changes.
- Before every commit, show the exact files, diff, and Angular commit message and obtain explicit user authorization. If a touched file still has pre-existing hunks, do not stage it until the user decides whether those hunks belong in the commit.
- Run tests from `.agents/skills/open-review`; a directory argument to `node --test` does not work.

## File Map

- Modify `.agents/skills/open-review/src/tmux.ts`: own tmux pane creation and review lifecycle probes.
- Modify `.agents/skills/open-review/src/tmux.test.ts`: test pane argv, two-shell quoting, and startup state transitions without a live tmux server.
- Modify `.agents/skills/open-review/src/main.ts`: orchestrate pane startup, persistent-session completion, errors, and comment read-back.
- Modify `.agents/skills/open-review/src/main.test.ts`: test launch decisions through injected terminal and tuicr dependencies.
- Modify `.agents/skills/open-review/SKILL.md`: document the non-modal agent workflow while preserving current caveats.
- Modify `.agents/skills/tuicr/SKILL.md`: distinguish the agent side pane from the manual modal popup.
- Keep `.tmux.conf` and `scripts/tmux-popup` unchanged.

---

### Task 1: Build The Side-Pane Terminal Adapter

**Files:**
- Modify: `.agents/skills/open-review/src/tmux.ts`
- Test: `.agents/skills/open-review/src/tmux.test.ts`

**Interfaces:**
- Consumes: `POPUP_NAME` and `POPUP_SESSION` from `./constants.ts`; `scripts/tmux-popup` at `~/scripts/tmux-popup`.
- Produces: `currentPane(): string | null`.
- Produces: `buildReviewPaneArgs(root: string, sourcePane: string, tuicrArgs: string[]): string[]`.
- Produces: `openReviewPane(root: string, sourcePane: string, tuicrArgs: string[]): string | null`.
- Produces: `reviewSessionAlive(): boolean` and `reviewPaneAlive(paneId: string): boolean`.
- Produces: `ReviewStart = "started" | "pane-gone" | "timeout"`.
- Produces: `waitForReviewStarted(paneId: string, timeoutMs?: number, pollMs?: number, deps?: ReviewStartupDeps): Promise<ReviewStart>`.
- Produces: `waitForReviewSessionGone(pollMs?: number): Promise<void>`.

- [ ] **Step 1: Replace the popup adapter tests with failing side-pane tests**

Update the import in `.agents/skills/open-review/src/tmux.test.ts`:

```ts
import {
  buildReviewPaneArgs,
  shellQuote,
  TMUX_POPUP,
  waitForReviewStarted,
} from "./tmux.ts";
```

Update the two comments that name `display-popup` so they name `split-window` as the first shell hop, then append these tests:

```ts
test("the review pane targets the caller, takes 60% on the right, and receives focus", () => {
  const args = buildReviewPaneArgs("/repo with space", "%7", ["--file", "docs/my plan.md"]);

  assert.deepEqual(args.slice(0, -1), [
    "split-window",
    "-t", "%7",
    "-c", "/repo with space",
    "-h",
    "-l", "60%",
    "-P",
    "-F", "#{pane_id}",
  ]);
  assert.equal(args.includes("-d"), false, "the review pane must receive focus");

  const command = args.at(-1);
  assert.ok(command);
  const afterHop1 = shellSplit(command);
  assert.deepEqual(shellSplit(afterHop1.join(" ")), [
    TMUX_POPUP,
    "--kill",
    "tuicr",
    "tuicr",
    "--file",
    "docs/my plan.md",
  ]);
});

test("review startup observes the session before declaring a vanished pane", async () => {
  let sessionChecks = 0;
  let paneChecks = 0;
  const result = await waitForReviewStarted("%9", 100, 0, {
    reviewSessionAlive: () => ++sessionChecks === 2,
    reviewPaneAlive: () => {
      paneChecks += 1;
      return true;
    },
  });

  assert.equal(result, "started");
  assert.equal(paneChecks, 1, "the pane is not checked after the session appears");
});

test("review startup reports a pane that disappears before the session exists", async () => {
  const result = await waitForReviewStarted("%9", 100, 0, {
    reviewSessionAlive: () => false,
    reviewPaneAlive: () => false,
  });

  assert.equal(result, "pane-gone");
});

test("review startup times out while the pane is still present", async () => {
  const result = await waitForReviewStarted("%9", 0, 0, {
    reviewSessionAlive: () => false,
    reviewPaneAlive: () => true,
  });

  assert.equal(result, "timeout");
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
node --test src/tmux.test.ts
```

Expected: FAIL because `buildReviewPaneArgs` and `waitForReviewStarted` are not exported yet.

- [ ] **Step 3: Implement the side-pane adapter**

Replace `.agents/skills/open-review/src/tmux.ts` with:

```ts
import { execFileSync, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { POPUP_NAME, POPUP_SESSION } from "./constants.ts";

/** Resolved in code so no word needs a shell to expand a tilde for it. */
export const TMUX_POPUP = join(homedir(), "scripts", "tmux-popup");

export type ReviewStart = "started" | "pane-gone" | "timeout";

export type ReviewStartupDeps = {
  reviewSessionAlive: () => boolean;
  reviewPaneAlive: (paneId: string) => boolean;
};

export function insideTmux(): boolean {
  return Boolean(process.env["TMUX"]);
}

export function currentPane(): string | null {
  return process.env["TMUX_PANE"] || null;
}

export function reviewSessionAlive(): boolean {
  return spawnSync("tmux", ["has-session", "-t", POPUP_SESSION], { stdio: "ignore" }).status === 0;
}

export function reviewPaneAlive(paneId: string): boolean {
  return spawnSync("tmux", ["display-message", "-p", "-t", paneId, "#{pane_id}"], {
    stdio: "ignore",
  }).status === 0;
}

export function buildReviewPaneArgs(root: string, sourcePane: string, tuicrArgs: string[]): string[] {
  const command = [TMUX_POPUP, "--kill", POPUP_NAME, "tuicr", ...tuicrArgs]
    .map((word) => shellQuote(shellQuote(word)))
    .join(" ");

  return [
    "split-window",
    "-t", sourcePane,
    "-c", root,
    "-h",
    "-l", "60%",
    "-P",
    "-F", "#{pane_id}",
    command,
  ];
}

/** Creates the client pane; `_popup_tuicr` remains the review process owner. */
export function openReviewPane(root: string, sourcePane: string, tuicrArgs: string[]): string | null {
  try {
    const paneId = execFileSync("tmux", buildReviewPaneArgs(root, sourcePane, tuicrArgs), {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }).trim();
    return paneId === "" ? null : paneId;
  } catch {
    return null;
  }
}

export async function waitForReviewStarted(
  paneId: string,
  timeoutMs = 5_000,
  pollMs = 50,
  deps: ReviewStartupDeps = { reviewSessionAlive, reviewPaneAlive },
): Promise<ReviewStart> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (deps.reviewSessionAlive()) return "started";
    if (!deps.reviewPaneAlive(paneId)) return "pane-gone";
    if (Date.now() >= deadline) return "timeout";
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/** The honest end of a review: the persistent session is gone, which means C-q. */
export async function waitForReviewSessionGone(pollMs = 300): Promise<void> {
  while (reviewSessionAlive()) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/**
 * Quoted for two shell hops, not one. `split-window` hands its command to a
 * shell; inside that, `~/scripts/tmux-popup` does `CMD="$*"`, which strips
 * the quotes that protected the first hop and hands the bare result to a
 * second shell via `tmux new-session`. Each word is therefore quoted twice.
 *
 * No word is exempt. The helper path is resolved through `homedir()`, so a
 * caller-provided tilde-prefixed path stays literal data at both hops.
 */
export function shellQuote(word: string): string {
  return /^[A-Za-z0-9_./=:-]+$/.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`;
}
```

- [ ] **Step 4: Run the focused tests and confirm they pass**

Run:

```bash
node --test src/tmux.test.ts
```

Expected: all `src/tmux.test.ts` tests PASS, including the existing hostile-argument round trips.

- [ ] **Step 5: Run the typechecker**

Run:

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: exit 0 with no diagnostics.

- [ ] **Step 6: Request authorization, then commit the adapter**

Show:

```bash
git diff -- .agents/skills/open-review/src/tmux.ts .agents/skills/open-review/src/tmux.test.ts
git status --short
```

Proposed commit:

```text
refactor(open-review): add side pane adapter
```

After explicit authorization, stage only these files and commit:

```bash
git add .agents/skills/open-review/src/tmux.ts .agents/skills/open-review/src/tmux.test.ts
git commit -m "refactor(open-review): add side pane adapter"
```

---

### Task 2: Orchestrate Pane Startup And Review Completion

**Files:**
- Modify: `.agents/skills/open-review/src/main.ts:14,212-343`
- Test: `.agents/skills/open-review/src/main.test.ts:452-645`

**Interfaces:**
- Consumes: all Task 1 exports except `buildReviewPaneArgs`, `reviewPaneAlive`, and `shellQuote`.
- Produces: `LaunchDeps` fields `currentPane`, `reviewSessionAlive`, `openReviewPane`, `waitForReviewStarted`, and `waitForReviewSessionGone` for deterministic launch tests.
- Preserves: `launch(root: string, target: Target, facts: RepoFacts | null, action: Action, deps?: LaunchDeps): Promise<number>`.

- [ ] **Step 1: Rewrite launch dependency tests for the new lifecycle**

Add this type-only import to `.agents/skills/open-review/src/main.test.ts`:

```ts
import type { LaunchDeps } from "./main.ts";
```

Add this helper after `launchDir()`:

```ts
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
```

Keep the existing “not inside tmux” test. Replace the popup-specific tests from the busy test through the “survived” read-back test with:

```ts
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
```

In the reused-session test, replace its three popup dependencies with the helper:

```ts
const exitCode = await withTmuxEnv("fake-tmux-socket", () =>
  launch(gitDir, fakeTarget(), fakeFacts(gitDir), "launch", readyLaunchDeps({
    listSessions: () => (listCall++ === 0 ? before : after),
    readComments: () => {
      readCommentsCalled = true;
      return [];
    },
  })),
);
```

- [ ] **Step 2: Run the launch tests to verify they fail**

Run:

```bash
node --test src/main.test.ts
```

Expected: FAIL with type or runtime errors because `LaunchDeps` still exposes popup dependencies and `launch` does not inspect startup states.

- [ ] **Step 3: Wire the new adapter into `launch`**

Replace the tmux import in `.agents/skills/open-review/src/main.ts` with:

```ts
import {
  currentPane,
  insideTmux,
  openReviewPane,
  reviewSessionAlive,
  waitForReviewSessionGone,
  waitForReviewStarted,
} from "./tmux.ts";
```

Replace `LaunchDeps` with:

```ts
export type LaunchDeps = {
  currentPane?: typeof currentPane;
  reviewSessionAlive?: typeof reviewSessionAlive;
  openReviewPane?: typeof openReviewPane;
  waitForReviewStarted?: typeof waitForReviewStarted;
  waitForReviewSessionGone?: typeof waitForReviewSessionGone;
  listSessions?: typeof listSessions;
  readComments?: typeof readComments;
  writeLastReviewed?: typeof writeLastReviewed;
};
```

At the start of `launch`, replace the popup dependency aliases with:

```ts
  const doCurrentPane = deps.currentPane ?? currentPane;
  const doReviewSessionAlive = deps.reviewSessionAlive ?? reviewSessionAlive;
  const doOpenReviewPane = deps.openReviewPane ?? openReviewPane;
  const doWaitForReviewStarted = deps.waitForReviewStarted ?? waitForReviewStarted;
  const doWaitForReviewSessionGone = deps.waitForReviewSessionGone ?? waitForReviewSessionGone;
  const doListSessions = deps.listSessions ?? listSessions;
  const doReadComments = deps.readComments ?? readComments;
  const doWriteLastReviewed = deps.writeLastReviewed ?? writeLastReviewed;
```

Keep the `action === "exec"` and `!insideTmux()` branches. Replace the old busy check, popup launch, and popup wait with:

```ts
  // tmux-popup attaches an existing session and ignores the command it was
  // given, so a live review would silently stand in for the requested one.
  if (doReviewSessionAlive()) {
    clearPlanIfLive();
    process.stderr.write(
      "open-review: a review is already open — close it with C-q, or reattach with prefix + R\n",
    );
    return EXIT.busy;
  }

  const before = doListSessions();
  const sourcePane = doCurrentPane();
  if (sourcePane === null) {
    clearPlanIfLive();
    process.stderr.write(
      `open-review: no tmux pane target — run 'tuicr ${target.tuicrArgs.join(" ")}' directly\n`,
    );
    return EXIT.error;
  }

  const paneId = doOpenReviewPane(root, sourcePane, target.tuicrArgs);
  if (paneId === null) {
    clearPlanIfLive();
    process.stderr.write(
      `open-review: could not open the review pane — run 'tuicr ${target.tuicrArgs.join(" ")}' directly\n`,
    );
    return EXIT.error;
  }

  const start = await doWaitForReviewStarted(paneId);
  // The session is checked once more after a reported startup failure. It may
  // have appeared between the startup poll's final check and this branch.
  if (start !== "started" && !doReviewSessionAlive()) {
    clearPlanIfLive();
    process.stderr.write(
      start === "pane-gone"
        ? "open-review: review pane closed before tuicr started\n"
        : "open-review: timed out waiting for the tuicr session\n",
    );
    return EXIT.error;
  }

  await doWaitForReviewSessionGone();
```

Keep the existing code from `const after = doListSessions();` through comment output unchanged. Replace the comment above `LaunchDeps` with:

```ts
/**
 * Terminal and tuicr side effects used by launch(). Every field is optional so
 * tests can drive one lifecycle decision without touching tmux or tuicr.
 */
```

Replace the comment above `launch` with:

```ts
/**
 * Opens the review side pane, waits for the persistent session to end, and
 * reads its comments back. `facts` is null only on the repository-less pr path.
 */
```

Replace the plan-cleanup comment inside `launch` with:

```ts
  // Every exit below that does not start a review must clear the plan: the
  // agent's next --plan call must never describe a launch that did not happen.
```

- [ ] **Step 4: Run the launch tests and confirm they pass**

Run:

```bash
node --test src/main.test.ts
```

Expected: all `src/main.test.ts` tests PASS. The failure cases must clear `open-review.plan`; the post-start pane-loss case must still call completion wait and comment read-back.

- [ ] **Step 5: Run the adapter and launch tests together**

Run:

```bash
node --test src/tmux.test.ts src/main.test.ts
./node_modules/.bin/tsc --noEmit
```

Expected: both test files PASS and the typechecker exits 0 with no diagnostics.

- [ ] **Step 6: Request authorization, then commit orchestration**

Show:

```bash
git diff -- .agents/skills/open-review/src/main.ts .agents/skills/open-review/src/main.test.ts
git status --short
```

Proposed commit:

```text
feat(open-review): launch reviews in a side pane
```

After explicit authorization, stage only these files and commit:

```bash
git add .agents/skills/open-review/src/main.ts .agents/skills/open-review/src/main.test.ts
git commit -m "feat(open-review): launch reviews in a side pane"
```

---

### Task 3: Update The Skill Contract And Verify The Workflow

**Files:**
- Modify: `.agents/skills/open-review/src/main.ts:125-137`
- Test: `.agents/skills/open-review/src/main.test.ts:305-309`
- Modify: `.agents/skills/open-review/SKILL.md:1-69`
- Modify: `.agents/skills/tuicr/SKILL.md:15-36`
- Include after review: `docs/superpowers/specs/2026-08-26-open-review-side-pane-design.md`
- Include after review: `docs/superpowers/plans/2026-08-26-open-review-side-pane.md`

**Interfaces:**
- Consumes: the Task 2 launch behavior and unchanged manual `prefix + R` binding.
- Produces: an agent contract that launches in the side pane, permits continued conversation, and uses the popup only for manual launch or recovery.

- [ ] **Step 1: Change the CLI expectation before changing its copy**

Replace the help assertion in `.agents/skills/open-review/src/main.test.ts` with:

```ts
assert.match(stdout, /open-review — open a tuicr review in a tmux side pane/);
```

- [ ] **Step 2: Run the focused test to verify the old copy fails**

Run:

```bash
node --test src/main.test.ts
```

Expected: exactly the `--help prints usage` test FAILS because the usage header still says `tmux popup`.

- [ ] **Step 3: Update CLI and skill documentation**

Change the `USAGE` header and dry-run line in `.agents/skills/open-review/src/main.ts` to:

```text
open-review — open a tuicr review in a tmux side pane
```

```text
  open-review --dry-run       resolve and print, no pane
```

In `.agents/skills/open-review/SKILL.md`, preserve the existing caveats and unrelated dirty hunks, but make these exact contract changes:

```yaml
description: Launch tuicr, the local code-review TUI, in a focused tmux side pane so the user can review a diff and keep talking to the agent. Use when the user asks to open or start a review, to review a branch, a diff or a pull request, or says things like "lance une review", "je veux relire", "ouvre tuicr", "review en pane", or "review en popup".
```

```markdown
# Open a tuicr review in a tmux side pane
```

Change the launch summary to:

```markdown
The script resolves the base, refuses to open an empty diff, opens the side
pane, waits for the review to actually finish, and **prints the comments when
it does**. Do not run git commands first to work any of that out.
```

Change “the plan is written before the popup launches” to “the plan is written before the pane launches”, then replace “While it is open” with:

```markdown
## While it is open

The side pane receives focus at launch but is not modal: OpenCode remains
visible, and the user can move back to it while tuicr stays open. Escape goes to
tuicr. `C-q` finishes the review, closes the persistent session, and lets the
side pane close automatically.

Closing the side pane without `C-q` only detaches its client. The review
survives, and `prefix + R` resumes it in the existing manual popup. **The
background task completing is the signal that the review is finished** — do not
poll, and do not ask the user to announce it.
```

Change exit 2 to “nothing to review, no pane opened”. Change the final sentence of the read-back section to:

```markdown
The `tuicr` skill is only for the case where the user opened the popup
themselves.
```

In `.agents/skills/tuicr/SKILL.md`, replace lines 19-30 with:

```markdown
done, then read once. If the user asks to review and no review surface is open,
that is a request to launch one: use the `open-review` skill, which is the
sanctioned way for an agent to do that. It launches tuicr in its own tmux
session, attaches it in a focused right-side pane, waits for the review to
finish, and reads the comments back for you — this skill's Step 1 and Step 2
below are then already done, so read what it printed instead of listing again.

The agent-launched side pane is not modal: the user can return to OpenCode while
tuicr remains visible. The user can also open the popup themselves (`prefix + R`
→ `tuicr -w`, closed with `C-q`). That manual popup remains modal.

If the user says they are done but the side pane was closed without `C-q`, the
session is still alive: reattach it with `prefix + R` and tell the user to press
`C-q` there to actually end the review. Escape only dismisses the manual popup;
it does not end the session.
```

- [ ] **Step 4: Run the complete automated verification**

Run from `.agents/skills/open-review`:

```bash
node --test
./node_modules/.bin/tsc --noEmit
```

Expected: all tests PASS, including the pre-existing known `todo` test for the merged-base defect; typecheck exits 0 with no diagnostics.

Run from the repository root:

```bash
./scripts/doctor.sh
```

Expected: exit 0. Warnings are reported but do not fail the command.

- [ ] **Step 5: Run a live tmux smoke test with the user present**

First ask permission because this changes the user's current tmux layout. After approval, verify no review session is already running:

```bash
tmux has-session -t _popup_tuicr
```

Expected: exit 1. If it exits 0, stop and ask the user to finish or close that review.

Create a disposable document and launch the normal entry point from the repository root:

```bash
SMOKE_FILE=$(mktemp /tmp/open-review-side-pane-file.XXXXXX)
SMOKE_LOG=$(mktemp /tmp/open-review-side-pane-log.XXXXXX)
printf 'side pane smoke test\n' > "$SMOKE_FILE"
~/.agents/skills/open-review/open-review --file "$SMOKE_FILE" > "$SMOKE_LOG" 2>&1 &
SMOKE_PID=$!
for _ in {1..100}; do
  tmux has-session -t _popup_tuicr 2>/dev/null && break
  sleep 0.05
done
tmux has-session -t _popup_tuicr
```

Expected: the final `has-session` exits 0. Otherwise stop the smoke test and inspect `"$SMOKE_LOG"`.

List panes to identify the new right-side pane:

```bash
tmux list-panes -F '#{pane_id} #{pane_left} #{pane_width} #{pane_current_command}'
REVIEW_PANE=$(tmux display-message -p '#{pane_id}')
```

Verify in order:

1. A focused pane appears on the right and takes 60% of the window.
2. Tuicr receives Escape without closing the pane.
3. The original OpenCode pane can be focused while tuicr remains visible.
4. `tmux kill-pane -t "$REVIEW_PANE"` removes only the side pane, and `tmux has-session -t _popup_tuicr` still exits 0.
5. `prefix + R` reattaches that review in the unchanged popup.
6. `C-q` kills `_popup_tuicr`, closes the review surface, and unblocks the background process.
7. `wait "$SMOKE_PID"` returns exit 0 with comments or exit 3 with the explicit no-comments message in `"$SMOKE_LOG"`.

Remove the disposable files after recording the result:

```bash
rm -f "$SMOKE_FILE" "$SMOKE_LOG"
```

If permission is declined, record the live smoke test as not run; do not claim the visual and recovery behavior was manually verified.

- [ ] **Step 6: Inspect final scope and request commit authorization**

Run:

```bash
git status --short
git diff --check -- .agents/skills/open-review/src/tmux.ts .agents/skills/open-review/src/tmux.test.ts .agents/skills/open-review/src/main.ts .agents/skills/open-review/src/main.test.ts .agents/skills/open-review/SKILL.md .agents/skills/tuicr/SKILL.md docs/superpowers/specs/2026-08-26-open-review-side-pane-design.md docs/superpowers/plans/2026-08-26-open-review-side-pane.md
git diff -- .agents/skills/open-review/src/main.ts .agents/skills/open-review/src/main.test.ts .agents/skills/open-review/SKILL.md .agents/skills/tuicr/SKILL.md docs/superpowers/specs/2026-08-26-open-review-side-pane-design.md docs/superpowers/plans/2026-08-26-open-review-side-pane.md
```

Confirm `.tmux.conf` and `scripts/tmux-popup` have no diff. Explicitly identify the pre-existing `open-review/SKILL.md` hunk before asking whether it should be included.

Proposed commit:

```text
docs(open-review): document side pane workflow
```

After explicit authorization, stage only the approved files. If the user authorizes the pre-existing `open-review/SKILL.md` hunk as part of this commit, use:

```bash
git add .agents/skills/open-review/src/main.ts .agents/skills/open-review/src/main.test.ts .agents/skills/open-review/SKILL.md .agents/skills/tuicr/SKILL.md docs/superpowers/specs/2026-08-26-open-review-side-pane-design.md docs/superpowers/plans/2026-08-26-open-review-side-pane.md
```

If that pre-existing hunk is not authorized, stop before the Task 3 commit and report the staging blocker. Do not omit the planned side-pane documentation and do not stage the whole file. After any authorized staging, verify the index before committing:

```bash
git diff --cached --check
git diff --cached --stat
git diff --cached
```

After the user confirms that the staged diff is exactly the approved scope, commit:

```bash
git commit -m "docs(open-review): document side pane workflow"
```

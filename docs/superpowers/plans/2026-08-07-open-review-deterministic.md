# open-review deterministic rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the `open-review` skill's bundled script in TypeScript so that one backgrounded call resolves the review target, opens the tuicr popup, survives Escape, and hands the comments back — with every decision unit-tested.

**Architecture:** A ~15-line bash shim resolves a `node` binary and hands over to `src/main.ts`, run by Node 24's native type stripping (no build, no dependencies). Inside, `git.ts` is the only module that spawns git and it produces a `RepoFacts` record; every decision — argument parsing, base choice, target construction, plan rendering, session election — is a pure function over that record, which is what makes it testable. Side effects (tmux, tuicr, the state files) live in thin adapters called only from `main.ts`.

**Tech Stack:** TypeScript on Node 24.13.0 (mise-pinned), `node:test` + `node:assert/strict`, bash 3.2 for the shim, `git`, `tmux` 3.7b, `tuicr` 0.20+.

**Spec:** `docs/superpowers/specs/2026-08-07-open-review-deterministic-design.md`. Read it first — the nine numbered defects in its Context section are what every test here is defending against.

## Global Constraints

- **Zero runtime dependencies.** No `node_modules`, no `package.json`, no build step, no `tsx`. If a task seems to need a library, it is the wrong task.
- **Node 24 type stripping erases types, it does not check them.** No `enum`, no `namespace`, no constructor parameter properties, `import type` for type-only imports, and **explicit `.ts` extensions on every relative import** (`import { parseArgs } from "./args.ts"`).
- **Test invocation, verified — a directory path does NOT work.** `node --test .agents/skills/open-review/src/` throws `MODULE_NOT_FOUND`. Use either form:
  - from the skill directory: `node --test`
  - from the repo root: `node --test '.agents/skills/open-review/src/*.test.ts'` (quote it; Node expands the glob)
  - one file: `node --test .agents/skills/open-review/src/args.test.ts`
- **The existing bash `open-review` stays live and untouched until Task 10.** The repo is stowed into `$HOME`; a review launched mid-implementation must still work. New code lives under `src/` and is invoked directly with `node` during development.
- **The popup session name exists in exactly one place**, `POPUP_SESSION` in `src/constants.ts`. It is `_popup_tuicr`, which is `~/scripts/tmux-popup`'s `_popup_` prefix plus the name `tuicr`, and it is shared with the `prefix + R` binding on purpose.
- **Commits:** Angular format, scope `open-review`, lowercase imperative, no trailing period. `.agents/rules/git-commit.md` requires explicit user validation before any commit — **ask once, at the start, for authorization covering this plan's whole sequence**, then commit per task without re-asking.
- **Every task ends green.** `node --test` from the skill directory passes before the commit.

---

## File Structure

```
.agents/skills/open-review/
  SKILL.md            rewritten in Task 11 — entry table, contract, exit codes, caveats
  FAILURES.md          created in Task 11 — one entry per wrong target, closed by a named test
  open-review          bash shim, replaces the old script in Task 10
  tsconfig.json        Task 1 — for the LSP only, installs nothing
  src/
    constants.ts       Task 1  — exit codes, popup session name
    types.ts           Task 1  — every shared type; later tasks append to it
    args.ts            Task 1  — argv -> Intent                                  (pure)
    base.ts            Task 2  — RepoFacts -> BaseChoice                         (pure)
    git.ts             Task 3  — spawns git, produces RepoFacts; stat/churn in Task 7
    testrepo.ts        Task 3  — test-only fixture builder (not a *.test.ts, never auto-run)
    target.ts          Task 4  — Intent + facts + base -> tuicr argv + stat spec  (pure)
    plan.ts            Task 5  — everything above -> the plan text                (pure)
    state.ts           Task 6  — plan file, last-reviewed state
    session.ts         Task 8  — session election and comment index               (pure)
    tuicr.ts           Task 9  — review list / review comments
    tmux.ts            Task 9  — launch, wait for the session to die
    main.ts            Task 7  — orchestration; extended in Tasks 9 and 10
    *.test.ts          one per module above
```

`git.ts` is the only module that spawns `git`; `tmux.ts` and `tuicr.ts` the only ones that spawn their tools; `main.ts` the only one that calls them. Everything else is data in, data out.

---

### Task 1: Scaffolding, shared types, argument parsing

Argument parsing is where defects 1 and 5 live: a `-p` passed without an explicit target is dropped, and a `-p` in last position crashes with a bash unbound-variable error. Parsing it into an `Intent` where `pathFilter` is a field rather than a positional flag makes both unexpressible.

**Files:**
- Create: `.agents/skills/open-review/tsconfig.json`
- Create: `.agents/skills/open-review/src/constants.ts`
- Create: `.agents/skills/open-review/src/types.ts`
- Create: `.agents/skills/open-review/src/args.ts`
- Test: `.agents/skills/open-review/src/args.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseArgs(argv: string[]): Intent`, `UsageError`, and the types `Action`, `Mode`, `Intent` in `types.ts`; `EXIT` and `POPUP_SESSION` in `constants.ts`.

- [ ] **Step 1: Create the tsconfig**

`.agents/skills/open-review/tsconfig.json` — it configures the editor's language server only. Nothing reads it at runtime, and nothing needs installing.

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

`erasableSyntaxOnly` is the important one: it makes the editor reject the syntax Node's stripper cannot erase, so the constraint is enforced while writing rather than discovered at runtime.

- [ ] **Step 2: Create the constants**

`src/constants.ts`:

```ts
// The popup runs in a session created by ~/scripts/tmux-popup, which prefixes
// the name it is given with `_popup_`. Shared with the `prefix + R` binding on
// purpose: dismissing the popup leaves the session alive, and that binding is
// how the user reattaches to it.
export const POPUP_NAME = "tuicr";
export const POPUP_SESSION = `_popup_${POPUP_NAME}`;

export const EXIT = {
  ok: 0,
  error: 1,
  nothing: 2,
  noComments: 3,
  busy: 4,
} as const;
```

- [ ] **Step 3: Create the shared types**

`src/types.ts`. Later tasks append to this file; nothing here is speculative — every field has a consumer in this plan.

```ts
export type Action = "launch" | "dry-run" | "exec" | "plan" | "help";

export type Mode =
  | { kind: "auto" }
  | { kind: "since-last" }
  | { kind: "working-tree" }
  | { kind: "revset"; revset: string }
  | { kind: "pr"; target: string }
  | { kind: "file"; path: string };

export type Intent = {
  action: Action;
  mode: Mode;
  pathFilter: string | null;
  /** Flags forwarded to tuicr verbatim (--theme, --appearance, -A, …). */
  passthrough: string[];
};
```

- [ ] **Step 4: Write the failing tests**

`src/args.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, UsageError } from "./args.ts";

test("no arguments means auto, launch, no filter", () => {
  assert.deepEqual(parseArgs([]), {
    action: "launch",
    mode: { kind: "auto" },
    pathFilter: null,
    passthrough: [],
  });
});

test("-w selects the working tree", () => {
  assert.deepEqual(parseArgs(["-w"]).mode, { kind: "working-tree" });
  assert.deepEqual(parseArgs(["--working-tree"]).mode, { kind: "working-tree" });
});

test("-r carries its revset verbatim", () => {
  assert.deepEqual(parseArgs(["-r", "main...HEAD"]).mode, {
    kind: "revset",
    revset: "main...HEAD",
  });
});

test("pr and its mr alias carry the target", () => {
  assert.deepEqual(parseArgs(["pr", "123"]).mode, { kind: "pr", target: "123" });
  assert.deepEqual(parseArgs(["mr", "u/r#7"]).mode, { kind: "pr", target: "u/r#7" });
});

test("--file carries the path", () => {
  assert.deepEqual(parseArgs(["--file", "docs/plan.md"]).mode, {
    kind: "file",
    path: "docs/plan.md",
  });
});

test("--since-last is its own mode", () => {
  assert.deepEqual(parseArgs(["--since-last"]).mode, { kind: "since-last" });
});

// Defect 1: `open-review -p src/` used to keep the auto path, which then
// rebuilt the argument array and dropped the filter, reviewing everything.
test("a path filter composes with auto instead of replacing it", () => {
  const intent = parseArgs(["-p", "src/"]);
  assert.deepEqual(intent.mode, { kind: "auto" });
  assert.equal(intent.pathFilter, "src/");
});

test("a path filter composes with every other mode", () => {
  const intent = parseArgs(["-w", "-p", "src/main.ts"]);
  assert.deepEqual(intent.mode, { kind: "working-tree" });
  assert.equal(intent.pathFilter, "src/main.ts");
});

// Defect 5: `${ARGS[i + 1]}` on the last index is an unbound variable under
// `set -u`, so this used to die with a bash error instead of a usage message.
test("a value flag in last position is a usage error", () => {
  assert.throws(() => parseArgs(["-w", "-p"]), UsageError);
  assert.throws(() => parseArgs(["-r"]), UsageError);
  assert.throws(() => parseArgs(["--file"]), UsageError);
});

test("two targets is a usage error", () => {
  assert.throws(() => parseArgs(["-w", "-r", "main..HEAD"]), UsageError);
});

test("actions are recognised", () => {
  assert.equal(parseArgs(["--plan"]).action, "plan");
  assert.equal(parseArgs(["--dry-run"]).action, "dry-run");
  assert.equal(parseArgs(["--exec"]).action, "exec");
  assert.equal(parseArgs(["-h"]).action, "help");
  assert.equal(parseArgs(["--help"]).action, "help");
});

test("unknown flags are forwarded to tuicr, with their values", () => {
  assert.deepEqual(parseArgs(["--theme", "tokyonight", "-A"]).passthrough, [
    "--theme",
    "tokyonight",
    "-A",
  ]);
});
```

- [ ] **Step 5: Run the tests to verify they fail**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test
```

Expected: every test fails with `Cannot find module './args.ts'`.

- [ ] **Step 6: Implement the parser**

`src/args.ts`:

```ts
import type { Action, Intent, Mode } from "./types.ts";

export class UsageError extends Error {}

/** Passthrough flags that consume the following argument. */
const PASSTHROUGH_WITH_VALUE = new Set(["--theme", "--appearance", "--repo-url"]);

export function parseArgs(argv: string[]): Intent {
  let action: Action = "launch";
  let mode: Mode | null = null;
  let pathFilter: string | null = null;
  const passthrough: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    const value = (): string => {
      const next = argv[i + 1];
      if (next === undefined) throw new UsageError(`${arg} needs a value`);
      i += 1;
      return next;
    };
    const target = (next: Mode): void => {
      if (mode) throw new UsageError(`two targets given: ${mode.kind} and ${next.kind}`);
      mode = next;
    };

    switch (arg) {
      case "-h":
      case "--help":
        action = "help";
        break;
      case "--plan":
        action = "plan";
        break;
      case "--dry-run":
        action = "dry-run";
        break;
      case "--exec":
        action = "exec";
        break;
      case "-w":
      case "--working-tree":
        target({ kind: "working-tree" });
        break;
      case "--since-last":
        target({ kind: "since-last" });
        break;
      case "-r":
      case "--revisions":
        target({ kind: "revset", revset: value() });
        break;
      case "--file":
        target({ kind: "file", path: value() });
        break;
      case "pr":
      case "mr":
        target({ kind: "pr", target: value() });
        break;
      case "-p":
      case "--path":
        pathFilter = value();
        break;
      default:
        passthrough.push(arg);
        if (PASSTHROUGH_WITH_VALUE.has(arg)) passthrough.push(value());
    }
  }

  return { action, mode: mode ?? { kind: "auto" }, pathFilter, passthrough };
}
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test
```

Expected: 12 pass, 0 fail.

- [ ] **Step 8: Commit**

```bash
cd ~/projects/dotfiles
git add .agents/skills/open-review/tsconfig.json .agents/skills/open-review/src
git commit -m "feat(open-review): parse arguments into an intent, in typescript"
```

---

### Task 2: Base choice, as a pure function

The base a branch was stacked on is often not `main`, and getting it wrong shows the parent branches' commits as if they were this branch's work. This task is the decision only — the facts it reads are gathered in Task 3.

**Files:**
- Modify: `.agents/skills/open-review/src/types.ts` (append)
- Create: `.agents/skills/open-review/src/base.ts`
- Test: `.agents/skills/open-review/src/base.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 but the file it appends to.
- Produces: `chooseBase(facts: RepoFacts): BaseChoice | null`, and the types `RefInfo`, `RefFacts`, `WorkTree`, `RepoFacts`, `BaseHow`, `BaseChoice`.

- [ ] **Step 1: Append the types**

Append to `src/types.ts`:

```ts
/** One ref, probed against HEAD. Everything git knows that a decision needs. */
export type RefInfo = {
  ref: string;
  /** null when the ref does not exist. */
  sha: string | null;
  /** null when the ref does not exist or shares no history with HEAD. */
  mergeBase: string | null;
  /** Commits in `ref..HEAD`; null when not computable. Equals the count from the merge-base. */
  distance: number | null;
};

export type RefFacts = {
  /** Verbatim start point from the branch's creation reflog: "master", "origin/master", "HEAD", or null. */
  reflogName: string | null;
  candidates: RefInfo[];
};

export type WorkTree = {
  staged: number;
  unstaged: number;
  untracked: string[];
  dirty: boolean;
};

export type RepoFacts = {
  root: string;
  /** Per-worktree, from --absolute-git-dir. Holds the plan file. */
  gitDir: string;
  /** Shared, from --git-common-dir. Holds the last-reviewed state. */
  commonDir: string;
  /** null when HEAD is detached. */
  branch: string | null;
  /** null when HEAD is unborn. */
  head: string | null;
  work: WorkTree;
  refs: RefFacts;
};

export type BaseHow =
  | "created-from reflog"
  | "nearest ancestor branch"
  | "fallback default branch";

export type BaseChoice = {
  ref: string;
  how: BaseHow;
  mergeBase: string;
  /** Commits between the merge-base and HEAD. */
  commits: number;
};
```

- [ ] **Step 2: Write the failing tests**

`src/base.test.ts`. The `facts` helper keeps each test to the refs it is about.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseBase } from "./base.ts";
import type { RefInfo, RepoFacts } from "./types.ts";

function ref(
  name: string,
  over: Partial<RefInfo> = {},
): RefInfo {
  // By default a true ancestor: its own tip is the merge-base.
  const sha = over.sha ?? `sha-${name}`;
  return { ref: name, sha, mergeBase: sha, distance: 3, ...over };
}

function facts(over: {
  branch?: string | null;
  reflogName?: string | null;
  candidates?: RefInfo[];
}): RepoFacts {
  return {
    root: "/repo",
    gitDir: "/repo/.git",
    commonDir: "/repo/.git",
    branch: over.branch ?? "feature",
    head: "sha-head",
    work: { staged: 0, unstaged: 0, untracked: [], dirty: false },
    refs: { reflogName: over.reflogName ?? null, candidates: over.candidates ?? [] },
  };
}

test("the creation reflog wins when its ref is usable", () => {
  const chosen = chooseBase(
    facts({ reflogName: "master", candidates: [ref("master"), ref("origin/old", { distance: 1 })] }),
  );
  assert.deepEqual(chosen, {
    ref: "master",
    how: "created-from reflog",
    mergeBase: "sha-master",
    commits: 3,
  });
});

// A local master behind its remote would place the base too far back and pull
// other people's commits into the range.
test("the reflog name is looked up remote-qualified first", () => {
  const chosen = chooseBase(
    facts({
      reflogName: "master",
      candidates: [ref("master", { distance: 9 }), ref("origin/master", { distance: 4 })],
    }),
  );
  assert.equal(chosen?.ref, "origin/master");
  assert.equal(chosen?.commits, 4);
});

test("a reflog naming the literal HEAD is discarded", () => {
  const chosen = chooseBase(
    facts({ reflogName: "HEAD", candidates: [ref("origin/master", { distance: 2 })] }),
  );
  assert.equal(chosen?.how, "nearest ancestor branch");
  assert.equal(chosen?.ref, "origin/master");
});

// The base advancing past the fork point is the normal state of a day-old
// branch: `master` is no longer an ancestor, but it still shares history and is
// still the right base. Defect 2 is what happens when this is mishandled.
test("a reflog ref that is no longer an ancestor is still accepted on shared history", () => {
  const chosen = chooseBase(
    facts({
      reflogName: "master",
      candidates: [ref("master", { sha: "sha-c3", mergeBase: "sha-c2", distance: 4 })],
    }),
  );
  assert.deepEqual(chosen, {
    ref: "master",
    how: "created-from reflog",
    mergeBase: "sha-c2",
    commits: 4,
  });
});

test("a ref sharing no history with HEAD is never chosen", () => {
  const chosen = chooseBase(
    facts({
      reflogName: "unrelated",
      candidates: [ref("unrelated", { mergeBase: null }), ref("main", { distance: 5 })],
    }),
  );
  assert.equal(chosen?.ref, "main");
});

test("the nearest true ancestor wins over a further one", () => {
  const chosen = chooseBase(
    facts({ candidates: [ref("master", { distance: 12 }), ref("parent-branch", { distance: 2 })] }),
  );
  assert.deepEqual(chosen, {
    ref: "parent-branch",
    how: "nearest ancestor branch",
    mergeBase: "sha-parent-branch",
    commits: 2,
  });
});

test("the branch itself, its remote and origin/HEAD are excluded", () => {
  const chosen = chooseBase(
    facts({
      branch: "feature",
      candidates: [
        ref("feature", { distance: 0 }),
        ref("origin/feature", { distance: 0 }),
        ref("origin/HEAD", { distance: 1 }),
        ref("master", { distance: 7 }),
      ],
    }),
  );
  assert.equal(chosen?.ref, "master");
});

test("a ref sitting on HEAD is a last resort, not a winner", () => {
  const onHead = ref("wip-backup", { distance: 0 });
  const behind = ref("master", { distance: 6 });
  assert.equal(chooseBase(facts({ candidates: [onHead, behind] }))?.ref, "master");
  const only = chooseBase(facts({ candidates: [onHead] }));
  assert.equal(only?.ref, "wip-backup");
  assert.equal(only?.commits, 0);
});

test("equal distances resolve lexicographically, so the answer is stable", () => {
  const chosen = chooseBase(
    facts({ candidates: [ref("zed", { distance: 4 }), ref("alpha", { distance: 4 })] }),
  );
  assert.equal(chosen?.ref, "alpha");
});

test("a ref that shares history without being an ancestor loses to a true ancestor", () => {
  const chosen = chooseBase(
    facts({
      candidates: [
        ref("master", { sha: "sha-c3", mergeBase: "sha-c2", distance: 2 }),
        ref("parent", { distance: 5 }),
      ],
    }),
  );
  assert.equal(chosen?.how, "nearest ancestor branch");
  assert.equal(chosen?.ref, "parent");
});

test("with no usable ancestor, the default branches are tried in a fixed order", () => {
  const chosen = chooseBase(
    facts({
      candidates: [
        ref("master", { sha: "sha-m", mergeBase: "sha-old", distance: 3 }),
        ref("origin/master", { sha: "sha-om", mergeBase: "sha-old", distance: 2 }),
      ],
    }),
  );
  assert.deepEqual(chosen, {
    ref: "origin/master",
    how: "fallback default branch",
    mergeBase: "sha-old",
    commits: 2,
  });
});

test("nothing usable at all yields null", () => {
  assert.equal(chooseBase(facts({ candidates: [] })), null);
  assert.equal(chooseBase(facts({ candidates: [ref("main", { sha: null, mergeBase: null })] })), null);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test src/base.test.ts
```

Expected: FAIL with `Cannot find module './base.ts'`.

- [ ] **Step 4: Implement the chooser**

`src/base.ts`:

```ts
import type { BaseChoice, RefInfo, RepoFacts } from "./types.ts";

const DEFAULT_BRANCHES = ["origin/main", "origin/master", "main", "master"];

/**
 * The base a branch was stacked on, resolved without a single network call.
 * Three rules in order: the branch's creation reflog, the nearest true
 * ancestor, then the conventional default branches.
 */
export function chooseBase(facts: RepoFacts): BaseChoice | null {
  const usable = facts.refs.candidates.filter(
    (candidate) =>
      candidate.sha !== null &&
      candidate.mergeBase !== null &&
      candidate.distance !== null &&
      !isSelf(candidate.ref, facts.branch),
  );
  const byRef = new Map(usable.map((candidate) => [candidate.ref, candidate]));

  const seeded = fromReflog(facts.refs.reflogName, byRef);
  if (seeded) return choice(seeded, "created-from reflog");

  const nearest = nearestAncestor(usable);
  if (nearest) return choice(nearest, "nearest ancestor branch");

  for (const name of DEFAULT_BRANCHES) {
    const hit = byRef.get(name);
    if (hit) return choice(hit, "fallback default branch");
  }
  return null;
}

function isSelf(ref: string, branch: string | null): boolean {
  return ref === "origin/HEAD" || (branch !== null && (ref === branch || ref === `origin/${branch}`));
}

/**
 * The reflog records a name, not a ref. Prefer its remote-tracking form: a
 * local branch left behind its remote would place the base too far back.
 * The literal "HEAD", recorded by a `git checkout -b` with no start point,
 * carries no information.
 */
function fromReflog(name: string | null, byRef: Map<string, RefInfo>): RefInfo | null {
  if (!name || name === "HEAD") return null;
  const candidates = name.startsWith("origin/") ? [name] : [`origin/${name}`, name];
  for (const candidate of candidates) {
    const hit = byRef.get(candidate);
    if (hit) return hit;
  }
  return null;
}

/**
 * A true ancestor is a ref whose own tip is the merge-base with HEAD. Refs
 * sitting exactly on HEAD are kept only as a last resort — they give a
 * brand-new branch a base to report without ever beating a real one.
 */
function nearestAncestor(candidates: RefInfo[]): RefInfo | null {
  const ancestors = candidates.filter((candidate) => candidate.mergeBase === candidate.sha);
  const sorted = [...ancestors].sort((left, right) => {
    const rank = (candidate: RefInfo) =>
      candidate.distance === 0 ? Number.MAX_SAFE_INTEGER : (candidate.distance as number);
    return rank(left) - rank(right) || left.ref.localeCompare(right.ref);
  });
  return sorted[0] ?? null;
}

function choice(info: RefInfo, how: BaseChoice["how"]): BaseChoice {
  return {
    ref: info.ref,
    how,
    mergeBase: info.mergeBase as string,
    commits: info.distance as number,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test
```

Expected: all pass (12 from Task 1, 12 here).

- [ ] **Step 6: Commit**

```bash
cd ~/projects/dotfiles
git add .agents/skills/open-review/src
git commit -m "feat(open-review): choose the base branch without any network call"
```

---

### Task 3: The git fact collector, tested against real repositories

Mocking git would let defect 2 through — a wrong revset produces plausible output under a fake. So this task's tests build real repositories in a temp directory and run the real collector.

**Files:**
- Create: `.agents/skills/open-review/src/git.ts`
- Create: `.agents/skills/open-review/src/testrepo.ts`
- Test: `.agents/skills/open-review/src/git.test.ts`

**Interfaces:**
- Consumes: `RepoFacts`, `RefInfo`, `WorkTree` from `types.ts`; `chooseBase` in the tests.
- Produces: `git(args, cwd)`, `gitOk(args, cwd)`, `collectFacts(cwd): RepoFacts | null`; and from `testrepo.ts`: `makeRepo(): Repo` with `{ dir, run, write, commit, cleanup }`.

- [ ] **Step 1: Write the fixture builder**

`src/testrepo.ts` — a helper, not a test file, so `node --test` never picks it up.

```ts
// Test-only helper. Builds throwaway git repositories so the fact collector is
// exercised against real git rather than a mock, which is the only way the
// revset arithmetic is actually under test.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

export type Repo = {
  dir: string;
  run: (...args: string[]) => string;
  write: (path: string, content: string) => void;
  commit: (message: string) => void;
  cleanup: () => void;
};

export function makeRepo(): Repo {
  const dir = mkdtempSync(join(tmpdir(), "open-review-"));
  const run = (...args: string[]): string =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();

  run("init", "-q", "-b", "master", ".");
  run("config", "user.email", "test@example.com");
  run("config", "user.name", "Test");

  return {
    dir,
    run,
    write(path, content) {
      const full = join(dir, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    },
    commit(message) {
      run("add", "-A");
      run("commit", "-q", "-m", message);
    },
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
```

- [ ] **Step 2: Write the failing tests**

`src/git.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { collectFacts } from "./git.ts";
import { chooseBase } from "./base.ts";
import { makeRepo } from "./testrepo.ts";

test("a branch off master resolves master as its base", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("b.txt", "b");
    repo.commit("f1");

    const facts = collectFacts(repo.dir);
    assert.ok(facts);
    assert.equal(facts.branch, "feature");
    assert.equal(facts.work.dirty, false);

    const base = chooseBase(facts);
    assert.equal(base?.ref, "master");
    assert.equal(base?.how, "created-from reflog");
    assert.equal(base?.commits, 1);
  } finally {
    repo.cleanup();
  }
});

test("a stacked branch resolves its parent branch, not master", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "parent", "master");
    repo.write("b.txt", "b");
    repo.commit("p1");
    repo.run("checkout", "-q", "-b", "child", "parent");
    repo.write("c.txt", "c");
    repo.commit("s1");

    const base = chooseBase(collectFacts(repo.dir)!);
    assert.equal(base?.ref, "parent");
    assert.equal(base?.commits, 1);
  } finally {
    repo.cleanup();
  }
});

// Defect 2: with the base tip as the diff endpoint, the commit that landed on
// master after the fork shows up inverted. The merge-base must be the fork
// point, and the commit count must not include it.
test("a base that advanced after the fork is frozen at the fork point", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    const forkPoint = repo.run("rev-parse", "HEAD");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("mine.txt", "mine");
    repo.commit("f1");
    repo.run("checkout", "-q", "master");
    repo.write("theirs.txt", "theirs");
    repo.commit("c2");
    repo.run("checkout", "-q", "feature");

    const base = chooseBase(collectFacts(repo.dir)!);
    assert.equal(base?.ref, "master");
    assert.equal(base?.mergeBase, forkPoint);
    assert.equal(base?.commits, 1, "only my commit is in the range");
  } finally {
    repo.cleanup();
  }
});

// The reflog records a bare name. If that name is taken literally while the
// local branch has fallen behind its remote, the base lands too far back and
// the range swallows commits that are not mine.
test("a reflog name is resolved to the remote when the local ref lagged behind", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    const behind = repo.run("rev-parse", "HEAD");
    repo.write("b.txt", "b");
    repo.commit("c2");
    // Both refs are at c2, as they would be right after a push.
    repo.run("update-ref", "refs/remotes/origin/master", "master");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("c.txt", "c");
    repo.commit("f1");
    // Now local master falls behind its remote, which is the state that breaks
    // a literal reading of the reflog.
    repo.run("update-ref", "refs/heads/master", behind);

    const facts = collectFacts(repo.dir)!;
    assert.equal(facts.refs.reflogName, "master", "the reflog names the local ref");
    const base = chooseBase(facts);
    assert.equal(base?.ref, "origin/master");
    assert.equal(base?.commits, 1, "taking local master literally would say 2");
  } finally {
    repo.cleanup();
  }
});

test("a plain checkout -b records HEAD, so the ancestor rule takes over", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature");
    repo.write("b.txt", "b");
    repo.commit("f1");

    const facts = collectFacts(repo.dir)!;
    assert.equal(facts.refs.reflogName, "HEAD");
    const base = chooseBase(facts);
    assert.equal(base?.ref, "master");
    assert.equal(base?.how, "nearest ancestor branch");
  } finally {
    repo.cleanup();
  }
});

test("a linked worktree reports its own root and the shared common dir", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    const linked = `${repo.dir}-wt`;
    repo.run("worktree", "add", "-q", linked, "-b", "wt", "master");
    repo.write("b.txt", "b");

    const facts = collectFacts(linked)!;
    assert.equal(facts.branch, "wt");
    assert.ok(facts.root.endsWith("-wt"));
    assert.notEqual(facts.gitDir, facts.commonDir);
    assert.equal(chooseBase(facts)?.ref, "master");
  } finally {
    repo.run("worktree", "remove", "--force", `${repo.dir}-wt`);
    repo.cleanup();
  }
});

test("a detached HEAD has no branch but still resolves a base", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("b.txt", "b");
    repo.commit("f1");
    repo.run("checkout", "-q", "--detach", "HEAD");

    const facts = collectFacts(repo.dir)!;
    assert.equal(facts.branch, null);
    assert.equal(facts.refs.reflogName, null);
    assert.ok(chooseBase(facts));
  } finally {
    repo.cleanup();
  }
});

test("an unborn HEAD reports no head and no candidates", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    const facts = collectFacts(repo.dir)!;
    assert.equal(facts.head, null);
    assert.deepEqual(facts.refs.candidates, []);
    assert.equal(facts.work.dirty, true);
    assert.deepEqual(facts.work.untracked, ["a.txt"]);
  } finally {
    repo.cleanup();
  }
});

test("the working tree is counted by category", () => {
  const repo = makeRepo();
  try {
    repo.write("tracked.txt", "one");
    repo.write("edited.txt", "one");
    repo.commit("c1");
    repo.write("tracked.txt", "two");
    repo.run("add", "tracked.txt");
    repo.write("edited.txt", "two");
    repo.write("new.txt", "new");

    const work = collectFacts(repo.dir)!.work;
    assert.equal(work.staged, 1);
    assert.equal(work.unstaged, 1);
    assert.deepEqual(work.untracked, ["new.txt"]);
    assert.equal(work.dirty, true);
  } finally {
    repo.cleanup();
  }
});

test("a path with a space survives status parsing", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    repo.write("with space.txt", "x");
    assert.deepEqual(collectFacts(repo.dir)!.work.untracked, ["with space.txt"]);
  } finally {
    repo.cleanup();
  }
});

test("outside a repository, collectFacts returns null", () => {
  assert.equal(collectFacts("/"), null);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test src/git.test.ts
```

Expected: FAIL with `Cannot find module './git.ts'`.

- [ ] **Step 4: Implement the collector**

`src/git.ts`:

```ts
import { execFileSync } from "node:child_process";
import type { RefInfo, RepoFacts, WorkTree } from "./types.ts";

const DEFAULT_BRANCHES = ["origin/main", "origin/master", "main", "master"];

export function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

/** Same, but a non-zero exit is an answer rather than an exception. */
export function gitOk(args: string[], cwd: string): string | null {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

export function collectFacts(cwd: string): RepoFacts | null {
  const root = gitOk(["rev-parse", "--show-toplevel"], cwd);
  if (root === null) return null;

  const gitDir = git(["rev-parse", "--absolute-git-dir"], cwd);
  const commonDir = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd);
  // symbolic-ref rather than abbrev-ref: a detached HEAD gets null instead of
  // the string "HEAD", which would then be treated as a branch name.
  const branch = gitOk(["symbolic-ref", "--quiet", "--short", "HEAD"], cwd);
  const head = gitOk(["rev-parse", "--verify", "HEAD"], cwd);
  const reflogName = head === null ? null : readReflogName(cwd, branch);

  return {
    root,
    gitDir,
    commonDir,
    branch,
    head,
    work: readWorkTree(cwd),
    refs: {
      reflogName,
      candidates: head === null ? [] : probeRefs(cwd, reflogName, head),
    },
  };
}

/** Porcelain v1 with NUL termination, so paths with spaces survive intact. */
function readWorkTree(cwd: string): WorkTree {
  const out = git(["status", "--porcelain", "-z", "--untracked-files=all"], cwd);
  let staged = 0;
  let unstaged = 0;
  const untracked: string[] = [];

  for (const entry of out.split("\0")) {
    if (entry.length < 4) continue;
    const code = entry.slice(0, 2);
    const path = entry.slice(3);
    if (code === "??") {
      untracked.push(path);
      continue;
    }
    if (code[0] !== " " && code[0] !== "?") staged += 1;
    if (code[1] !== " " && code[1] !== "?") unstaged += 1;
  }

  return {
    staged,
    unstaged,
    untracked,
    dirty: staged > 0 || unstaged > 0 || untracked.length > 0,
  };
}

/**
 * The oldest reflog entry of a branch names its start point:
 * "branch: Created from master". A `git checkout -b` with no start point
 * records the literal "HEAD"; it is returned as-is and discarded downstream.
 */
function readReflogName(cwd: string, branch: string | null): string | null {
  if (branch === null) return null;
  const log = gitOk(["reflog", "show", "--format=%gs", branch], cwd);
  if (!log) return null;
  const oldest = log.split("\n").at(-1) ?? "";
  const match = /^branch: Created from (.+)$/.exec(oldest);
  return match ? (match[1] as string) : null;
}

/**
 * The candidate set, in a deterministic order: what the reflog named, every
 * ref merged into HEAD, then the conventional defaults. Probing is two git
 * calls per candidate, over a handful of candidates — the old script ran up to
 * a hundred over an arbitrary window of the fifty most recent refs.
 */
function probeRefs(cwd: string, reflogName: string | null, head: string): RefInfo[] {
  const wanted: string[] = [];
  const add = (ref: string): void => {
    if (ref && !wanted.includes(ref)) wanted.push(ref);
  };

  if (reflogName && reflogName !== "HEAD") {
    if (!reflogName.startsWith("origin/")) add(`origin/${reflogName}`);
    add(reflogName);
  }
  const merged = gitOk(
    ["for-each-ref", "--merged", "HEAD", "--format=%(refname:short)", "refs/heads", "refs/remotes"],
    cwd,
  );
  for (const ref of (merged ?? "").split("\n")) add(ref.trim());
  for (const ref of DEFAULT_BRANCHES) add(ref);

  return wanted.map((ref) => probeRef(cwd, ref, head));
}

function probeRef(cwd: string, ref: string, head: string): RefInfo {
  const sha = gitOk(["rev-parse", "--verify", "-q", `${ref}^{commit}`], cwd);
  if (sha === null) return { ref, sha: null, mergeBase: null, distance: null };
  const mergeBase = gitOk(["merge-base", ref, head], cwd);
  if (mergeBase === null) return { ref, sha, mergeBase: null, distance: null };
  const count = gitOk(["rev-list", "--count", `${ref}..${head}`], cwd);
  return { ref, sha, mergeBase, distance: count === null ? null : Number(count) };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test
```

Expected: all pass. If the "local base behind its remote" test fails, read the fixture carefully — `update-ref` is used to place `origin/master` without a real remote, and the reflog assertion is the point of the test.

- [ ] **Step 6: Commit**

```bash
cd ~/projects/dotfiles
git add .agents/skills/open-review/src
git commit -m "feat(open-review): collect git facts and test them on real repos"
```

---

### Task 4: Target construction

This is the table from the spec, as code: what argv tuicr gets, and what revset the plan's diffstat must use so the two cannot disagree.

**Files:**
- Modify: `.agents/skills/open-review/src/types.ts` (append)
- Create: `.agents/skills/open-review/src/target.ts`
- Test: `.agents/skills/open-review/src/target.test.ts`

**Interfaces:**
- Consumes: `Intent` (Task 1), `RepoFacts`/`BaseChoice` (Task 2).
- Produces: `buildTarget(input: TargetInput): Target`, and the types `StatSpec`, `Target`, `LastReviewed`, `TargetInput`.

- [ ] **Step 1: Append the types**

Append to `src/types.ts`:

```ts
export type StatSpec =
  /** Arguments for `git diff`, before any path filter. */
  | { kind: "diff"; args: string[] }
  | { kind: "file"; path: string }
  | { kind: "none"; reason: string };

export type Target = {
  /** Human phrase for the plan's `mode:` line. */
  description: string;
  /** Full argv for tuicr, path filter and --no-update-check included. */
  tuicrArgs: string[];
  stat: StatSpec;
  /** Fallbacks and widenings to print, never applied silently. */
  notes: string[];
  /** Set when there is nothing to review; no popup is opened. */
  emptyReason: string | null;
};

export type LastReviewed = {
  sha: string;
  isAncestor: boolean;
  /** Commits in `sha..HEAD`. */
  commits: number;
};

export type TargetInput = {
  intent: Intent;
  facts: RepoFacts;
  base: BaseChoice | null;
  lastReviewed: LastReviewed | null;
};
```

- [ ] **Step 2: Write the failing tests**

`src/target.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test src/target.test.ts
```

Expected: FAIL with `Cannot find module './target.ts'`.

- [ ] **Step 4: Implement the builder**

`src/target.ts`:

```ts
import type { Intent, StatSpec, Target, TargetInput } from "./types.ts";

export function buildTarget(input: TargetInput): Target {
  const { intent } = input;
  switch (intent.mode.kind) {
    case "pr":
      return buildPrTarget(intent);
    case "file":
      return finish(intent, {
        description: `the file ${intent.mode.path}`,
        args: ["--file", intent.mode.path],
        stat: { kind: "file", path: intent.mode.path },
      });
    case "revset":
      return finish(intent, {
        description: intent.mode.revset,
        args: ["-r", intent.mode.revset],
        stat: { kind: "diff", args: [intent.mode.revset] },
      });
    case "working-tree":
      return workingTree(input);
    case "since-last":
      return sinceLast(input);
    case "auto":
      return auto(input, []);
  }
}

/**
 * The only target that needs no facts at all, which is why it is the one mode
 * that still works outside a git repository.
 */
export function buildPrTarget(intent: Intent): Target {
  if (intent.mode.kind !== "pr") throw new Error("buildPrTarget called with a non-pr intent");
  return finish(intent, {
    description: `pull request ${intent.mode.target}`,
    args: ["pr", intent.mode.target],
    stat: { kind: "none", reason: "pass-through, no local stat" },
  });
}

function workingTree(input: TargetInput): Target {
  if (!input.facts.work.dirty) {
    return empty(input, "the working tree is clean");
  }
  return finish(input.intent, {
    description: "the working tree",
    args: ["-w"],
    stat: { kind: "diff", args: ["HEAD"] },
    notes: ["-w covers staged, unstaged and untracked changes; tuicr has no staged-only mode"],
  });
}

function auto(input: TargetInput, notes: string[]): Target {
  const { facts, base } = input;
  const dirty = facts.work.dirty;

  if (base === null) {
    if (!dirty) return empty(input, "no base branch found and the working tree is clean");
    return finish(input.intent, {
      description: "the working tree",
      args: ["-w"],
      stat: { kind: "diff", args: ["HEAD"] },
      notes: [...notes, "no base branch could be resolved, so only the working tree is under review"],
    });
  }

  const range = `${base.mergeBase}..HEAD`;
  if (base.commits > 0 && dirty) {
    return finish(input.intent, {
      description: "the branch's commits plus the working tree",
      args: ["-r", range, "-w"],
      stat: { kind: "diff", args: [base.mergeBase] },
      notes,
    });
  }
  if (base.commits > 0) {
    return finish(input.intent, {
      description: "the branch's commits",
      args: ["-r", range],
      stat: { kind: "diff", args: [base.mergeBase, "HEAD"] },
      notes,
    });
  }
  if (dirty) {
    return finish(input.intent, {
      description: "the working tree",
      args: ["-w"],
      stat: { kind: "diff", args: ["HEAD"] },
      notes,
    });
  }
  return empty(
    input,
    `the working tree is clean and there are no commits since ${base.ref}`,
  );
}

function sinceLast(input: TargetInput): Target {
  const { facts, lastReviewed } = input;
  if (lastReviewed === null) {
    return auto(input, ["no previous review recorded for this branch — showing the whole branch"]);
  }
  if (!lastReviewed.isAncestor) {
    return auto(input, [
      "the last reviewed commit is no longer an ancestor of HEAD (rebased?) — showing the whole branch",
    ]);
  }
  const dirty = facts.work.dirty;
  if (lastReviewed.commits === 0 && !dirty) {
    return empty(input, "nothing new since the last review");
  }
  const range = `${lastReviewed.sha}..HEAD`;
  if (lastReviewed.commits > 0 && dirty) {
    return finish(input.intent, {
      description: "commits and working-tree changes since the last review",
      args: ["-r", range, "-w"],
      stat: { kind: "diff", args: [lastReviewed.sha] },
    });
  }
  if (lastReviewed.commits > 0) {
    return finish(input.intent, {
      description: "commits since the last review",
      args: ["-r", range],
      stat: { kind: "diff", args: [lastReviewed.sha, "HEAD"] },
    });
  }
  return finish(input.intent, {
    description: "working-tree changes since the last review",
    args: ["-w"],
    stat: { kind: "diff", args: ["HEAD"] },
  });
}

/**
 * Appends the path filter, the passthrough flags and --no-update-check. Takes
 * the intent rather than the whole input, so a pr target can be built with no
 * repository to gather facts from.
 */
function finish(
  intent: Intent,
  parts: { description: string; args: string[]; stat: StatSpec; notes?: string[] },
): Target {
  const { pathFilter, passthrough } = intent;
  const tuicrArgs = [...parts.args];
  if (pathFilter !== null) tuicrArgs.push("-p", pathFilter);
  tuicrArgs.push(...passthrough);
  // A version-check prompt inside a modal popup is a failure mode.
  tuicrArgs.push("--no-update-check");

  const description = pathFilter === null
    ? parts.description
    : `${parts.description}, filtered to ${pathFilter}`;

  return { description, tuicrArgs, stat: parts.stat, notes: parts.notes ?? [], emptyReason: null };
}

function empty(input: TargetInput, reason: string): Target {
  return {
    description: "nothing to review",
    tuicrArgs: [],
    stat: { kind: "none", reason },
    notes: [],
    emptyReason: reason,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd ~/projects/dotfiles
git add .agents/skills/open-review/src
git commit -m "feat(open-review): build the tuicr target and its matching stat revset"
```

---

### Task 5: Plan rendering

The plan is what the agent relays to the user, so its field order is fixed and its numbers come from the target's own `StatSpec`. Untracked files are listed rather than summarised: `git diff` cannot see them, but the review will.

**Files:**
- Modify: `.agents/skills/open-review/src/types.ts` (append)
- Create: `.agents/skills/open-review/src/plan.ts`
- Test: `.agents/skills/open-review/src/plan.test.ts`

**Interfaces:**
- Consumes: `Target` (Task 4), `RepoFacts`/`BaseChoice` (Task 2).
- Produces: `renderPlan(input: PlanInput): string`, and the types `ChurnRow`, `UntrackedRow`, `PlanInput`.

- [ ] **Step 1: Append the types**

Append to `src/types.ts`:

```ts
export type ChurnRow = { path: string; changed: number };
export type UntrackedRow = { path: string; lines: number };

export type PlanInput = {
  target: Target;
  facts: RepoFacts;
  base: BaseChoice | null;
  /** `git diff --shortstat` output, or null when there is no local stat. */
  shortstat: string | null;
  churn: ChurnRow[];
  untracked: UntrackedRow[];
};
```

- [ ] **Step 2: Write the failing tests**

`src/plan.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test src/plan.test.ts
```

Expected: FAIL with `Cannot find module './plan.ts'`.

- [ ] **Step 4: Implement the renderer**

`src/plan.ts`:

```ts
import type { PlanInput } from "./types.ts";

const CHURN_LIMIT = 10;

export function renderPlan(input: PlanInput): string {
  const { target, facts, base, shortstat, churn, untracked } = input;
  const lines: string[] = [`mode: ${target.description}`];

  if (base !== null) {
    lines.push(`base: ${base.ref} (${base.how}) frozen at ${base.mergeBase}`);
    lines.push(`commits: ${base.commits}    working tree: ${describeWork(facts)}`);
  } else {
    lines.push(`working tree: ${describeWork(facts)}`);
  }

  lines.push(`tuicr: ${target.tuicrArgs.join(" ")}`);

  switch (target.stat.kind) {
    case "none":
      lines.push(`stat: ${target.stat.reason}`);
      break;
    case "file": {
      const row = untracked.find((entry) => entry.path === target.stat.path);
      lines.push(`file: ${target.stat.path}${row ? ` (${row.lines} lines)` : ""}`);
      break;
    }
    case "diff":
      lines.push(`stat: ${shortstat?.trim() || "no textual changes"}`);
      break;
  }

  // git diff cannot see untracked files, but the review will — so list them
  // rather than reporting a count that says they are missing.
  if (target.stat.kind === "diff" && untracked.length > 0) {
    lines.push("untracked (not in the stat above):");
    for (const row of untracked) lines.push(`  ${String(row.lines).padStart(6)}  ${row.path}`);
  }

  if (churn.length > 0) {
    lines.push(`churn (added+deleted, top ${CHURN_LIMIT}):`);
    for (const row of churn.slice(0, CHURN_LIMIT)) {
      lines.push(`  ${String(row.changed).padStart(6)}  ${row.path}`);
    }
  }

  for (const note of target.notes) lines.push(`note: ${note}`);

  return lines.join("\n");
}

function describeWork(input: PlanInput["facts"]): string {
  const { staged, unstaged, untracked } = input.work;
  if (!input.work.dirty) return "clean";
  return `dirty (${staged} staged, ${unstaged} unstaged, ${untracked.length} untracked)`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd ~/projects/dotfiles
git add .agents/skills/open-review/src
git commit -m "feat(open-review): render a complete plan for every mode"
```

---

### Task 6: The plan file and the last-reviewed state

Two files with different lifetimes: the plan is per-worktree and per-launch, the last-reviewed state is shared and per-branch so it survives the worktree being deleted. Defect 4 — a stale plan printed as if fresh — is fixed by clearing before writing.

**Files:**
- Modify: `.agents/skills/open-review/src/types.ts` (append)
- Create: `.agents/skills/open-review/src/state.ts`
- Test: `.agents/skills/open-review/src/state.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseState`, `serializeState`, `readLastReviewed`, `writeLastReviewed`, `planPath`, `writePlan`, `clearPlan`, `awaitPlan`.

- [ ] **Step 1: Write the failing tests**

`src/state.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  awaitPlan,
  clearPlan,
  parseState,
  planPath,
  readLastReviewed,
  serializeState,
  writePlan,
  writeLastReviewed,
} from "./state.ts";

function dir(): string {
  return mkdtempSync(join(tmpdir(), "open-review-state-"));
}

test("state round-trips through parse and serialize", () => {
  const text = "feature\tabc123\t2026-08-07T10:00:00.000Z\nother\tdef456\t2026-08-06T10:00:00.000Z\n";
  const parsed = parseState(text);
  assert.equal(parsed.get("feature"), "abc123");
  assert.equal(parsed.get("other"), "def456");
  assert.equal(parseState(serializeState(parsed)).get("feature"), "abc123");
});

test("state parsing survives junk lines and a missing file", () => {
  const parsed = parseState("\ngarbage\nfeature\tabc123\t2026-08-07T10:00:00.000Z\n");
  assert.equal(parsed.size, 1);
  assert.equal(parsed.get("feature"), "abc123");
});

test("the last reviewed sha is read back per branch", () => {
  const common = dir();
  try {
    assert.equal(readLastReviewed(common, "feature"), null);
    writeLastReviewed(common, "feature", "abc123");
    writeLastReviewed(common, "other", "def456");
    assert.equal(readLastReviewed(common, "feature"), "abc123");
    assert.equal(readLastReviewed(common, "other"), "def456");
    writeLastReviewed(common, "feature", "999999");
    assert.equal(readLastReviewed(common, "feature"), "999999");
  } finally {
    rmSync(common, { recursive: true, force: true });
  }
});

test("a null branch has no state to read or write", () => {
  const common = dir();
  try {
    writeLastReviewed(common, null, "abc123");
    assert.equal(readLastReviewed(common, null), null);
    assert.equal(existsSync(join(common, "open-review.state")), false);
  } finally {
    rmSync(common, { recursive: true, force: true });
  }
});

// Defect 4: `exit 2` used to leave the previous run's plan on disk, and --plan
// printed it as if it described the review that never opened.
test("clearPlan removes a previous plan so it cannot be inherited", () => {
  const gitDir = dir();
  try {
    writeFileSync(planPath(gitDir), "stale plan from an earlier run");
    clearPlan(gitDir);
    assert.equal(existsSync(planPath(gitDir)), false);
    clearPlan(gitDir); // idempotent
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
  }
});

test("awaitPlan returns the plan once written", async () => {
  const gitDir = dir();
  try {
    writePlan(gitDir, "mode: the working tree");
    assert.equal(await awaitPlan(gitDir, 100), "mode: the working tree");
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
  }
});

test("awaitPlan gives up rather than hanging", async () => {
  const gitDir = dir();
  try {
    assert.equal(await awaitPlan(gitDir, 150), null);
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test src/state.test.ts
```

Expected: FAIL with `Cannot find module './state.ts'`.

- [ ] **Step 3: Implement the state module**

`src/state.ts`:

```ts
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Per-worktree, so two worktrees reviewing at once cannot overwrite each
 * other's plan.
 */
export function planPath(gitDir: string): string {
  return join(gitDir, "open-review.plan");
}

/**
 * Shared across worktrees, so the record of what was reviewed survives the
 * worktree being deleted.
 */
function statePath(commonDir: string): string {
  return join(commonDir, "open-review.state");
}

export function writePlan(gitDir: string, text: string): void {
  writeFileSync(planPath(gitDir), `${text}\n`);
}

export function clearPlan(gitDir: string): void {
  rmSync(planPath(gitDir), { force: true });
}

/**
 * The caller reads the plan right after backgrounding the launch, so the file
 * may be milliseconds away from existing. It can no longer be a previous run's
 * plan, because every launch clears it first.
 */
export async function awaitPlan(gitDir: string, timeoutMs = 3000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const path = planPath(gitDir);
    if (existsSync(path)) {
      const text = readFileSync(path, "utf8");
      if (text.trim().length > 0) return text.trimEnd();
    }
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export function parseState(text: string): Map<string, string> {
  const state = new Map<string, string>();
  for (const line of text.split("\n")) {
    const [branch, sha] = line.split("\t");
    if (branch && sha) state.set(branch, sha);
  }
  return state;
}

/**
 * Two fields, not three. An earlier draft stamped a timestamp per row, but
 * rewriting one branch restamped them all, so the column meant "last written"
 * rather than "last reviewed". Nothing reads it, so it is gone; parsing stays
 * tolerant of files that still have it.
 */
export function serializeState(state: Map<string, string>): string {
  return [...state].map(([branch, sha]) => `${branch}\t${sha}`).join("\n");
}

export function readLastReviewed(commonDir: string, branch: string | null): string | null {
  if (branch === null) return null;
  const path = statePath(commonDir);
  if (!existsSync(path)) return null;
  return parseState(readFileSync(path, "utf8")).get(branch) ?? null;
}

export function writeLastReviewed(commonDir: string, branch: string | null, head: string): void {
  if (branch === null) return;
  const path = statePath(commonDir);
  const state = existsSync(path) ? parseState(readFileSync(path, "utf8")) : new Map<string, string>();
  state.set(branch, head);
  writeFileSync(path, `${serializeState(state)}\n`);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd ~/projects/dotfiles
git add .agents/skills/open-review/src
git commit -m "feat(open-review): persist the plan and the last reviewed head"
```

---

### Task 7: Stat, churn, and a runnable `--dry-run` / `--plan`

The first task whose deliverable is a program. At the end of it, `node src/main.ts --dry-run` prints a real plan for the repository it runs in, and the defect-2 regression is verified end to end against a real repository.

**Files:**
- Modify: `.agents/skills/open-review/src/git.ts` (append)
- Create: `.agents/skills/open-review/src/main.ts`
- Test: `.agents/skills/open-review/src/main.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: `shortstat`, `numstat`, `countLines`, `isAncestor`, `commitsBetween` in `git.ts`; `resolve(cwd, argv): Resolution` and `main(argv, cwd)` in `main.ts`, where `Resolution = { facts, base, target, plan }`.

- [ ] **Step 1: Write the failing tests**

`src/main.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "./main.ts";
import { writeLastReviewed } from "./state.ts";
import { makeRepo } from "./testrepo.ts";

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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test src/main.test.ts
```

Expected: FAIL with `Cannot find module './main.ts'`.

- [ ] **Step 3: Append the git helpers**

Append the functions below to `src/git.ts`, and put the three new imports with
the existing `execFileSync` import at the top of the file rather than mid-file:

```ts
// -> to the top of src/git.ts, alongside the existing imports
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChurnRow, StatSpec, UntrackedRow } from "./types.ts";
```

```ts
/** The path filter is appended here so the stat and the popup always agree. */
function diffArgs(spec: Extract<StatSpec, { kind: "diff" }>, pathFilter: string | null): string[] {
  return pathFilter === null ? [...spec.args] : [...spec.args, "--", pathFilter];
}

export function shortstat(
  cwd: string,
  spec: Extract<StatSpec, { kind: "diff" }>,
  pathFilter: string | null,
): string {
  return gitOk(["diff", "--shortstat", ...diffArgs(spec, pathFilter)], cwd) ?? "";
}

export function numstat(
  cwd: string,
  spec: Extract<StatSpec, { kind: "diff" }>,
  pathFilter: string | null,
): ChurnRow[] {
  const out = gitOk(["diff", "--numstat", ...diffArgs(spec, pathFilter)], cwd) ?? "";
  const rows: ChurnRow[] = [];
  for (const line of out.split("\n")) {
    const [added, deleted, path] = line.split("\t");
    // "-" marks a binary file: no line counts to add up.
    if (!path || added === "-" || deleted === "-") continue;
    rows.push({ path, changed: Number(added) + Number(deleted) });
  }
  return rows.sort((left, right) => right.changed - left.changed || left.path.localeCompare(right.path));
}

export function countLines(cwd: string, path: string): UntrackedRow {
  try {
    const text = readFileSync(join(cwd, path), "utf8");
    const lines = text.length === 0 ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
    return { path, lines };
  } catch {
    return { path, lines: 0 };
  }
}

export function isAncestor(cwd: string, maybeAncestor: string, descendant: string): boolean {
  return gitOk(["merge-base", "--is-ancestor", maybeAncestor, descendant], cwd) !== null;
}

export function commitsBetween(cwd: string, from: string, to: string): number {
  const count = gitOk(["rev-list", "--count", `${from}..${to}`], cwd);
  return count === null ? 0 : Number(count);
}
```

- [ ] **Step 4: Implement main's resolution half**

`src/main.ts`:

```ts
import { parseArgs, UsageError } from "./args.ts";
import { chooseBase } from "./base.ts";
import {
  collectFacts,
  commitsBetween,
  countLines,
  isAncestor,
  numstat,
  shortstat,
} from "./git.ts";
import { renderPlan } from "./plan.ts";
import { awaitPlan, clearPlan, readLastReviewed, writePlan } from "./state.ts";
import { buildPrTarget, buildTarget } from "./target.ts";
import { EXIT } from "./constants.ts";
import type { Action, BaseChoice, LastReviewed, RepoFacts, Target } from "./types.ts";

export type Resolution = {
  facts: RepoFacts;
  base: BaseChoice | null;
  target: Target;
  plan: string;
};

/**
 * Everything up to, but not including, side effects on the terminal.
 *
 * `known` lets a caller that has already collected the facts hand them over:
 * collecting costs ~0.6 s on a large repository, and `main` needs them before
 * it can clear the plan file, so collecting twice would double the wait before
 * the popup appears. Tests omit it and let it collect.
 */
export function resolve(cwd: string, argv: string[], known?: RepoFacts): Resolution {
  const intent = parseArgs(argv);
  const facts = known ?? collectFacts(cwd);
  if (facts === null) throw new Error("not a git repository");

  const base = facts.head === null ? null : chooseBase(facts);
  const target = buildTarget({
    intent,
    facts,
    base,
    lastReviewed: readLastReviewedState(cwd, facts),
  });

  const { pathFilter } = intent;
  const spec = target.stat;
  const plan = renderPlan({
    target,
    facts,
    base,
    shortstat: spec.kind === "diff" ? shortstat(cwd, spec, pathFilter) : null,
    churn: spec.kind === "diff" ? numstat(cwd, spec, pathFilter) : [],
    untracked:
      spec.kind === "file"
        ? [countLines(cwd, spec.path)]
        : facts.work.untracked.map((path) => countLines(cwd, path)),
  });

  return { facts, base, target, plan };
}

function readLastReviewedState(cwd: string, facts: RepoFacts): LastReviewed | null {
  if (facts.head === null) return null;
  const sha = readLastReviewed(facts.commonDir, facts.branch);
  if (sha === null) return null;
  const ancestor = isAncestor(cwd, sha, "HEAD");
  return {
    sha,
    isAncestor: ancestor,
    commits: ancestor ? commitsBetween(cwd, sha, "HEAD") : 0,
  };
}

const USAGE = `open-review — open a tuicr review in a tmux popup

  open-review                 auto: this branch's commits and/or working tree
  open-review --since-last    only what changed since the last review
  open-review -w              the working tree (staged, unstaged, untracked)
  open-review -r <revset>     an explicit range
  open-review pr <n|url>      a pull request, passed through
  open-review --file <path>   a document, no VCS needed
  open-review ... -p <path>   filter to a file or directory

  open-review --plan          print the plan of the launch in flight
  open-review --dry-run       resolve and print, no popup
  open-review --exec          resolve, then exec tuicr in place (tmux binding)`;

export async function main(argv: string[], cwd: string): Promise<number> {
  let intent;
  try {
    intent = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`open-review: ${error.message}\n\n${USAGE}\n`);
      return EXIT.error;
    }
    throw error;
  }

  if (intent.action === "help") {
    process.stdout.write(`${USAGE}\n`);
    return EXIT.ok;
  }

  if (intent.action === "plan") {
    const facts = collectFacts(cwd);
    if (facts === null) {
      process.stderr.write("open-review: not a git repository\n");
      return EXIT.error;
    }
    const plan = await awaitPlan(facts.gitDir);
    if (plan === null) {
      process.stderr.write("open-review: no plan yet — run open-review first\n");
      return EXIT.error;
    }
    process.stdout.write(`${plan}\n`);
    return EXIT.ok;
  }

  const facts = collectFacts(cwd);
  // Every launch clears the plan before resolving, so --plan can never inherit
  // a previous run's answer.
  if (facts !== null) clearPlan(facts.gitDir);

  if (facts === null) {
    // pr is the one mode that needs no checkout — `tuicr pr <url>` resolves
    // from anywhere — and the one mode with no local plan to print.
    if (intent.mode.kind !== "pr") {
      process.stderr.write("open-review: not a git repository\n");
      return EXIT.error;
    }
    const target = buildPrTarget(intent);
    process.stdout.write(
      `mode: ${target.description}\ntuicr: ${target.tuicrArgs.join(" ")}\nstat: pass-through, no local stat\n`,
    );
    // Same short-circuit as the with-facts path below: --dry-run resolves and
    // prints, and must never reach the popup. `launch` only special-cases
    // "exec", so without this a dry run outside a repository would open one.
    if (intent.action === "dry-run") return EXIT.ok;
    return await launch(cwd, target, null, intent.action);
  }

  // Hand over the facts already collected above rather than paying for them twice.
  const resolution = resolve(cwd, argv, facts);
  process.stdout.write(`${resolution.plan}\n`);

  if (resolution.target.emptyReason !== null) {
    process.stderr.write(`open-review: nothing to review — ${resolution.target.emptyReason}\n`);
    return EXIT.nothing;
  }

  writePlan(facts.gitDir, resolution.plan);
  if (intent.action === "dry-run") {
    clearPlan(facts.gitDir);
    return EXIT.ok;
  }

  return await launch(facts.root, resolution.target, facts, intent.action);
}

/**
 * The popup and the read-back. A stub until Task 9 — `facts` is null only on
 * the repository-less pr path, which has no state to record.
 */
async function launch(
  root: string,
  target: Target,
  facts: RepoFacts | null,
  action: Action,
): Promise<number> {
  return EXIT.ok;
}

if (process.argv[1]?.endsWith("main.ts")) {
  process.exitCode = await main(process.argv.slice(2), process.cwd());
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test
```

Expected: all pass.

- [ ] **Step 6: Run it against this repository, by hand**

```bash
cd ~/projects/dotfiles && node .agents/skills/open-review/src/main.ts --dry-run
```

Expected: a plan naming a base, a commit count, the tuicr argv, a stat and a churn list — or `nothing to review` with exit 2 on a clean checkout. Compare it against the old script's answer, which is still installed:

```bash
cd ~/projects/dotfiles && ~/.agents/skills/open-review/open-review --dry-run
```

The bases should agree. If they do not, the new answer is the one to trust — but read the `base:` line's parenthesised rule before concluding, and if the new one is wrong, that is a `FAILURES.md` entry and a test.

- [ ] **Step 7: Commit**

```bash
cd ~/projects/dotfiles
git add .agents/skills/open-review/src
git commit -m "feat(open-review): resolve and print a plan end to end"
```

---

### Task 8: Session election and the comment index

Defect 9: which review the comments came from is currently guessed by the model from timestamps and comment counts. The wrapper opened the review, so it can observe the answer — snapshot the sessions before, snapshot after, and the one that moved is the one.

**Files:**
- Modify: `.agents/skills/open-review/src/types.ts` (append)
- Create: `.agents/skills/open-review/src/session.ts`
- Test: `.agents/skills/open-review/src/session.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `electSession(before: SessionRow[], after: SessionRow[]): SessionRow | null`, `renderCommentIndex(comments: Comment[]): string`, and the types `SessionRow`, `Comment`.

- [ ] **Step 1: Append the types**

Append to `src/types.ts`. The field names are `tuicr review list`'s own, verified against its output.

```ts
export type SessionRow = {
  slug: string;
  kind: string;
  path: string;
  updated_at: string;
  comment_count: number;
};

export type Comment = {
  location: string;
  path: string | null;
  start_line: number | null;
  end_line: number | null;
  side: string;
  comment_type: string;
  content: string;
};
```

- [ ] **Step 2: Write the failing tests**

`src/session.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test src/session.test.ts
```

Expected: FAIL with `Cannot find module './session.ts'`.

- [ ] **Step 4: Implement the module**

`src/session.ts`:

```ts
import type { Comment, SessionRow } from "./types.ts";

const INDEX_WIDTH = 80;

/**
 * The session this launch touched, deduced rather than guessed: tuicr writes
 * its session file at startup, so the review that just happened is the one
 * that appeared or whose updated_at moved.
 */
export function electSession(before: SessionRow[], after: SessionRow[]): SessionRow | null {
  const seen = new Map(before.map((row) => [row.path, row.updated_at]));
  const moved = after.filter((row) => seen.get(row.path) !== row.updated_at);
  const sorted = [...moved].sort(newestFirst);
  return sorted[0] ?? null;
}

/**
 * Newest first, by parsed instant rather than by string.
 *
 * tuicr writes microsecond precision with a numeric offset
 * (`2026-08-05T14:02:21.603027+00:00`). Comparing those as strings only happens
 * to work while every row has identical field widths: a variable-width fraction
 * followed by `Z` inverts the order, since `Z` sorts above the digits and
 * `…21.6Z` would then outrank `…21.6003Z`. `localeCompare` is worse again —
 * collations may treat punctuation as variable weight.
 *
 * Date.parse truncates to milliseconds, so the raw string breaks ties below
 * that, and the path breaks the remaining ties so the answer never depends on
 * the order the caller happened to pass.
 */
function newestFirst(left: SessionRow, right: SessionRow): number {
  const byInstant = Date.parse(right.updated_at) - Date.parse(left.updated_at);
  if (byInstant !== 0 && !Number.isNaN(byInstant)) return byInstant;
  if (right.updated_at !== left.updated_at) return right.updated_at < left.updated_at ? -1 : 1;
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
}

export function renderCommentIndex(comments: Comment[]): string {
  if (comments.length === 0) return "(no comments)";
  return comments.map((comment) => `${anchor(comment)} — ${excerpt(comment.content)}`).join("\n");
}

function anchor(comment: Comment): string {
  if (comment.path === null) return "(review)";
  const side = comment.side === "old" ? " (old side)" : "";
  if (comment.start_line === null) return comment.path;
  const range =
    comment.end_line !== null && comment.end_line !== comment.start_line
      ? `${comment.start_line}-${comment.end_line}`
      : String(comment.start_line);
  return `${comment.path}:${range}${side}`;
}

function excerpt(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length <= INDEX_WIDTH ? flat : `${flat.slice(0, INDEX_WIDTH)}…`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd ~/projects/dotfiles
git add .agents/skills/open-review/src
git commit -m "feat(open-review): elect the review session instead of guessing it"
```

---

### Task 9: Launch, survive Escape, read the comments back

Defect 7 is the one that loses work: `display-popup -E` dismisses on Escape, which SIGHUPs tuicr and makes the blocking call return, so the agent reads back a review the user was still writing. The fix is to stop owning the process — `~/scripts/tmux-popup` puts tuicr in its own session — and to wait for that session to die rather than for the popup to close.

**Files:**
- Create: `.agents/skills/open-review/src/tmux.ts`
- Create: `.agents/skills/open-review/src/tuicr.ts`
- Modify: `.agents/skills/open-review/src/main.ts`
- Test: `.agents/skills/open-review/src/tuicr.test.ts`

**Interfaces:**
- Consumes: `POPUP_SESSION`/`EXIT` (Task 1), `electSession`/`renderCommentIndex` (Task 8), `resolve` (Task 7), `writeLastReviewed` (Task 6).
- Produces: `insideTmux()`, `popupAlive()`, `openPopup(root, tuicrArgs)`, `waitForPopupGone()` in `tmux.ts`; `listSessions()`, `readComments(path)`, `parseSessionList(text)` in `tuicr.ts`.

- [ ] **Step 1: Write the failing tests**

Only the parsing is testable without a terminal; the rest is verified by hand in Step 6. `src/tuicr.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSessionList } from "./tuicr.ts";

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
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test src/tuicr.test.ts
```

Expected: FAIL with `Cannot find module './tuicr.ts'`.

- [ ] **Step 3: Implement the tuicr adapter**

`src/tuicr.ts`:

```ts
import { execFileSync } from "node:child_process";
import type { Comment, SessionRow } from "./types.ts";

function run(args: string[]): string {
  try {
    return execFileSync("tuicr", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}

export function parseSessionList(text: string): SessionRow[] {
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as SessionRow[]) : [];
  } catch {
    return [];
  }
}

/** --all rather than --repo: PR sessions and sessions outside a checkout count. */
export function listSessions(): SessionRow[] {
  return parseSessionList(run(["review", "list", "--all"]));
}

/** A session path is a JSON file and resolves with no --repo, from anywhere. */
export function readComments(sessionPath: string): Comment[] {
  const parsed: unknown = (() => {
    try {
      return JSON.parse(run(["review", "comments", "--session", sessionPath]));
    } catch {
      return null;
    }
  })();
  return Array.isArray(parsed) ? (parsed as Comment[]) : [];
}
```

- [ ] **Step 4: Implement the tmux adapter**

`src/tmux.ts`:

```ts
import { execFileSync, spawnSync } from "node:child_process";
import { POPUP_NAME, POPUP_SESSION } from "./constants.ts";

export function insideTmux(): boolean {
  return Boolean(process.env["TMUX"]);
}

export function popupAlive(): boolean {
  return spawnSync("tmux", ["has-session", "-t", POPUP_SESSION], { stdio: "ignore" }).status === 0;
}

/**
 * Two layers, and both matter. display-popup dismisses on Escape — the key a
 * vim-mode TUI uses constantly — so tuicr must not be the popup's own process:
 * ~/scripts/tmux-popup runs it in a separate session and only attaches a
 * client. Dismissing then costs the client, not the review, and `prefix + R`
 * reattaches to the same session.
 */
export function openPopup(root: string, tuicrArgs: string[]): void {
  const inner = ["~/scripts/tmux-popup", "--kill", POPUP_NAME, "tuicr", ...tuicrArgs]
    .map(shellQuote)
    .join(" ");
  execFileSync(
    "tmux",
    [
      "display-popup",
      "-d", root,
      "-T", " tuicr (C-q close)",
      "-w", "95%",
      "-h", "95%",
      "-E", inner,
    ],
    { stdio: "inherit" },
  );
}

/** The honest end of a review: the session is gone, which means C-q. */
export async function waitForPopupGone(pollMs = 300): Promise<void> {
  while (popupAlive()) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/** tmux-popup flattens its command with `CMD="$*"`, so quote before handing over. */
function shellQuote(word: string): string {
  if (word.startsWith("~/")) return word; // must stay unquoted to expand
  return /^[A-Za-z0-9_./=:-]+$/.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`;
}
```

- [ ] **Step 5: Fill in main's launch stub**

Add these imports to the top of `src/main.ts`:

```ts
import { execFileSync } from "node:child_process";
import { electSession, renderCommentIndex } from "./session.ts";
import { insideTmux, openPopup, popupAlive, waitForPopupGone } from "./tmux.ts";
import { listSessions, readComments } from "./tuicr.ts";
```

Add `writeLastReviewed` to the existing `./state.ts` import, then replace the
whole `launch` stub written in Task 7 with:

```ts
/**
 * The popup and the read-back. `facts` is null only on the repository-less pr
 * path, which has no state to record.
 */
async function launch(
  root: string,
  target: Target,
  facts: RepoFacts | null,
  action: Action,
): Promise<number> {
  if (action === "exec") {
    // The tmux binding's path: the human owns the popup, so there is nothing
    // to wait for and nothing to read back.
    execFileSync("tuicr", target.tuicrArgs, { stdio: "inherit" });
    return EXIT.ok;
  }

  if (!insideTmux()) {
    process.stderr.write(
      `open-review: not inside tmux — run 'tuicr ${target.tuicrArgs.join(" ")}' directly\n`,
    );
    return EXIT.error;
  }

  // tmux-popup attaches an existing session and ignores the command it was
  // given, so a live review would silently stand in for the requested one.
  if (popupAlive()) {
    process.stderr.write(
      "open-review: a review is already open — close it with C-q, or reattach with prefix + R\n",
    );
    return EXIT.busy;
  }

  const before = listSessions();
  openPopup(root, target.tuicrArgs);
  await waitForPopupGone();

  const elected = electSession(before, listSessions());
  if (facts !== null && facts.head !== null) {
    writeLastReviewed(facts.commonDir, facts.branch, facts.head);
  }

  if (elected === null || elected.comment_count === 0) {
    process.stdout.write("open-review: review closed with no comments\n");
    return EXIT.noComments;
  }

  const comments = readComments(elected.path);
  process.stdout.write(`session: ${elected.slug}\n`);
  process.stdout.write(`${renderCommentIndex(comments)}\n\n`);
  process.stdout.write(`comments (json):\n${JSON.stringify(comments, null, 2)}\n`);
  return EXIT.ok;
}
```

- [ ] **Step 6: Run the tests, then verify the popup by hand**

```bash
cd ~/projects/dotfiles/.agents/skills/open-review && node --test
```

Expected: all pass.

Then, from a tmux pane in a repository with uncommitted changes, run each of these and record the result. These are the spec's pending checks 10–13; they cannot be automated because they are about keystrokes.

```bash
cd ~/projects/dotfiles && node .agents/skills/open-review/src/main.ts -w
```

| Check | Expectation |
| --- | --- |
| Press Escape while writing a comment | Popup dismisses, `tmux has-session -t _popup_tuicr` still succeeds, `prefix + R` reattaches with the comment intact, the command has not returned |
| Press `C-q` | Session dies, the command returns, the index and the JSON are printed |
| Close having saved nothing | `review closed with no comments`, exit 3 (`echo $?`) |
| Launch a second one while the first is open | `a review is already open`, exit 4, the running review untouched |

- [ ] **Step 7: Commit**

```bash
cd ~/projects/dotfiles
git add .agents/skills/open-review/src
git commit -m "feat(open-review): launch in a dedicated session and read the comments back"
```

---

### Task 10: Cut over — the shim, and the tmux binding

Until this task the old bash script is what `~/.agents/skills/open-review/open-review` runs, so a review launched mid-implementation still works. This is where that changes.

**Files:**
- Modify: `.agents/skills/open-review/open-review` (replace the bash implementation with the shim)
- Modify: `.tmux.conf:112`

**Interfaces:**
- Consumes: `src/main.ts` (Task 9).
- Produces: the `~/.agents/skills/open-review/open-review` entry point, unchanged in name and calling convention.

- [ ] **Step 1: Replace the script with the shim**

Overwrite `.agents/skills/open-review/open-review` entirely:

```bash
#!/bin/bash
# Entry point for the open-review skill. The logic lives in src/main.ts; this
# only finds a node to run it with.
#
# `#!/usr/bin/env node` would not do: mise publishes its PATH from .zshrc, and
# ~/scripts/tmux-popup deliberately skips the login shell, so a popup gets a
# PATH with no node in it. The mise shim works with no activation.
#
# Agent contract:
#   1. run this in the background — it blocks until the review is finished and
#      prints the comments when it is
#   2. then `--plan` to read back what was opened
set -uo pipefail

here=$(cd -- "$(dirname -- "$0")" && pwd)

for node in node "$HOME/.local/share/mise/shims/node" /opt/homebrew/bin/node; do
	if command -v "$node" >/dev/null 2>&1; then
		exec "$node" "$here/src/main.ts" "$@"
	fi
done

echo "open-review: no node found (tried PATH, mise shims, /opt/homebrew/bin)" >&2
exit 1
```

- [ ] **Step 2: Verify the shim in a stripped environment**

```bash
env -i HOME="$HOME" TERM=xterm /bin/bash -c \
  'cd ~/projects/dotfiles && ~/.agents/skills/open-review/open-review --help'
```

Expected: the usage text. This is the environment the tmux popup runs in — if it prints `no node found`, the mise shim path is wrong and the binding in Step 3 would break.

- [ ] **Step 3: Point the tmux binding at it**

In `.tmux.conf`, line 112 currently reads:

```tmux
bind R display-popup -T " tuicr (C-q close)" -w 90% -h 90% -d '#{pane_current_path}' -E '~/scripts/tmux-popup --kill tuicr tuicr -w'
```

Replace the inner command so the manual review gets the same base detection, and the script's "nothing to review" message instead of tuicr's bare `Error: No changes to review`:

```tmux
bind R display-popup -T " tuicr (C-q close)" -w 90% -h 90% -d '#{pane_current_path}' -E '~/scripts/tmux-popup --kill tuicr ~/.agents/skills/open-review/open-review --exec'
```

- [ ] **Step 4: Verify by hand**

```bash
tmux source-file ~/.tmux.conf
```

| Check | Expectation |
| --- | --- |
| `prefix + R` in a dirty repo | tuicr opens on the resolved target |
| `prefix + R` in a clean repo | The script's `nothing to review` message, not tuicr's raw error |
| `prefix + R` while an agent review is open | Reattaches to that review rather than starting another |
| `~/.agents/skills/open-review/open-review --dry-run` | Same plan as `node src/main.ts --dry-run` |

- [ ] **Step 5: Commit**

```bash
cd ~/projects/dotfiles
git add .agents/skills/open-review/open-review .tmux.conf
git commit -m "refactor(open-review): replace the bash script with a node shim"
```

---

### Task 11: The skill documents

`SKILL.md` is loaded into an agent's context on every use, so what it stops saying matters as much as what it says: the base-detection explanation goes because the plan now explains itself, and session discovery goes because the script owns it.

**Files:**
- Modify: `.agents/skills/open-review/SKILL.md` (rewrite)
- Create: `.agents/skills/open-review/FAILURES.md`
- Modify: `.agents/skills/tuicr/SKILL.md` (trim)

**Interfaces:**
- Consumes: the exit codes and entry table as implemented.
- Produces: nothing code-facing.

- [ ] **Step 1: Rewrite SKILL.md**

Keep the frontmatter's `name` and `description` exactly as they are — the description is what routes a request to this skill. Replace the body:

````markdown
# Open a tuicr review in a tmux popup

## Launch it — one Bash call, `run_in_background: true`

```bash
~/.agents/skills/open-review/open-review
```

The script resolves the base, refuses to open an empty diff, opens the popup,
waits for the review to actually finish, and **prints the comments when it
does**. Do not run git commands first to work any of that out.

Pass a target only when the user named one:

| They said | Call |
| --- | --- |
| nothing (default) | `open-review` |
| just what changed since you last looked | `open-review --since-last` |
| the uncommitted work | `open-review -w` |
| a specific range | `open-review -r <base>..<branch>` |
| a pull request | `open-review pr <number>` |
| a document, a plan, a spec | `open-review --file <path>` |
| one file or directory | append `-p <path>` to any of the above |

`-w` is also the answer for "just the staged changes": tuicr has no staged-only
mode, and the plan says so.

## Then report what you opened

Second call, foreground:

```bash
~/.agents/skills/open-review/open-review --plan
```

Prints the resolved base and the rule that found it, the commit count, the argv,
the diffstat and the ten files with the most churn. Relay the target and the
size to the user, and use the churn list to say which files deserve their
attention most. The plan is written before the popup launches, so this cannot
race the launch.

If the base looks wrong, override it with `-r` rather than arguing with it — and
write it up (see below).

## While it is open

The popup is modal, so the user cannot reply until they dismiss it. Escape only
dismisses the popup: the review survives and `prefix + R` reattaches. **The
background task completing is the signal that the review is finished** — do not
poll, and do not ask the user to announce it.

## What the task returns

| exit | meaning | what to do |
| --- | --- | --- |
| 0 | comments printed — an index, then the JSON | invoke `superpowers:receiving-code-review` and work through them |
| 2 | nothing to review, no popup opened | say so; do not retry with a different target unless the user asks |
| 3 | review closed with no comments | say so plainly; do not guess what they meant |
| 4 | a review is already open | tell the user to close it with `C-q` or reattach with `prefix + R` |
| 1 | error — the message says which | relay it |

There is no session to go looking for: the script elected it and printed its
comments. The `tuicr` skill is only for the case where the user opened the popup
themselves.

## When the target was wrong

If the user says the diff is not what they asked for, that is a defect in the
resolution, not a one-off. Append an entry to `FAILURES.md` next to this file —
the invocation, the plan as it was printed, what they expected, the cause — then
**write the failing test** in `src/*.test.ts` before fixing it. If it cannot be
fixed on the spot, add a caveat line below, because `FAILURES.md` is not loaded
on every use.

## Caveats

- `pr` is a pass-through: no local diffstat, no churn.
- `--since-last` can show a chunk twice, if the uncommitted work you reviewed
  was then committed unchanged.
````

- [ ] **Step 2: Create FAILURES.md**

```markdown
# open-review — resolution failures

One entry per time the target came out wrong. The loop closes on a test, not on
prose: write the entry, write the failing test, then fix.

Not loaded on every use — it grows by one entry per failure. An entry that is
not fixed immediately gets a caveat line in `SKILL.md`, or the knowledge is
buried here where nothing reads it.

## Template

### YYYY-MM-DD — one-line summary

- **Invoked:** `open-review …`
- **Plan printed:**
  ```
  mode: …
  base: … (…) frozen at …
  ```
- **Expected instead:** …
- **Cause:** …
- **Test:** `src/<module>.test.ts` — "<test name>"
- **Status:** fixed | open (caveat added to SKILL.md)
```

- [ ] **Step 3: Trim the tuicr skill**

In `.agents/skills/tuicr/SKILL.md`, the "Step 1 — find the session" section
describes discovery heuristics that `open-review` now owns. Keep the section —
it still applies when the user opened the popup with `prefix + R` — but add this
sentence at its top, before the `tuicr review list --repo .` block:

```markdown
This applies only when the user opened the popup themselves (`prefix + R`). If
an agent launched it with the `open-review` skill, that script already elected
the session and printed the comments — read those instead of listing again.
```

- [ ] **Step 4: Verify the skill still loads**

```bash
head -4 ~/.agents/skills/open-review/SKILL.md
```

Expected: the unchanged frontmatter with `name: open-review` and the original
`description:` line. If the description changed, requests will stop routing here.

- [ ] **Step 5: Commit**

```bash
cd ~/projects/dotfiles
git add .agents/skills/open-review/SKILL.md .agents/skills/open-review/FAILURES.md .agents/skills/tuicr/SKILL.md
git commit -m "docs(open-review): rewrite the skill around the script's new contract"
```

---

### Task 12: doctor.sh and AGENTS.md

Every check in `doctor.sh` corresponds to something that was found broken silently. Three more qualify: a shim that cannot find node fails only inside a popup, where nobody sees the message; a broken decision function fails only as a wrong diff; and a type error fails not at all until it reaches a branch nobody tested.

**Files:**
- Modify: `scripts/doctor.sh`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: the test suite and the shim.
- Produces: nothing code-facing.

- [ ] **Step 1: Add the section**

The file defines `section`, `ok`, `warn` and `fail` helpers and runs from the
repo root. Insert this after the `section "Worktrees"` block and before the
`if ! $QUICK; then` line — both checks together take ~150 ms, so they run even
under `--quick`.

```bash
# --------------------------------------------------------------------------
section "open-review"
# The skill's decisions live in TypeScript so a wrong target can be pinned by a
# test instead of being rediscovered. A silent regression here shows up only as
# a review of the wrong diff.
if [[ -d .agents/skills/open-review/src ]]; then
  if ! command -v node >/dev/null; then
    warn "node not on PATH -- cannot run the open-review tests"
  # A directory argument does not work: `node --test <dir>` tries to run the
  # directory as a module. Hence the subshell cd.
  elif (cd .agents/skills/open-review && node --test >/dev/null 2>&1); then
    ok "open-review tests pass"
  else
    fail "open-review tests fail -- run: (cd .agents/skills/open-review && node --test)"
  fi

  # The popup starts its command without a login shell, so mise's PATH is
  # absent and the shim has to fall back to the mise shim path. This is the
  # environment that broke, and it is invisible from an interactive shell.
  if env -i HOME="$HOME" /bin/bash -c \
    '"$HOME"/.agents/skills/open-review/open-review --help' >/dev/null 2>&1; then
    ok "the open-review shim finds node with no PATH"
  else
    fail "the open-review shim cannot find node in a bare environment -- check ~/.local/share/mise/shims/node"
  fi

  # Type stripping erases types without checking them. Two real defects -- a
  # crash in --since-last and a lost union narrowing -- were caught by tsc
  # while the whole test suite passed, which is why this check exists.
  if [[ -x .agents/skills/open-review/node_modules/.bin/tsc ]]; then
    if (cd .agents/skills/open-review && ./node_modules/.bin/tsc --noEmit >/dev/null 2>&1); then
      ok "open-review typechecks"
    else
      fail "open-review has type errors -- run: (cd .agents/skills/open-review && ./node_modules/.bin/tsc --noEmit)"
    fi
  else
    warn "open-review typecheck skipped -- run 'pnpm install' in .agents/skills/open-review"
  fi
fi
```

The typecheck degrades to a warning rather than a failure when `node_modules` is
absent, so a fresh clone stays usable before anyone has run `pnpm install`. Use
the exact command Task 13's report recorded — it is the one verified to run.

- [ ] **Step 2: Extend the shellcheck glob**

The shim has no `.sh` extension, so it is invisible to the existing glob — the
same reason `scripts/worktree-bootstrap` had to be named explicitly. In the
`shellcheck -S warning` invocation, append it to the file list:

```bash
    n=$(shellcheck -S warning .config/sketchybar/plugins/*.sh .config/sketchybar/items/*.sh \
      scripts/*.sh scripts/tmux-* scripts/worktree-bootstrap \
      .agents/skills/open-review/open-review 2>/dev/null | grep -c '^In ' || true)
```

- [ ] **Step 3: Run it**

```bash
cd ~/projects/dotfiles && ./scripts/doctor.sh --quick
```

Expected: both new checks pass, no new warnings, exit 0.

- [ ] **Step 4: Add the type-stripping paragraph to AGENTS.md**

In the `### TypeScript (OpenCode plugins)` section of `AGENTS.md`, add a second
subsection after it:

```markdown
### TypeScript (skill scripts, run by Node directly)

- `.agents/skills/open-review/src/*.ts` runs under Node's native type stripping:
  no build step, and **no runtime dependencies**. Keep it that way — the only
  things in `node_modules` are `typescript` and `@types/node`, and they are
  devDependencies used by the typechecker, never imported by the code.
- Stripping **erases** types, it does not check them, so the syntax it cannot
  erase is **forbidden**: no `enum`, no `namespace`, no constructor parameter
  properties. `tsconfig.json` sets `erasableSyntaxOnly` so the editor rejects
  those while you write.
- Two things are **required**, not forbidden — do not "clean them up":
  `import type` for every type-only import, and an explicit `.ts` extension on
  every relative import. `verbatimModuleSyntax` and `allowImportingTsExtensions`
  enforce them, and Node needs the extension to resolve the file at all.
- Because nothing checks types at runtime, `tsc --noEmit` is the gate:
  `(cd .agents/skills/open-review && ./node_modules/.bin/tsc --noEmit)`.
  It exists because two real defects — a crash in `--since-last` and a union
  narrowing lost inside a callback — were found by it while the whole suite
  passed. `doctor.sh` runs it, and degrades to a warning when `node_modules` is
  missing so a fresh clone still works.
- Tests are `node:test`. A directory path argument does not work — run
  `node --test` from the skill directory, or pass a quoted glob.
- Decisions are pure functions over a facts record; only one module per external
  tool is allowed to spawn it. That is what makes the tests worth having.
```

- [ ] **Step 5: Run the full doctor**

```bash
cd ~/projects/dotfiles && ./scripts/doctor.sh
```

Expected: exit 0. Warnings are acceptable; failures are not.

- [ ] **Step 6: Commit**

```bash
cd ~/projects/dotfiles
git add scripts/doctor.sh AGENTS.md
git commit -m "chore(open-review): check the tests and the node shim in doctor"
```

---

## Final verification

- [ ] `cd ~/projects/dotfiles/.agents/skills/open-review && node --test` — all pass
- [ ] `./scripts/doctor.sh` — exit 0
- [ ] `git status` — clean, nothing left unstaged
- [ ] The spec's pending checks 10–14 recorded as passing (Task 9 Step 6, Task 10 Step 4)
- [ ] `~/.agents/skills/open-review/open-review --dry-run` in a real feature branch, and in a worktree, gives a base you agree with

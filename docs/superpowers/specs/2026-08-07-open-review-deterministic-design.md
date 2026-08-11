# open-review, made deterministic — design

**Date:** 2026-08-07
**Status:** Approved
**Author:** Maxime Grebauval

## Context

`.agents/skills/open-review/` launches `tuicr`, the local review TUI, in a tmux
popup so a human can read a diff and comment on it. The skill exists so an agent
does not spend model round-trips on work that is mechanical: finding the base
branch, checking there is a diff at all, building the `tuicr` argv. A companion
skill, `tuicr`, reads the comments back afterwards.

The bundled script is 200 lines of bash. Nine defects were found, all of them
silent, and two of them lose user work or lie to the agent about what happened.

### 1. A path filter with no explicit target is silently dropped

`open-review -p src/` keeps `AUTO=true`, because `-p` is not in the list of
target-naming flags. The auto branch then **overwrites** the argument array:

```bash
ARGS=(-r "$BASE..HEAD" -w)      # line 146 — the -p src/ the caller passed is gone
```

The review opens on the whole branch. The `PATH_FILTER` loop that follows scans
the *rebuilt* array, finds no `-p`, and reports an unfiltered diffstat, so the
plan agrees with itself and nothing looks wrong.

### 2. The reported diffstat is a two-dot diff

```bash
STAT_REV=("$BASE")              # commits + dirty  -> git diff <base-tip>
STAT_REV=("$BASE..HEAD")        # commits only     -> git diff <base-tip> HEAD
```

Both compare the base **tip** to the branch. As soon as the base has advanced
since the fork point — which is the normal state of a branch that has existed
for a day — the diffstat and the churn list include other people's commits,
inverted. The commit *count* is right (`A..B` is merge-base relative) so the two
halves of the plan disagree without either looking wrong.

### 3. No diffstat and no churn as soon as a target is named

`STAT_REV` is only filled on the auto path. Passing `-w`, `-r` or `pr` leaves it
empty, and the `((${#STAT_REV[@]}))` guard skips the whole stat block. The plan
is at its most useful in the explicit modes — the caller asked for something
specific — and that is exactly where it says nothing but the argv.

### 4. A stale plan survives a failed launch

`--plan` waits for the plan file to exist and prints it. On `exit 2` (nothing to
review) or on a launch that fails, the file from the *previous* run is still
there, is still non-empty, and gets printed as if it described the review that
never opened.

### 5. `-p` in last position crashes the script

```bash
PATH_FILTER=(-- "${ARGS[i + 1]}")
```

Under `set -u`, an out-of-range index is an unbound variable, not an empty
string. `open-review -w -p` dies with a bash error instead of a usage message.

### 6. Base detection pays for the network and scans an arbitrary window

`detect_base` calls `gh pr view` with no timeout on every auto invocation
(≈1 s warm, unbounded on a bad network), then walks the 50 most recently
committed refs, running `merge-base --is-ancestor` plus `rev-list --count` on
each — up to ~100 git processes. A branch whose base is older than that window
is invisible to the scan. `git branch --merged HEAD` answers the same question
in one process with no cutoff.

### 7. Escape kills the review and the agent is told it finished

`tmux 3.7b`, `display-popup`:

> `-k` allows any key to dismiss the popup instead of only 'Escape' or 'C-c'.

The script launches with `tmux display-popup -E`, so **Escape and `C-c` dismiss
the popup**. tuicr is a vim-keybinding TUI: Escape is the key you press to leave
insert mode while writing a comment. The popup goes, tuicr takes a SIGHUP, the
blocking `exec` returns, and the agent — for which "the background task
completing is the signal that the review is finished" — reads back whatever was
saved before the keystroke. The comment being written is lost.

The manual path is immune, and that is why it exists: `prefix + R` runs
`~/scripts/tmux-popup --kill tuicr tuicr -w`, which puts the app in a *separate*
tmux session and only attaches a client inside the popup. Escape destroys the
client; tuicr survives; the next `prefix + R` reattaches. `open-review` is the
one path without that protection.

### 8. The remote-PR mode is unreachable

```bash
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {   # line 33
	echo "open-review: not a git repository" >&2
	exit 1
}
```

This runs before any argument is looked at, and the plan file is placed inside
the git dir, so there is nowhere to write it either. Yet `tuicr pr <url>` needs
no checkout at all — from an empty directory it resolved the session
`gh:anthropics/claude-code/pr/1` and only failed on the absent TTY. The wrapper
blocks a mode the underlying tool supports.

### 9. Session discovery is a model-side heuristic

Reading the comments back is described in prose in the `tuicr` skill: list the
sessions, take the `kind: "local"` one with the most recent `updated_at`, ignore
`active`, and — quoting the skill — "if you see several local slugs and the most
recent one has `comment_count: 0`, the comments are probably in the older slug
from before a commit". That is a guess about which review the user just did.
The wrapper launched the review; it can know.

## Goals

1. One backgrounded call gets the popup on screen **and** hands the comments
   back when it closes. The agent's only remaining job is to pick an entry point
   and to reason about the feedback.
2. Every mode that reviews local history produces a complete plan: resolved
   target, base and how it was found, commit count, working-tree state, a
   diffstat computed with the *same* revset the popup uses, and the churn
   ranking. `pr` is the stated exception (Non-goals).
3. Escape cannot lose a comment, and cannot make the agent believe the review is
   over.
4. Which review session the comments came from is determined, not guessed.
5. Decisions are unit-tested, so a fixed case stays fixed.
6. Base resolution makes no network call.

## Non-goals

- **No enriched plan for `pr`.** It stays a pass-through: no local diffstat, no
  churn. It will simply stop dying outside a git repo.
- **No staged-only mode.** tuicr has none — the session slug is literally
  `staged-and-unstaged`, and `-w` was verified to include untracked files too.
  "Review just what I staged" is honoured by `-w` with the widening stated in
  the plan.
- **No `-A`/all-files entry point.** Reviewing every tracked file is reachable
  by hand; it has no place in the agent's vocabulary.
- ~~**No type-checking gate.**~~ **Reversed during implementation.** Two real
  defects — a crash in `--since-last` reached only when a branch has no new
  commits but a dirty tree, and a union narrowing lost inside a callback — were
  both caught by `tsc --noEmit` while the whole test suite passed. The owner
  chose to adopt the gate. The skill now carries `typescript` and `@types/node`
  as devDependencies and a `package.json` declaring `"type": "module"`, which
  tsc needs because it does not infer module kind from syntax the way Node does.
  `doctor.sh` runs the check and degrades to a warning when `node_modules` is
  absent, so a fresh clone stays usable. See Accepted trade-offs.
- No change to the `tuicr` skill beyond deleting what the script now owns.

## Design

### Component 1 — the entry vocabulary

The model's entire remaining decision is picking one line from this table. It is
closed, and `-p` composes with every row instead of being a row of its own.

| call | meaning |
| --- | --- |
| `open-review` | auto: the branch's commits, the working tree, or both |
| `open-review --since-last` | only what changed since the last completed review of this branch |
| `open-review -w` | uncommitted only (staged + unstaged + untracked) |
| `open-review -r <revset>` | an explicit range |
| `open-review pr <n\|url>` | a forge pull request, pass-through |
| `open-review --file <path>` | a document outside VCS (a plan, a spec) |
| `… -p <path>` | filter to a file or directory, composable with all of the above |

Plus four non-review calls: `--plan` (print the plan of the launch in flight),
`--dry-run` (resolve and print, no popup), `-h`/`--help`, and `--exec` (resolve,
then `exec tuicr` in place). `--exec` is for the tmux binding (Component 11): it
opens no popup, waits for nothing, reads no comments back and records no state,
because in that path the human owns the popup and there is no wrapper left alive
to observe the outcome.

### Component 2 — a bash shim in front of TypeScript

The script becomes TypeScript, run by Node 24's native type stripping: no build
step, no `node_modules`, no `tsx`. Measured at 47 ms end to end, which is free
next to a popup that waits for a human.

The entry point stays a file named `open-review` so neither the agent contract
nor the tmux binding changes, but it is a ~15-line bash shim:

```bash
#!/bin/bash
# Resolves a node that exists even in a bare environment, then hands over.
set -uo pipefail
here=$(cd -- "$(dirname -- "$0")" && pwd)
for candidate in node "$HOME/.local/share/mise/shims/node" /opt/homebrew/bin/node; do
	command -v "$candidate" >/dev/null 2>&1 && exec "$candidate" "$here/src/main.ts" "$@"
done
echo "open-review: no node on PATH (tried mise shims)" >&2
exit 1
```

This is not ceremony. `mise` publishes its `PATH` from `.zshrc`, and
`~/scripts/tmux-popup` deliberately avoids the login shell to save 210 ms, so a
`#!/usr/bin/env node` shebang resolves to nothing in the popup — verified:
`env -i /bin/bash -c 'command -v node'` finds none, while
`~/.local/share/mise/shims/node` works with no activation.

### Component 3 — module layout and the purity boundary

```
.agents/skills/open-review/
  SKILL.md          the entry table, the contract, caveats not yet fixed
  FAILURES.md       one entry per wrong target, closed by a named test
  open-review       the shim above
  tsconfig.json     erasableSyntaxOnly — for the LSP, installs nothing
  src/
    main.ts         orchestration and exit codes
    args.ts         argv -> Intent                                   (pure)
    base.ts         RepoFacts -> BaseDecision                        (pure)
    target.ts       Intent + RepoFacts -> tuicr argv + stat revset    (pure)
    plan.ts         everything above -> the plan text                (pure)
    session.ts      before/after session lists -> the elected session (pure)
    git.ts          gathers RepoFacts; the only place git is spawned
    tmux.ts         launch, wait for the session to die
    tuicr.ts        review list / review comments
    state.ts        plan file, last-reviewed state
    *.test.ts
```

The rule that makes the tests worth writing: **nothing decides while reading the
disk**. `git.ts` collects facts into a `RepoFacts` record; every decision is a
function from data to data. Unit tests feed synthetic facts. Integration tests
build real git repositories in a temp dir and run the real collector, so git's
own semantics are under test — which is where defect 2 lived, and where a mocked
`git` would have let it through.

### Component 4 — base resolution, no network

In order, stopping at the first that holds:

1. An explicit `-r` — no detection at all.
2. **The creation reflog.** The oldest reflog entry for the branch names its
   start point: `branch: Created from master`, or `origin/master`. Verified to
   carry the ref name whenever the branch was created with an explicit start
   point — including `git worktree add -b <branch> <path> <base>`, which is what
   lazygit's `W` runs. A plain `git checkout -b` with no start point records the
   literal `HEAD`, which is useless and is discarded.

   The name is looked up **remote-qualified first** (`origin/master` before
   `master`): a local `master` that has fallen behind its remote would otherwise
   place the base too far back and pull other people's commits into the range.

   Accepted on **shared history**, not on ancestry — the ref must exist and have
   a merge-base with HEAD. Requiring ancestry would reject the single most
   common case, a base that has advanced since the fork, which is exactly the
   case the merge-base freezing below exists to handle.
3. **The nearest true ancestor** among `git for-each-ref --merged HEAD` over
   `refs/heads` and `refs/remotes`, one process for the list: excluding the
   branch itself, `origin/<branch>` and `origin/HEAD`; preferring refs with
   commits between them and HEAD, and falling back to refs sitting exactly on
   HEAD only when nothing else remains. Restricting to true ancestors is what
   stops a sibling branch off the same parent from winning; keeping the
   zero-distance refs as a last resort is what gives a brand-new branch a base
   to report.
4. `origin/main`, `origin/master`, `main`, `master`.

The result is then **frozen to a sha**: `git merge-base <base> HEAD`, and that
sha is what goes into `-r <sha>..HEAD`. Two things follow. The plan's diffstat
and the popup necessarily agree, because they are given the same revset. And a
base that has advanced since the fork can no longer inject other people's work
reversed — defect 2 becomes unexpressible rather than fixed. The plan prints
both forms so the number stays legible:

```
base: origin/master (created-from reflog) frozen at 1a2b3c4
```

The base a branch was stacked on is often not `main`. When the reported base
looks wrong, the answer is `-r`, not argument.

### Component 5 — target construction

Auto:

| commits | working tree | tuicr argv | stat revset |
| --- | --- | --- | --- |
| >0 | dirty | `-r <mb>..HEAD -w` | `git diff <mb>` (tip-to-worktree, covers both) |
| >0 | clean | `-r <mb>..HEAD` | `git diff <mb> HEAD` |
| 0 | dirty | `-w` | `git diff HEAD` |
| 0 | clean | — | exit 2, no popup |

An unborn HEAD (fresh repo, no commit) is the "0 commits" row. A detached HEAD
resolves a base through step 3 or 4 only.

`--since-last` reads the last reviewed HEAD for this branch from the state file
and targets `<sha>..HEAD` plus `-w` if dirty. Three fallbacks, each stated in
the plan rather than silently applied: no record for this branch → auto; the
recorded sha is no longer an ancestor of HEAD (a rebase happened) → auto;
recorded sha equals HEAD and the tree is unchanged → exit 2, nothing new.

An explicit `-r <revset>` is honoured **literally** — `git diff <revset>` is
handed the string as given, so `A..B` stays two-dot and `A...B` stays three-dot.
Only auto freezes to a merge-base, because only auto claims to know what the
caller meant.

`-p <path>` appends to whatever the other rows produced, and is carried into the
stat and churn computation so the numbers match the popup.

`--no-update-check` is always appended: a version-check prompt inside a modal
popup is a failure mode, and the installed 0.20.0 is behind the published
0.21.0.

### Component 6 — the plan

Written for every mode, with a stable field order:

```
mode: auto (branch commits + working tree)
base: origin/master (created-from reflog) frozen at 1a2b3c4
commits: 7    working tree: dirty (3 staged, 2 unstaged, 1 untracked)
tuicr: -r 1a2b3c4..HEAD -w --no-update-check
stat: 12 files changed, 340 insertions(+), 88 deletions(-)
untracked (not in the stat above):
      41  src/new-thing.ts
churn (added+deleted, top 10):
     128  src/main.ts
      64  src/base.ts
```

Untracked files are listed with their line counts instead of being summarised as
a count that says they are missing — `git diff` cannot see them, but the review
will. `pr` prints `stat: pass-through, no local stat`. `--file` prints the path
and its line count and nothing else.

Freshness replaces defect 4: every non-`--plan` invocation **deletes** the plan
file before resolving anything, and deletes it again on any exit that does not
open a popup — `--dry-run` included, which prints to stdout and leaves nothing
behind. `--plan` waits up to 3 s for the file to appear, as today, but can no
longer inherit a previous run's answer.

The plan file lives in the per-worktree git dir (`--absolute-git-dir`), so two
worktrees reviewing at once do not overwrite each other. The `--since-last`
state lives in the **common** git dir (`--git-common-dir`), keyed by branch, so
it survives the worktree being deleted.

### Component 7 — launch, and what "finished" means

Launch goes through the existing helper, in a dedicated session:

```
tmux display-popup -d <root> -T " tuicr (C-q close)" -w 95% -h 95% \
  -E '~/scripts/tmux-popup --kill tuicr tuicr <escaped argv>'
```

Escape now only destroys the client. tuicr keeps running in `_popup_tuicr`, and
`prefix + R` reattaches to it — the agent's review and the human's binding share
the session name on purpose, so the human's habitual keystroke resumes the
review the agent opened.

The script therefore stops waiting on the popup and **waits for the session to
die**: poll `tmux has-session -t _popup_tuicr` until it is gone, which happens
on `C-q` (the helper binds it to `kill-session`). That is the honest signal, and
while the popup is dismissed the user can talk to the agent normally, since the
wait is in a background task.

If `_popup_tuicr` already exists when a launch starts, `tmux-popup` would
**attach it and ignore the command it was given** — a live review would silently
stand in for the requested one. The script checks for the session first and
exits 4 instead.

Two couplings worth naming: the `_popup_` prefix is `tmux-popup`'s own naming
convention, and the helper flattens its command with `CMD="$*"`, so argv is
shell-escaped before being handed over.

Outside tmux, the script prints the `tuicr` command to run by hand and exits 1,
as today.

### Component 8 — reading the comments back

1. Before launching: `tuicr review list --all` → a map from session `path` to
   `updated_at` and `comment_count`. `--all` rather than `--repo .` so PR
   sessions and sessions outside a checkout are covered.
2. After the session dies: list again. Elect the session that is new, or whose
   `updated_at` moved; the most recently updated one if several. tuicr writes
   its session file at startup — verified — so the elected session exists even
   when nothing was written into it.
3. `tuicr review comments --session <path>`. The `path` is a session JSON file
   and resolves without `--repo`, so this works from anywhere.
4. Output: an index of one line per comment
   (`path:line — first 80 characters`) so the agent can triage without parsing,
   then the verbatim JSON.
5. Record the reviewed HEAD in the state file for the next `--since-last`, when
   the review had a HEAD to record — not for `pr`, not for `--file`.

Defect 9 disappears: the session is elected from an observation the script made
itself, not inferred from timestamps and comment counts.

### Component 9 — exit codes

| code | meaning |
| --- | --- |
| 0 | review closed, comments printed |
| 2 | nothing to review — no popup was opened |
| 3 | review closed with no comments |
| 4 | a review is already open (`_popup_tuicr` exists) |
| 1 | error (not a git repo where one is required, no node, not in tmux) |

`3` separates "the user saved nothing" from "something went wrong", which is the
distinction the current script cannot express and the `tuicr` skill papers over
with a heuristic.

### Component 10 — the self-improvement loop

`FAILURES.md`, in the skill directory. One entry every time the target came out
wrong — the user says the diff is not what they asked for. An entry carries:

- the date, and the exact invocation
- **the plan as it was printed** — the evidence, since it names the base, how the
  base was found, and the argv
- what the user expected instead
- the root cause
- the name of the regression test that now covers it

The loop closes on a test, not on prose: write the entry, write the **failing**
test, then fix. That is the whole reason the script is TypeScript.

`FAILURES.md` is **not** read on every launch — it grows by one entry per
failure and would be context paid forever. It is read by whoever is repairing.
The consequence has to be respected: an entry that is not fixed immediately gets
one caveat line in `SKILL.md`, or the knowledge is buried in a file nothing
loads.

`SKILL.md` shrinks to the entry table, the two-call contract, the exit codes,
the caveats, and the instruction above. The base-detection explanation goes (the
plan explains itself) and so does session discovery (the script owns it). The
`tuicr` skill keeps only the `prefix + R` path, where the human opened the popup
and there is no wrapper to have observed anything.

### Component 11 — surrounding changes

- `.tmux.conf`: `prefix + R` becomes
  `~/scripts/tmux-popup --kill tuicr ~/.agents/skills/open-review/open-review --exec`,
  so the manual review gets the same base detection and the same "nothing to
  review" message instead of tuicr's bare `Error: No changes to review`. The
  shim is what makes this safe, since the popup has no mise `PATH`.
- `doctor.sh`: run `node --test` over the skill; check the shim resolves a node.
  Both in the spirit of the file — every check corresponds to something found
  broken silently.
- `AGENTS.md`: a paragraph next to the existing TypeScript section on the type
  stripping constraints — no `enum`, no `namespace`, no constructor parameter
  properties, `import type` for type-only imports, explicit `.ts` extensions in
  imports.

### Component 12 — tests

Unit, on synthetic `RepoFacts`: argv construction for all seven entry points,
`-p` composition (defect 1), the auto decision table including the unborn and
detached rows, `--since-last` and its three fallbacks, plan rendering, session
election, comment-index rendering, argument errors (defect 5).

Integration, on real repositories built in a temp dir: a branch off `master`; a
branch stacked on another branch; a base that has advanced since the fork
(defect 2); a linked worktree; a detached HEAD; an unborn HEAD; a clean tree
(exit 2); an untracked-only tree; a repo whose creation reflog is gone. Each
asserts the resolved plan, not the popup.

## Accepted trade-offs

1. **`pr` gets no local plan.** Enriching it means `gh pr diff` and a second
   source of truth for churn. The mode is rare enough to stay a pass-through.
2. **`--since-last` can show a chunk twice.** If the dirty state you reviewed
   was then committed unchanged, that commit appears in the next delta. Making
   it exact means freezing the reviewed tree into a `commit-tree` object and
   diffing tree-to-tree, with dangling commits `git gc` may collect and fragile
   comment anchors. The imprecision is announced in the plan instead.
3. ~~**Types are stripped, not checked.**~~ **This trade-off was taken and then
   reversed**, and the reversal is worth recording because the reasoning here was
   wrong. The claim was that the integration tests cover the semantics that
   actually break. They did not: a crash in `--since-last` survived 58 passing
   tests, and a lost narrowing survived 69. Both fell out of a single
   `tsc --noEmit`. The residual class of bug was not residual. The cost the
   original text feared — a `node_modules` in the skill and a `pnpm install`
   after a clone — is real but bounded, and `doctor.sh` warns rather than fails
   when the install is missing.
4. **The wait can outlive the user's interest.** Dismiss the popup and never
   press `C-q`, and the background task waits. Accepted: the popup being
   dismissed is exactly when the user can talk to the agent again and say so.
5. **Local base detection can diverge from the PR's base**, on a branch whose
   base was rebased or merged. `-r` is the override, and the plan always says
   which rule fired.
6. **The `_popup_tuicr` name is a coupling** to `~/scripts/tmux-popup`. Sharing
   it is deliberate — it is what makes `prefix + R` reattach — but renaming the
   helper's convention would break the exit-4 check.

## Verification

Measured during design, on the live setup.

| # | Check | Result |
| - | ----- | ------ |
| 1 | `tuicr pr <url>` from an empty non-repo directory | Resolved `tuicr-session: gh:anthropics/claude-code/pr/1`, then failed only on the absent TTY — defect 8 confirmed as a wrapper restriction |
| 2 | `tuicr -w` on a clean tree | `Error: No changes to review` |
| 3 | `tuicr -w` with a single untracked file | Session created (`t1@master/staged-and-unstaged/b322bc6`) — `-w` does include untracked |
| 4 | `tuicr review list --repo .` | Sessions carry a `path` to a session JSON and an `anchor` field; `review comments --session <path>` resolves with no `--repo` |
| 5 | `man tmux` on `display-popup` (tmux 3.7b) | "`-k` allows any key to dismiss the popup instead of only 'Escape' or 'C-c'" — defect 7 confirmed |
| 6 | `node m.ts` under Node 24.13.0, no config, no deps | Runs; 47 ms total |
| 7 | `node --test` on a `*.test.ts` importing `./m.ts` | 1 pass, 68 ms — no runner to install |
| 8 | `env -i /bin/bash -c 'command -v node'` | Not found; `~/.local/share/mise/shims/node` exists and works — Component 2 justified |
| 9 | `bun`, `deno`, `tsx` on PATH | Absent. Node is the only runtime already declared (mise pins 24.13.0) |

Pending, only observable through a real run:

| # | Check | Expectation |
| - | ----- | ----------- |
| 10 | Press Escape while writing a comment in the agent-launched popup | Popup dismisses, tuicr survives, `prefix + R` reattaches with the comment intact, background task still waiting |
| 11 | `C-q` in that popup | Session dies, task completes, comments printed with the index |
| 12 | Close the review having saved nothing | Exit 3, explicitly "no comments" |
| 13 | Launch while a review is already open | Exit 4, existing review untouched |
| 14 | `prefix + R` on a clean tree after the binding change | The script's "nothing to review" message, not tuicr's raw error |

# Worktree bootstrap from lazygit — design

**Date:** 2026-08-05
**Status:** Approved
**Author:** Maxime Grebauval

## Context

Worktrees are created exclusively through the lazygit `W` custom command
(`.config/lazygit/config.yml`), which wraps `git worktree add` with a
pre-filled path following the `<repo>.worktree/<branch>` convention. Four repos
use that convention today: `orus-monorepo`, `blog-backstage`, `dotfiles`,
`mariage-fleur-et-maxime`.

Three defects were found, all of them silent.

### 1. The auto-install runs the wrong package manager

An unversioned `post-checkout` hook lives in
`~/projects/orus-monorepo/.git/hooks/`. Its stated purpose is to install
dependencies in a fresh worktree so the LSP works immediately. It fires
correctly, but its last line is `yarn install` while the repo is on pnpm.
Reproduced:

```
error This project's package.json defines "packageManager": "yarn@pnpm@11.18.0".
      However the current global version of Yarn is 1.22.22.
```

Yarn 1.22.22 prepends its own name to the `pnpm@11.18.0` value, fails, and
suggests `corepack enable`. That advice is a dead end: the real problem is the
package manager, not Corepack. The install never runs, the worktree has no
`node_modules`, and the LSP reports phantom errors.

### 2. The path prefill breaks when lazygit is opened in a worktree

The `initialValue` of the `Path` prompt computes
`basename $(git rev-parse --show-toplevel)`, which returns the name of the
*current* worktree, not of the main repo. Opened in
`orus-monorepo.worktree/frontend-testing`, it proposes
`../frontend-testing.worktree/<branch>`.

This already produced a nested, orphaned worktree, still listed as prunable:
`orus-monorepo.worktree/reduce-chromatic-usage.worktree/chromatic-spec`.

### 3. The hook is invisible

Living in `.git/hooks/`, it is outside the dotfiles repo, outside `doctor.sh`,
absent from any diff, and lost on the next clone. That invisibility is why
defect 1 survived unnoticed.

## Goals

1. A new worktree has its dependencies installed by the time lazygit hands
   control back.
2. The right package manager is used, derived from the repo rather than
   hardcoded.
3. The path prefill is correct regardless of which worktree lazygit was opened
   in.
4. Every moving part is versioned in the dotfiles repo and checked by
   `doctor.sh`.

## Non-goals

- **No global `core.hooksPath`, no git hook of any kind.** Considered and
  rejected. It would cover every creation path (CLI, agents, IDE), but at the
  cost of silently disabling every repo's own `.git/hooks/`. Worktrees are only
  ever created through lazygit, so that coverage buys nothing.
- No change to how worktrees are removed or pruned, beyond the one-off cleanup
  below.
- No attempt to pin or reconcile toolchain versions (see Accepted trade-offs).

## Design

### Component 1 — `scripts/worktree-bootstrap`

Reachable as `~/scripts/worktree-bootstrap` through the existing
`~/scripts` -> `~/projects/dotfiles/scripts` symlink.

```bash
#!/bin/bash
# Installs dependencies in a freshly created worktree so the LSP works right
# away. Called by the lazygit "W" custom command, after `git worktree add`.
set -uo pipefail

worktree="${1:?usage: worktree-bootstrap <worktree-path>}"
cd "$worktree" || exit 1

[ -f package.json ] || exit 0
[ -d node_modules ] && exit 0

# packageManager is authoritative (Corepack reads it); lockfiles are the fallback.
pm=$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"\([a-z]*\)@.*/\1/p' package.json)
if [ -z "$pm" ]; then
  if   [ -f pnpm-lock.yaml ];    then pm=pnpm
  elif [ -f yarn.lock ];         then pm=yarn
  elif [ -f package-lock.json ]; then pm=npm
  elif [ -f bun.lockb ];         then pm=bun
  else exit 0
  fi
fi

command -v "$pm" >/dev/null || { echo "worktree-bootstrap: $pm not on PATH"; exit 1; }

echo "worktree-bootstrap: $pm install in $worktree"
"$pm" install
```

Design notes:

- **A separate script, not shell inlined in the YAML.** It stays readable in a
  diff, shellcheck can lint it, and it can be run by hand against any path
  without going through the TUI.
- **Parsing with `sed`, not `jq` or `node`.** The script runs in whatever
  environment lazygit inherited, where mise shims are not guaranteed.
  `packageManager` is a flat field, so a one-line `sed` is enough and adds no
  dependency.
- **`packageManager` first, lockfile second.** The field is the source of
  authority. The lockfile fallback covers repos that do not declare it, and its
  fixed priority order (pnpm, yarn, npm, bun) keeps the outcome deterministic
  when a migration has left two lockfiles behind.
- **No `set -e`.** The guard clauses use `[ ... ] && exit 0`, which would abort
  the script under `-e`. The install's own exit code is the script's exit code,
  so a failure surfaces to lazygit.
- **Exits quietly on anything that is not a JS project**, and on a worktree that
  already has `node_modules`.

### Component 2 — the lazygit command

Two lines change in `.config/lazygit/config.yml`, both on the existing `W`
entry.

The path prefill:

```yaml
initialValue: "{{ runCommand \"bash -c 'dirname $(git rev-parse --path-format=absolute --git-common-dir)'\" }}.worktree/{{index .PromptResponses 0}}"
```

`--git-common-dir` always resolves to the main repo's `.git`, including from
inside a worktree, so `dirname` of it is the main repo root. The result is
absolute, which also removes the dependency on lazygit's working directory that
the old `../` prefix carried.

The command:

```yaml
command: "git worktree add {{if .Form.NewBranch}}-b {{.Form.NewBranch | quote}} {{end}}{{.Form.Path | quote}} {{.Form.Branch | quote}} && ~/scripts/worktree-bootstrap {{.Form.Path | quote}}"
```

`output: terminal` is already set on this entry and stays. It suspends the TUI
and gives the terminal to the command, so the install streams to screen and
lazygit waits for it. That is the intended behaviour: blocking and verbose.
A background install was rejected because the LSP would start against a
half-populated worktree, and because a silent failure is exactly what let
defect 1 live.

### Component 3 — `doctor.sh` checks

Three checks, in the spirit of the file (every check corresponds to something
found broken silently):

1. `~/scripts/worktree-bootstrap` exists and is executable.
2. Extend the existing shellcheck glob (currently
   `.config/sketchybar/plugins/*.sh .config/sketchybar/items/*.sh scripts/*.sh scripts/tmux-*`)
   to cover the new script, which has no `.sh` extension.
3. Warn if any repo under `~/projects` still has a hook in its `.git/hooks/`,
   **excluding the `*.sample` files git installs by default** (14 of them per
   repo, otherwise every repo would warn). That is how the broken
   `post-checkout` stayed invisible, and it is the one state that would silently
   pre-empt this design. Verified quiet in the current state: no repo under
   `~/projects` has a non-sample hook once `orus-monorepo`'s is removed.

### Component 4 — one-off cleanup

- Delete `~/projects/orus-monorepo/.git/hooks/post-checkout`. This is required,
  not cosmetic: the hook fires *before* the bootstrap script and would print the
  yarn/Corepack error on every worktree creation.
- `git worktree prune` in `orus-monorepo`, to drop the orphaned
  `reduce-chromatic-usage.worktree/chromatic-spec` entry left by defect 2.

## Accepted trade-offs

1. **Only the lazygit path is covered.** A worktree created by `git worktree
   add` on the command line, or by an agent, gets no dependencies. Accepted:
   worktrees are only ever created through lazygit. The fix in that case is to
   run `~/scripts/worktree-bootstrap <path>` by hand, or just `pnpm install`.
2. **The toolchain is whatever lazygit inherited.** `mise activate zsh` rewrites
   `PATH` in the interactive shell, and lazygit inherits it. Because lazygit
   always operates on the current repo, the activated toolchain is already the
   right one for the repo whose worktree is being created. The residual case is
   a branch that changes the required Node version; the repo's own preinstall
   check catches that loudly.
3. **`pnpm` on `PATH` is not the pinned one.** `mise.toml` in `orus-monorepo`
   pins `pnpm = "11.18.0"`, but the resolved binary is Homebrew's
   `/opt/homebrew/bin/pnpm`. Both are 11.18.0 today, so they coincide by
   coincidence. Out of scope here, worth revisiting separately.

## Verification

Measured during design, on the live setup.

| # | Check | Result |
| - | ----- | ------ |
| 1 | Reproduce defect 1: `yarn install` at the orus worktree root | Fails with `"packageManager": "yarn@pnpm@11.18.0"`, confirming the mangled value and the dead-end Corepack advice |
| 2 | Reproduce defect 2: prefill computed from inside a worktree | Yields `../frontend-testing.worktree/<branch>`, matching the orphaned nested worktree already on disk |
| 3 | New prefill from the main repo | `/Users/maxime.grebauval/projects/orus-monorepo.worktree/<branch>` |
| 4 | New prefill from inside a worktree | Identical result, absolute |
| 5 | `git --version` vs the `--path-format` requirement (2.31+) | 2.55.0 |
| 6 | `pnpm install` in the unbootstrapped worktree | Exit 0, 2355 packages, 7.1s on a warm store |

Pending, only observable through a real TUI run:

| # | Check | Expectation |
| - | ----- | ----------- |
| 7 | Press `W` in lazygit and create a worktree | Prefill correct, install streams to the terminal, lazygit waits, worktree has `node_modules` on return |
| 8 | Press `W` from a lazygit opened inside a worktree | Same result, no nesting |

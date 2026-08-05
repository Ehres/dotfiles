# Worktree bootstrap from lazygit — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creating a worktree with the lazygit `W` key produces a correct path and a worktree whose dependencies are already installed.

**Architecture:** A versioned helper script (`scripts/worktree-bootstrap`) detects the repo's package manager and installs. The lazygit custom command chains it after `git worktree add` and gets a corrected path prefill. `doctor.sh` gains three guards so none of it can rot silently. No git hook is involved: the broken one is deleted.

**Tech Stack:** Bash, lazygit 0.64.0 custom commands (Go templates in YAML), git 2.55, shellcheck, pnpm/yarn/npm/bun.

**Spec:** `docs/superpowers/specs/2026-08-05-worktree-bootstrap-design.md`

## Global Constraints

- All work happens in `/Users/maxime.grebauval/projects/dotfiles`. It is on branch `master`.
- Shebang is `#!/bin/bash`, matching `scripts/tmux-sessions`, `scripts/tmux-popup`, `scripts/gh-prs-by-path`.
- Comments and script output in English.
- File names in kebab-case, no extension for command-style scripts.
- `shellcheck -S warning` must report **0** warnings across the globs in `doctor.sh`.
- Commit messages: Angular format `type(scope): description`, lowercase, imperative, no trailing period.
- **Never run `git commit` without explicit user approval for that specific commit.** Show the files and message, wait for a "go".
- **Stage only the files named in the task.** The repo has unrelated dirty files: `.zshrc`, `.config/btop/btop.conf`, `.config/nvim/lazy-lock.json`, `.agents/skills/open-review/open-review`, and untracked `.agents/skills/terminal-browser/`. Never use `git add -A` or `git add .`.
- Scratch fixtures go in `$SCRATCH`, defined once per task as:
  `SCRATCH=/private/tmp/claude-501/-Users-maxime-grebauval-projects-orus-monorepo-worktree-frontend-testing/51dccf70-4c44-4c8f-9645-2c33df9885c7/scratchpad`

---

## File Structure

| File | Status | Responsibility |
| ---- | ------ | -------------- |
| `scripts/worktree-bootstrap` | Create | Detect the package manager for a given worktree path and install dependencies. The only piece that knows about package managers. |
| `.config/lazygit/config.yml` | Modify | Compute the worktree path and chain the bootstrap after `git worktree add`. Knows nothing about package managers. |
| `scripts/doctor.sh` | Modify | Three guards: the script is present and executable, it is shellchecked, and no stale git hook shadows the design. |
| `~/projects/orus-monorepo/.git/hooks/post-checkout` | Delete | Outside the repo. One-off cleanup, not a commit. |

The split matters: the lazygit config stays two declarative lines, and every piece of logic lives in a file that shellcheck can read and that can be run by hand.

---

## Task 0: Clear the working tree of unrelated changes

Two pending changes are unrelated to this plan and must not be swept into its commits. This task exists so the later commits are honest about what they contain.

**Files:**
- Commit: `docs/superpowers/specs/2026-08-05-worktree-bootstrap-design.md` (new, from the brainstorming session)
- Commit: `docs/superpowers/plans/2026-08-05-worktree-bootstrap.md` (this plan; `docs/superpowers/plans/` is tracked in this repo)
- Commit: `scripts/doctor.sh` (2-line wording change, pre-existing)

- [ ] **Step 1: Confirm exactly what is pending**

```bash
cd /Users/maxime.grebauval/projects/dotfiles
git status --short
git diff scripts/doctor.sh
```

Expected: `scripts/doctor.sh` shows only two reworded strings in the `tmux` section ("on each run", "running the script would create a duplicate"). If it shows anything else, stop and ask.

- [ ] **Step 2: Ask the user to approve the two commits**

Show both file lists and both messages. Wait for an explicit go. Do not proceed without it.

- [ ] **Step 3: Commit the spec and the plan, separately**

Repo precedent (`git log -- docs/superpowers/`) is one commit each, scoped to the
feature slug: `docs(tmux-status-skill): spec ...` then `docs(...): plan ...`.

```bash
git add docs/superpowers/specs/2026-08-05-worktree-bootstrap-design.md
git commit -m "docs(worktree-bootstrap): spec worktree dependency install"

git add docs/superpowers/plans/2026-08-05-worktree-bootstrap.md
git commit -m "docs(worktree-bootstrap): plan worktree dependency install"
```

- [ ] **Step 4: Commit the unrelated doctor.sh wording change on its own**

`scripts` is the scope this file was introduced under (`feat(scripts): add doctor.sh`).

```bash
git add scripts/doctor.sh
git commit -m "fix(scripts): clarify the tmux duplicate-session message"
```

- [ ] **Step 5: Verify the tree is clean of anything this plan will touch**

```bash
git status --short -- scripts/ .config/lazygit/ docs/superpowers/
```

Expected: no output.

---

## Task 1: The `worktree-bootstrap` script

**Files:**
- Create: `scripts/worktree-bootstrap`

**Interfaces:**
- Consumes: nothing.
- Produces: an executable taking one positional argument, the absolute worktree path. Exit 0 when it installed or had nothing to do; non-zero when the install failed or the package manager is missing. Task 2 calls it as `~/scripts/worktree-bootstrap <path>`.

- [ ] **Step 1: Build the fixtures that the script must handle**

```bash
SCRATCH=/private/tmp/claude-501/-Users-maxime-grebauval-projects-orus-monorepo-worktree-frontend-testing/51dccf70-4c44-4c8f-9645-2c33df9885c7/scratchpad
FIX="$SCRATCH/wt-fixtures"
rm -rf "$FIX" && mkdir -p "$FIX"

# A: pnpm project, nothing installed yet -- must install
mkdir -p "$FIX/a" && printf '{"name":"a","packageManager":"pnpm@11.18.0"}\n' > "$FIX/a/package.json"

# B: not a JS project -- must do nothing
mkdir -p "$FIX/b" && echo hi > "$FIX/b/readme.md"

# C: already installed -- must do nothing
mkdir -p "$FIX/c/node_modules" && printf '{"name":"c","packageManager":"pnpm@11.18.0"}\n' > "$FIX/c/package.json"

# D: no packageManager field, yarn.lock present -- must fall back to yarn
mkdir -p "$FIX/d" && printf '{"name":"d"}\n' > "$FIX/d/package.json" && touch "$FIX/d/yarn.lock"
```

- [ ] **Step 2: Run the not-yet-written script against fixture A to verify it fails**

```bash
~/scripts/worktree-bootstrap "$FIX/a"
```

Expected: FAIL with `no such file or directory`.

- [ ] **Step 3: Write the script**

Create `scripts/worktree-bootstrap`:

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
  if [ -f pnpm-lock.yaml ]; then
    pm=pnpm
  elif [ -f yarn.lock ]; then
    pm=yarn
  elif [ -f package-lock.json ]; then
    pm=npm
  elif [ -f bun.lockb ]; then
    pm=bun
  else
    exit 0
  fi
fi

command -v "$pm" >/dev/null || {
  echo "worktree-bootstrap: $pm not on PATH"
  exit 1
}

echo "worktree-bootstrap: $pm install in $worktree"
"$pm" install
```

Then make it executable:

```bash
chmod +x /Users/maxime.grebauval/projects/dotfiles/scripts/worktree-bootstrap
```

- [ ] **Step 4: Verify the `packageManager` parse against the real monorepo, not just a fixture**

```bash
sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"\([a-z]*\)@.*/\1/p' \
  /Users/maxime.grebauval/projects/orus-monorepo.worktree/frontend-testing/package.json
```

Expected: `pnpm`

- [ ] **Step 5: Run the four fixtures**

```bash
for f in a b c d; do
  echo "--- fixture $f ---"
  ~/scripts/worktree-bootstrap "$FIX/$f"
  echo "exit=$?"
done
```

Expected:
- `a`: prints `worktree-bootstrap: pnpm install in .../a`, pnpm runs, `exit=0`
- `b`: no output, `exit=0`
- `c`: no output, `exit=0`
- `d`: prints `worktree-bootstrap: yarn install in .../d`, `exit=0`

- [ ] **Step 6: Verify the argument guard**

```bash
~/scripts/worktree-bootstrap; echo "exit=$?"
```

Expected: prints `usage: worktree-bootstrap <worktree-path>`, non-zero exit.

- [ ] **Step 7: Verify shellcheck is clean**

```bash
cd /Users/maxime.grebauval/projects/dotfiles
shellcheck -S warning scripts/worktree-bootstrap && echo "shellcheck clean"
```

Expected: `shellcheck clean`

- [ ] **Step 8: Ask for approval, then commit**

Show the file and the message, wait for a go, then:

```bash
git add scripts/worktree-bootstrap
git commit -m "feat(git): add worktree-bootstrap to install deps in a new worktree"
```

---

## Task 2: Wire it into the lazygit command

**Files:**
- Modify: `.config/lazygit/config.yml` (the `Path` prompt's `initialValue`, and `command`)

**Interfaces:**
- Consumes: `~/scripts/worktree-bootstrap <path>` from Task 1.
- Produces: nothing for later tasks.

- [ ] **Step 1: Reproduce the path defect, so the fix is measured against a known-bad baseline**

```bash
cd /Users/maxime.grebauval/projects/orus-monorepo.worktree/frontend-testing
bash -c 'basename $(git rev-parse --show-toplevel)'
```

Expected: `frontend-testing`, which is what makes the current prefill produce the nested `frontend-testing.worktree/...` path.

- [ ] **Step 2: Verify the replacement expression from both positions**

```bash
for d in /Users/maxime.grebauval/projects/orus-monorepo \
         /Users/maxime.grebauval/projects/orus-monorepo.worktree/frontend-testing; do
  echo "$d ->"
  (cd "$d" && bash -c 'dirname $(git rev-parse --path-format=absolute --git-common-dir)')
done
```

Expected: both print `/Users/maxime.grebauval/projects/orus-monorepo`.

- [ ] **Step 3: Edit the `initialValue` line**

In `.config/lazygit/config.yml`, replace:

```yaml
        initialValue: "../{{ runCommand \"bash -c 'basename $(git rev-parse --show-toplevel)'\" }}.worktree/{{index .PromptResponses 0}}"
```

with:

```yaml
        initialValue: "{{ runCommand \"bash -c 'dirname $(git rev-parse --path-format=absolute --git-common-dir)'\" }}.worktree/{{index .PromptResponses 0}}"
```

Note the leading `../` is gone: the expression now yields an absolute path.

- [ ] **Step 4: Edit the `command` line**

Replace:

```yaml
    command: "git worktree add {{if .Form.NewBranch}}-b {{.Form.NewBranch | quote}} {{end}}{{.Form.Path | quote}} {{.Form.Branch | quote}}"
```

with:

```yaml
    command: "git worktree add {{if .Form.NewBranch}}-b {{.Form.NewBranch | quote}} {{end}}{{.Form.Path | quote}} {{.Form.Branch | quote}} && ~/scripts/worktree-bootstrap {{.Form.Path | quote}}"
```

Leave `output: terminal` and `loadingText` untouched.

- [ ] **Step 5: Verify the YAML still parses**

```bash
cd /Users/maxime.grebauval/projects/dotfiles
python3 -c "import yaml,sys; yaml.safe_load(open('.config/lazygit/config.yml')); print('yaml ok')"
```

Expected: `yaml ok`

- [ ] **Step 6: Run the whole chain end to end, exactly as the custom command will**

```bash
SCRATCH=/private/tmp/claude-501/-Users-maxime-grebauval-projects-orus-monorepo-worktree-frontend-testing/51dccf70-4c44-4c8f-9645-2c33df9885c7/scratchpad
E2E="$SCRATCH/wt-e2e"; rm -rf "$E2E"; mkdir -p "$E2E/main"
cd "$E2E/main" && git init -q
printf '{"name":"e2e","packageManager":"pnpm@11.18.0"}\n' > package.json
git add package.json && git -c user.email=t@t -c user.name=t commit -qm init

P="$(bash -c 'dirname $(git rev-parse --path-format=absolute --git-common-dir)').worktree/feature-x"
echo "prefill = $P"
git worktree add -b feature-x "$P" HEAD && ~/scripts/worktree-bootstrap "$P"
echo "--- result ---"
ls -d "$P/node_modules" && echo "OK: deps installed"
```

Expected: `prefill = $E2E/main.worktree/feature-x`, then `OK: deps installed`.

- [ ] **Step 7: Verify the defect-2 regression is actually gone**

```bash
cd "$P" && bash -c 'dirname $(git rev-parse --path-format=absolute --git-common-dir)'
```

Expected: `$E2E/main`, **not** `$E2E/main.worktree/feature-x`. This is the case that produced the orphaned nested worktree.

- [ ] **Step 8: Clean up the end-to-end fixture**

```bash
cd "$E2E/main" && git worktree remove --force "$P"
rm -rf "$E2E"
```

- [ ] **Step 9: Ask for approval, then commit**

```bash
git add .config/lazygit/config.yml
git commit -m "fix(lazygit): anchor worktree path to the main repo and install deps"
```

---

## Task 3: The `doctor.sh` guards

Written **before** the cleanup on purpose: check 3 must be seen firing against the real broken hook, otherwise there is no evidence it works.

**Files:**
- Modify: `scripts/doctor.sh` (new section after the `tmux` section; shellcheck glob in the `Formatting and linting` section)

**Interfaces:**
- Consumes: `~/scripts/worktree-bootstrap` from Task 1.
- Produces: nothing for later tasks.

- [ ] **Step 1: Add the new section**

Insert immediately **before** the line `section "Documentation matches reality"`:

```bash
# --------------------------------------------------------------------------
section "Worktrees"
# The lazygit "W" command installs dependencies through this script. When it was
# an unversioned .git/hooks/post-checkout running `yarn install` in a pnpm repo,
# it failed on every worktree and nobody noticed for months.
if [[ -x scripts/worktree-bootstrap ]]; then
  ok "worktree-bootstrap is executable"
else
  fail "scripts/worktree-bootstrap is missing or not executable -- new worktrees get no dependencies"
fi

# A per-repo hook runs before the lazygit command and would silently pre-empt it.
# The *.sample files git installs by default (14 per repo) are not hooks.
stale=0
for repo in "$HOME"/projects/*/; do
  [[ -d "${repo}.git/hooks" ]] || continue
  while read -r hook; do
    warn "stale git hook $(basename "$hook") in ${repo}.git/hooks -- it runs before the lazygit command"
    stale=1
  done < <(find "${repo}.git/hooks" -maxdepth 1 -type f ! -name '*.sample')
done
[[ "$stale" -eq 0 ]] && ok "no per-repo git hooks shadowing worktree-bootstrap"
```

- [ ] **Step 2: Extend the shellcheck glob**

In the `Formatting and linting` section, change:

```bash
    n=$(shellcheck -S warning .config/sketchybar/plugins/*.sh .config/sketchybar/items/*.sh \
      scripts/*.sh scripts/tmux-* 2>/dev/null | grep -c '^In ' || true)
```

to:

```bash
    n=$(shellcheck -S warning .config/sketchybar/plugins/*.sh .config/sketchybar/items/*.sh \
      scripts/*.sh scripts/tmux-* scripts/worktree-bootstrap 2>/dev/null | grep -c '^In ' || true)
```

- [ ] **Step 3: Run doctor and confirm the guard fires on the real broken hook**

```bash
cd /Users/maxime.grebauval/projects/dotfiles
./scripts/doctor.sh --quick 2>&1 | sed -n '/Worktrees/,/^$/p'
```

Expected, while the broken hook still exists:

```
Worktrees
  ok    worktree-bootstrap is executable
  warn  stale git hook post-checkout in /Users/maxime.grebauval/projects/orus-monorepo/.git/hooks -- it runs before the lazygit command
```

If the warning does **not** appear, the check is broken. Fix it before continuing: the whole point of Task 3 is that this fires.

- [ ] **Step 4: Verify doctor.sh itself is still shellcheck-clean**

```bash
shellcheck -S warning scripts/doctor.sh && echo "shellcheck clean"
```

Expected: `shellcheck clean`

- [ ] **Step 5: Verify this change adds no new failure**

The repo's baseline is **not** green: `./scripts/doctor.sh` already exits 1 on
three pre-existing failures unrelated to this work (two Keychain secrets,
`GITLAB_PERSONAL_ACCESS_TOKEN` and `CONTEXT7_API_KEY`, plus `agavra/tap/tuicr`
declared in the Brewfile but not installed). So the check is *no new failure*,
not a green run.

```bash
./scripts/doctor.sh 2>&1 | grep -E 'FAIL|failed'
```

Expected: exactly those three `FAIL` lines, all in the `Secrets` and `Brewfile`
sections. The new `Worktrees` section must contribute warnings only, never a
`FAIL`, since warnings do not affect the exit status.

Then confirm the widened shellcheck glob did not regress the count:

```bash
before=$(shellcheck -S warning .config/sketchybar/plugins/*.sh .config/sketchybar/items/*.sh \
  scripts/*.sh scripts/tmux-* 2>/dev/null | grep -c '^In ' || true)
after=$(shellcheck -S warning .config/sketchybar/plugins/*.sh .config/sketchybar/items/*.sh \
  scripts/*.sh scripts/tmux-* scripts/worktree-bootstrap 2>/dev/null | grep -c '^In ' || true)
echo "$before -> $after"
```

Expected: `13 -> 13`.

- [ ] **Step 6: Ask for approval, then commit**

```bash
git add scripts/doctor.sh
git commit -m "feat(scripts): check worktree-bootstrap and stale per-repo git hooks"
```

---

## Task 4: One-off cleanup

Nothing here is committed: both targets live outside the dotfiles repo. The deliverable is the `doctor.sh` warning from Task 3 going quiet.

**Files:**
- Delete: `/Users/maxime.grebauval/projects/orus-monorepo/.git/hooks/post-checkout`

- [ ] **Step 1: Read the hook one last time and confirm it is the broken one**

```bash
cat /Users/maxime.grebauval/projects/orus-monorepo/.git/hooks/post-checkout
```

Expected: ends with `yarn install`. If it has been changed since the spec, stop and ask.

- [ ] **Step 2: Delete it**

```bash
rm /Users/maxime.grebauval/projects/orus-monorepo/.git/hooks/post-checkout
```

- [ ] **Step 3: Prune the orphaned nested worktree left by the path defect**

```bash
cd /Users/maxime.grebauval/projects/orus-monorepo
git worktree list | grep prunable
git worktree prune
git worktree list | grep -c prunable
```

Expected: the `reduce-chromatic-usage.worktree/chromatic-spec` line is listed as prunable before, and the final count is `0` after.

- [ ] **Step 4: Confirm the doctor guard is now quiet**

```bash
cd /Users/maxime.grebauval/projects/dotfiles
./scripts/doctor.sh --quick 2>&1 | sed -n '/Worktrees/,/^$/p'
```

Expected:

```
Worktrees
  ok    worktree-bootstrap is executable
  ok    no per-repo git hooks shadowing worktree-bootstrap
```

- [ ] **Step 5: Confirm nothing was left staged**

```bash
git status --short -- scripts/ .config/lazygit/ docs/superpowers/
```

Expected: no output.

---

## Final verification, by the user

Two checks that need a real TUI and cannot be automated. They are the reason the plan exists, so do not declare the work done before the user runs them.

- [ ] **Check 1: Create a worktree from lazygit opened in the main repo**

Open lazygit in `~/projects/orus-monorepo`, press `W`, enter a branch name. Expect: the path prefill reads `/Users/maxime.grebauval/projects/orus-monorepo.worktree/<branch>`, the TUI suspends, `worktree-bootstrap: pnpm install in ...` streams to the terminal, and the new worktree has `node_modules` when lazygit returns.

- [ ] **Check 2: Create a worktree from lazygit opened inside a worktree**

Open lazygit in any `orus-monorepo.worktree/*` directory and press `W`. Expect the same prefill as check 1, with no `<worktree-name>.worktree/` nesting.

# Persistent tmux sessions — design

**Date:** 2026-07-29
**Status:** Approved
**Author:** Maxime Grebauval

## Context

Current tmux state:

- One long-lived session `Work`, holding 7 hand-named windows (`referral`,
  `migration`, `react rules`, …), each a single pane sitting in a different
  `orus-monorepo` worktree. Its content is highly dynamic — windows come and go
  with the tasks.
- Two families of throwaway sessions created on demand by scripts:
  `dash` (`scripts/tmux-dash-toggle`) and `_popup_*` (`scripts/tmux-popup`).
- No persistence plugin installed (`tmux-resurrect` / `tmux-continuum` are
  absent from `.tmux.conf`), and no auto-attach in `.zshrc` or Ghostty: the
  tmux server is started and attached by hand.

Two pain points:

1. There is no personal counterpart to `Work` — dotfiles and personal projects
   are opened wherever, usually inside `Work`.
2. Nothing survives a reboot. After restarting the machine, both sessions have
   to be recreated from memory.

## Goals

1. A second long-lived session, `Perso & configs`, alongside `Work`.
2. Both sessions exist again after a reboot without any manual step.
3. The layout is declared in the dotfiles repo, so it is versioned and
   reproducible on a fresh machine.
4. Attaching to tmux requires no typing: opening a terminal lands in a session.

## Non-goals

- **No state snapshotting.** `tmux-resurrect` / `tmux-continuum` are explicitly
  out of scope. After a reboot the sessions come back with their declared base
  layout, not with whatever windows were open before. The ad hoc worktree
  windows of `Work` are recreated by hand, as today.
- No change to `dash` or `_popup_*`, which stay on-demand and throwaway.
- No auto-creation of a window per worktree.

## Design

### Session inventory

| Session           | Base window | Working directory              | Lifetime           |
| ----------------- | ----------- | ------------------------------ | ------------------ |
| `Work`            | `monorepo`  | `~/projects/orus-monorepo`     | Declared, bootstrapped |
| `Perso & configs` | `dotfiles`  | `~/projects/dotfiles`          | Declared, bootstrapped |
| `dash`            | —           | —                              | On demand (unchanged) |
| `_popup_*`        | —           | —                              | On demand (unchanged) |

### Component 1 — `scripts/tmux-sessions`

An idempotent bootstrap script, the single source of truth for the declared
layout. Reachable as `~/scripts/tmux-sessions` through the existing
`~/scripts` → `~/projects/dotfiles/scripts` symlink.

```bash
#!/bin/bash
# Ensure the long-lived tmux sessions exist. Idempotent: safe to run any time.
ensure() {  # ensure <session> <window> <cwd>
  tmux has-session -t "=$1" 2>/dev/null ||
    tmux new-session -d -s "$1" -n "$2" -c "$3"
}
ensure "Work"            "monorepo" "$HOME/projects/orus-monorepo"
ensure "Perso & configs" "dotfiles" "$HOME/projects/dotfiles"
```

Two details that matter:

- `-t "=$1"` forces an **exact** session-name match. Without the `=` prefix,
  `has-session` falls back to prefix and `fnmatch` matching, so a target could
  match an unrelated session and the bootstrap would silently skip it.
- `-n <name>` sets the window name *and* disables `automatic-rename` for that
  window, so `monorepo` and `dotfiles` are not overwritten by the running
  command. This mirrors how the existing hand-named windows keep their names.

Running the script never touches an existing session: the currently running
`Work` with its 7 worktree windows is left exactly as-is.

### Component 2 — `.zshrc` hook

Placed at the very top of `.zshrc`, **above** the Powerlevel10k instant-prompt
block. Rationale: the hook ends in an `exec`, and running it after the instant
prompt has been printed would draw a prompt only to immediately replace the
shell. At that point `brew shellenv` has not run yet, so `tmux` may be absent
from `PATH` — hence the absolute-path fallback.

```zsh
# Long-lived tmux sessions: ensure they exist, then attach to the most recent one.
if [[ -o interactive && -z "$TMUX" && -z "$NO_TMUX" && -t 1 ]]; then
  _tmux=${commands[tmux]:-/opt/homebrew/bin/tmux}
  if [[ -x $_tmux ]]; then
    "$HOME/scripts/tmux-sessions" && exec "$_tmux" attach
  fi
  unset _tmux
fi
```

`tmux attach` is called **without** `-t`, deliberately: tmux picks the target
itself. If the bootstrap fails, the `&&` short-circuits and the shell continues
normally rather than leaving an unusable terminal.

What "tmux picks the target itself" actually means was measured, not assumed:
tmux selects the session with the most recent **activity** (`session_activity`),
not the most recently attached one and not the first created. Observed values on
a live server:

| Session | `session_activity` | `session_last_attached` |
| ------- | ------------------ | ----------------------- |
| `dash` | 17:31:13 | 17:31:07 |
| `Work` | 17:31:07 | 17:28:45 |
| `Perso & configs` | 17:29:33 | never |

Consequences, accepted knowingly:

- **After a reboot**, neither declared session has ever been attached, so the
  activity timestamp decides: the terminal lands on `Perso & configs`, created
  last by the bootstrap — not on `Work`.
- **In daily use**, `dash` usually wins, because `gh dash` refreshes on its own
  and keeps bumping its activity timestamp.
- A lingering `_popup_*` session can win right after it is closed. Those
  sessions are configured with `prefix None` and `status off`, so landing in one
  gives a session with no prefix key until it is left again.

The way out in all three cases is the session switcher (`prefix + s`, tmux-fzf),
or `NO_TMUX=1` for a bare shell. Making the target explicit — filtering out
`dash` and `_popup_*` and falling back to `Work` — was considered and rejected
in favor of keeping the hook to a single unconditional command.

### Guard conditions

Each guard exists for a concrete failure mode, verified against the current
setup:

| Guard | Prevents |
| ----- | -------- |
| `-o interactive` | Firing in scripts and non-interactive shells |
| `-z "$TMUX"` | Hijacking shells already inside tmux — including `display-popup -E`, which **does** inherit `$TMUX` (verified), so the `zsh -ic nvim` editor popup of `tmux-fzf-links` is safe |
| `-z "$NO_TMUX"` | No escape hatch: `NO_TMUX=1 zsh` gives a bare shell |
| `-t 1` | `exec tmux attach` failing with "open terminal failed" where stdout is not a tty |

The Claude Code / agent shell is covered three times over: it runs with `$TMUX`
set, non-interactive, and without a tty.

## Accepted trade-offs

1. A second Ghostty window attaches to the **same** session, producing a
   mirrored view. Standard tmux behavior, not a bug. Workarounds if it ever
   becomes annoying: `NO_TMUX=1` for a bare shell, or a dedicated
   `tmux new-session -A` invocation.
2. The attach target is whatever tmux decides — see the table above. `dash` and
   popup sessions are reachable this way.

## Verification

Results below are from the actual run, not intentions.

| # | Check | Result |
| - | ----- | ------ |
| 1 | `~/scripts/tmux-sessions`, then `tmux ls` | `Perso & configs` created, window `dotfiles`, cwd `~/projects/dotfiles`, `automatic-rename=off`. `Work` untouched. |
| 2 | Run the script a second time | Exit 0, still 4 sessions, no duplicate. |
| 3 | Guard: interactive + tty, `TMUX` unset | Branch taken, resolved `/opt/homebrew/bin/tmux`. |
| 4 | Guard: `NO_TMUX=1` | Skipped. |
| 5 | Guard: `TMUX` set (pane / `display-popup -E`, which inherits it) | Skipped — popup shells, including the fzf-links `zsh -ic nvim`, are safe. |
| 6 | Guard: non-interactive, no tty (agents, scripts) | Skipped. |
| 7 | End-to-end: real `.zshrc` in a pty sized to the live client | `exec tmux attach` succeeded, a second client appeared. It landed on `dash` — the behavior documented above. |

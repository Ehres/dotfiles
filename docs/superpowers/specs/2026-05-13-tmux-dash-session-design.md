# tmux `dash` session — design

**Date:** 2026-05-13
**Status:** Approved
**Author:** Maxime Grebauval

## Context

Today's tmux workflow:

- Sessions `perso` and `boulot`, each containing one window per PR
- Window 1 of each session is reserved for `gh dash` (PR dashboard)
- `lazygit`, `yazi`, `btop` are accessed via popups (`prefix + g`, `y`, `m`)
- `gh-dash` has a custom keybind `T` that runs `tmux new-window` to launch
  `gh enhance` for the selected PR

Pain point: `gh dash` on a reserved window is clunky. Accessing it requires
switching windows, and returning to the previous context requires another
switch. The desired behavior is the same fast in / fast out / context-preserved
pattern used for lazygit, but `gh dash` cannot be put in a popup because the
popup session would isolate the `T` binding from the user's work sessions and
break the enhance launcher flow.

## Goals

1. Open `gh dash` with a single keybind from anywhere
2. Leave `gh dash` with a single keybind and land back exactly where you came
   from
3. Preserve the `T` (enhance) launcher flow without re-architecture
4. Free window 1 of `perso` and `boulot` so PR windows can claim the natural
   `1, 2, 3...` numbering
5. Persist `gh dash` state (filters, scroll, section) across toggles

## Design

### Topology

A third, "transverse" tmux session named `dash` is added alongside `perso` and
`boulot`:

| Session  | Role            | Contents                                              |
| -------- | --------------- | ----------------------------------------------------- |
| `perso`  | Personal dev    | Dev windows (editors, terminals)                      |
| `boulot` | Work dev        | Dev windows (editors, terminals)                      |
| `dash`   | PR management   | w1 = `gh dash`, w2+ = `gh enhance` for PRs in review  |

`dash` is created on demand at the first toggle and persists for the lifetime
of the tmux server.

### Toggle script

`~/scripts/tmux-dash-toggle`:

```bash
#!/bin/bash
if [ "$(tmux display-message -p '#{session_name}')" = "dash" ]; then
  tmux switch-client -l
else
  tmux has-session -t dash 2>/dev/null || \
    tmux new-session -d -s dash 'gh dash'
  tmux switch-client -t dash
fi
```

Behavior:

- From `perso` or `boulot`: switch to `dash` (creating it if needed), landing
  on its last-active window. State preserved.
- From `dash`: switch to the previous session via `switch-client -l`, landing
  on its last-active window. State preserved on both sides.

### tmux binding

In `.tmux.conf`:

```tmux
bind d run-shell '~/scripts/tmux-dash-toggle'
```

This overrides the default `prefix + d` (`detach-client`). The default is
rarely used interactively; `tmux detach` from a shell remains available, and
detach can be rebound to `prefix + D` if needed later. There is no conflict
with `Ctrl + d` (shell EOF / pane close), which operates outside the prefix.

### Enhance launcher

The existing `gh-dash` keybind for `T` stays unchanged:

```yaml
- key: T
  command: >-
    tmux new-window -n "Enhance - {{.HeadRefName}}" '
      gh enhance -R {{.RepoName}} {{.PrNumber}}
    '
```

Because `T` is invoked while inside the `dash` session, `tmux new-window`
creates the enhance window in `dash`. Reviews stack as windows 2, 3, 4, ...
of `dash`. When a review is done, `Ctrl + d` at the last pane closes the
window (existing behavior).

## Flow examples

**Open dash to check inbox:**
`prefix + d` from `boulot` → arrive on `dash` at last-active window (gh dash
on first use, otherwise wherever you left off).

**Review a PR:**
From dash window 1, navigate to a PR, press `T` → enhance launches in dash
window 2, you arrive on it.

**Step away from a review to do dev work:**
`prefix + d` from enhance window → back to `boulot` at its last-active window.

**Resume the review:**
`prefix + d` from `boulot` → back to `dash` at the enhance window (last-active
within dash).

**Switch to gh dash from within an enhance review:**
`prefix + 1` (dash's window 1 = `gh dash`).

## Non-goals

- Filter `gh dash` differently per work context. One shared instance is enough;
  the `My PRs / Needs Review / Involved` sections already aggregate across
  repos. If a future need emerges, two sessions `dash-perso` / `dash-boulot`
  could be added without changing the toggle pattern.
- Sub-second cross-session navigation from inside enhance back to `dash`'s
  window 1 (current `prefix + 1` is sufficient).
- Cleanup of stale enhance windows (manual `Ctrl + d` is the existing pattern).

## Trade-offs

- **Loss of "PR review next to dev work" fluidity:** reviewing a PR via
  enhance and then jumping into local dev code now crosses a session boundary
  (a single `prefix + d` toggle). Acceptable when reviews are mostly
  read-and-comment via the TUI.
- **Multi-client tmux:** if two terminals are attached to the same tmux server
  and both use the toggle, `switch-client -l` operates per client and works
  correctly. No global state is shared between clients in this design.

## Files affected

- New: `~/scripts/tmux-dash-toggle` (executable bash script)
- Modified: `.tmux.conf` — add `bind d run-shell '~/scripts/tmux-dash-toggle'`
- Unchanged: `.config/gh-dash/config.yml`

## Validation

- `prefix + d` from `perso`, `boulot`, and any other session switches to
  `dash`, creating it if absent
- `prefix + d` from `dash` returns to the previous session
- `gh dash` state survives toggles (filter, scroll position, section)
- `T` in `gh dash` opens an enhance window in `dash`, not in the previous
  session
- `Ctrl + d` (shell EOF) behavior in panes and windows is unchanged
- Detaching tmux via `tmux detach` from a shell still works

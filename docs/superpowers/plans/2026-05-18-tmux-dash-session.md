# tmux `dash` Session — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `gh dash` from a reserved window 1 of `perso`/`boulot` sessions into a dedicated transverse tmux session named `dash`, with a single `prefix + d` keybind that toggles into and out of it while preserving the last-active window on both sides.

**Architecture:** A small `tmux-dash-toggle` bash script reads the current session name. If it's `dash`, it calls `switch-client -l` to go back to the previous session; otherwise it creates `dash` on demand (`new-session -d -s dash 'gh dash'`) and switches to it. The script is bound to `prefix + d` in `.tmux.conf`. The existing `gh-dash` `T` keybind for enhance stays untouched — invoked from inside `dash`, `tmux new-window` naturally stacks enhance reviews as windows of `dash`.

**Tech Stack:** bash, tmux 3.x, gh, gh-dash extension.

**Spec:** `docs/superpowers/specs/2026-05-13-tmux-dash-session-design.md`

---

## File Structure

- **Create:** `scripts/tmux-dash-toggle` — toggle script (10 lines of bash, executable). Lives in `dotfiles/scripts/` and is reached at runtime via `~/scripts/tmux-dash-toggle` (the `~/scripts` symlink already points to `~/projects/dotfiles/scripts`).
- **Modify:** `.tmux.conf` — one new `bind d` line added near the other popup/launcher bindings (lines 83-85).
- **Unchanged:** `.config/gh-dash/config.yml` — no edits; the `T` keybind continues to work because `tmux new-window` operates on the current session, which will be `dash` when `T` is pressed.

---

## Task 1: Create the toggle script

**Files:**
- Create: `scripts/tmux-dash-toggle` (executable)

- [ ] **Step 1: Write the script**

Create `/Users/maxime.grebauval/projects/dotfiles/scripts/tmux-dash-toggle` with the following content:

```bash
#!/bin/bash
# Toggle into / out of the `dash` tmux session.
# - From any other session: switch to `dash` (creating it if needed, starting `gh dash` in it).
# - From `dash`: switch back to the previous session via `switch-client -l`.

if [ "$(tmux display-message -p '#{session_name}')" = "dash" ]; then
  tmux switch-client -l
else
  tmux has-session -t dash 2>/dev/null || \
    tmux new-session -d -s dash 'gh dash'
  tmux switch-client -t dash
fi
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x /Users/maxime.grebauval/projects/dotfiles/scripts/tmux-dash-toggle
```

- [ ] **Step 3: Verify the file is executable and reachable via the symlink**

```bash
test -x /Users/maxime.grebauval/scripts/tmux-dash-toggle && echo OK
```

Expected: prints `OK`.

- [ ] **Step 4: Smoke test — run the script from inside a tmux session**

Open a tmux session (e.g., attach to `perso` or `boulot`, or create a scratch one with `tmux new -s scratch`). Then in a tmux pane:

```bash
~/scripts/tmux-dash-toggle
```

Expected behavior:
- A new tmux session named `dash` is created if not already present
- The current client switches to `dash`
- `gh dash` starts in window 1 of `dash`

Verify from another shell (outside tmux or in a different pane):

```bash
tmux list-sessions
```

Expected: a `dash` session is listed.

- [ ] **Step 5: Smoke test — run the script from inside the `dash` session**

While attached to `dash`, run:

```bash
~/scripts/tmux-dash-toggle
```

Expected: the client switches back to the previous session (the one you came from at Step 4). The `dash` session continues to exist in the background.

- [ ] **Step 6: Cleanup the smoke-test session (optional)**

If you created a scratch session for testing:

```bash
tmux kill-session -t scratch
```

Leave `dash` alive — it's the one we want.

- [ ] **Step 7: Commit**

```bash
git add scripts/tmux-dash-toggle
git commit -m "feat(tmux): add dash session toggle script"
```

---

## Task 2: Add the tmux binding

**Files:**
- Modify: `.tmux.conf` (insert a new `bind d` line in the launcher section, around lines 83-85)

- [ ] **Step 1: Add the binding**

Edit `/Users/maxime.grebauval/projects/dotfiles/.tmux.conf`. After line 85 (the `bind m ... btop` line), add:

```tmux
bind d run-shell '~/scripts/tmux-dash-toggle'
```

The launcher section should then look like:

```tmux
# Keybindings for floating panes (Escape passes through to app, Ctrl+q to close)
bind y display-popup -T " yazi (C-q close)" -d '#{pane_current_path}' -h 70% -w 80% -E '~/scripts/tmux-popup --kill yazi yazi'
bind g display-popup -T " lazygit (C-q close)" -w 90% -h 90% -d '#{pane_current_path}' -E '~/scripts/tmux-popup --kill lazygit lazygit'
bind m display-popup -T " btop (C-q close)" -w 90% -h 90% '~/scripts/tmux-popup btop btop'
bind d run-shell '~/scripts/tmux-dash-toggle'
```

- [ ] **Step 2: Reload the tmux config**

From any tmux pane:

```
prefix + r
```

(`unbind r` and `bind r source-file ~/.tmux.conf` are already defined at the top of `.tmux.conf` — line 1-2.)

Expected: tmux status bar may briefly flash; no error message.

- [ ] **Step 3: Verify the binding is registered**

From a shell:

```bash
tmux list-keys | grep -E "^bind-key\s+-T prefix\s+d\s"
```

Expected: one line showing `bind-key -T prefix d run-shell ~/scripts/tmux-dash-toggle`.

- [ ] **Step 4: Test toggle from a work session**

Kill any leftover `dash` session from Task 1 first, to test the on-demand creation path:

```bash
tmux kill-session -t dash 2>/dev/null
```

Then, attached to `perso` or `boulot` (or any non-`dash` session), press:

```
prefix + d
```

Expected: the client switches to `dash`, `gh dash` starts, you land on its window 1.

- [ ] **Step 5: Test toggle back to the previous session**

While in `dash`, press:

```
prefix + d
```

Expected: the client switches back to the session you were on at Step 4, landing on its last-active window. `dash` continues to exist in the background.

- [ ] **Step 6: Test state preservation across toggles**

From the previous session, press `prefix + d` again. Expected: you land back on `dash` at the same window you left it on (window 1, with the same scroll/filter/section state in `gh dash`).

Inside `gh dash`, scroll a few PRs down, then press `prefix + d` (back) and `prefix + d` again (return). Expected: scroll position preserved.

- [ ] **Step 7: Test the `T` (enhance) launcher from inside `dash`**

In `gh dash` (dash session, window 1), select any PR you can review, then press `T`.

Expected:
- A new window appears in the `dash` session (e.g., window 2) named `Enhance - <branch>`
- `gh enhance` starts in it
- You arrive on that window automatically (because `tmux new-window` switches to the new window by default)

Verify with:

```bash
tmux list-windows -t dash
```

Expected: at least 2 windows — `gh dash` (window 1) and `Enhance - <branch>` (window 2).

- [ ] **Step 8: Test return to work session from inside enhance**

While in the enhance window of `dash`, press:

```
prefix + d
```

Expected: switches back to the previous session (perso/boulot), on its last-active window.

- [ ] **Step 9: Test resuming the enhance review**

From the work session, press `prefix + d` again.

Expected: lands back on `dash` at the enhance window (the last-active window of `dash`), not at window 1.

- [ ] **Step 10: Verify `Ctrl + d` and `tmux detach` still work**

- In a regular pane in any session, press `Ctrl + d`. Expected: the shell exits, the pane closes. If it was the last pane in a window, the window closes. Unchanged behavior.
- From a shell, run `tmux detach`. Expected: detaches the client from tmux, returns to the parent terminal. Unchanged behavior.

- [ ] **Step 11: Commit**

```bash
git add .tmux.conf
git commit -m "feat(tmux): bind prefix+d to dash session toggle"
```

---

## Task 3: Migrate from the legacy window-1 layout

**Files:**
- None (operational cleanup in running tmux sessions)

This task is a one-time cleanup; nothing in version control changes. Skip if you are starting from a fresh tmux server.

- [ ] **Step 1: Close the legacy `gh dash` window in each work session**

For each running work session that still has `gh dash` on window 1:

```bash
# List windows of perso
tmux list-windows -t perso
# Identify the gh dash window (usually window 1)
# Then kill it:
tmux kill-window -t perso:1
```

Repeat for `boulot`. With `renumber-windows on` (already set in `.tmux.conf` line 8), the remaining windows renumber to `1, 2, 3, ...` automatically.

- [ ] **Step 2: Verify**

```bash
tmux list-windows -t perso
tmux list-windows -t boulot
```

Expected: no window running `gh dash` in either session. Windows are renumbered starting at 1.

- [ ] **Step 3: Confirm the new entry point**

From `perso` or `boulot`, press `prefix + d`. Expected: you land on `dash` with `gh dash` running. The toggle is now the only way to reach the dashboard.

---

## Acceptance — full validation checklist

Run through the spec's validation list to confirm everything works end-to-end:

- [ ] `prefix + d` from `perso`, `boulot`, and any other session switches to `dash`, creating it if absent
- [ ] `prefix + d` from `dash` returns to the previous session, on its last-active window
- [ ] `gh dash` state (filter, scroll, section) survives toggles
- [ ] `T` in `gh dash` opens an enhance window in `dash`, not in the previous session
- [ ] Returning to `dash` after stepping away lands on the last-active window of `dash` (preserves enhance review context)
- [ ] `Ctrl + d` (shell EOF) in panes/windows is unchanged
- [ ] `tmux detach` from a shell still works (default `prefix + d` for detach is the only thing we removed; detach via CLI remains)

If all check, the implementation is complete.

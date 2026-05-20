# tmux Window Title — Claude Activity Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Claude update the tmux window title's suffix slot with an emoji reflecting its current activity (🧠 ✍️ 🧪 ⏳ ❓ 🚫 ✅), driven by Claude Code hooks for mechanical lifecycle transitions plus a small skill for the three intent-bearing states only Claude can recognize.

**Architecture:** The existing `scripts/tmux-window-status` helper grows a second "suffix" layer (independent of the human-driven "prefix" layer) with a per-window ownership lock so two Claudes in split panes don't clobber each other. A skill bundle at `.claude/skills/tmux-window-status/` ships the manual-override instructions and a `hooks.json` fragment that gets merged into `~/.claude/settings.json`.

**Tech Stack:** bash, tmux 3.x, Claude Code hooks system.

**Spec:** `docs/superpowers/specs/2026-05-19-tmux-window-status-skill-design.md`

**Important:** Per the user's global git rule, ask explicit confirmation before each `git commit`. Commands are written out for clarity but should not be executed unattended.

---

## File Structure

- **Modify:** `scripts/tmux-window-status` — rewrite with layered render, six commands, and the suffix ownership lock.
- **Modify:** `scripts/tests/test-tmux-window-status.sh` — replace with extended test suite covering layered render + ownership lock.
- **Create:** `.claude/skills/tmux-window-status/SKILL.md` — three manual overrides (❓ 🚫 ✅) + subagent guard.
- **Create:** `.claude/skills/tmux-window-status/hooks.json` — source-of-truth hook fragment.
- **Modify (outside dotfiles):** `~/.claude/skills/tmux-window-status` — symlink into the dotfiles repo (install step, not committed).
- **Modify (outside dotfiles):** `~/.claude/settings.json` — merge the hook fragment in (install step, not committed).
- **Unchanged:** `.config/tmux-palette/commands.json`, `.config/tmux-palette/palettes/window-status.json` — palette JSON is back-compat with the new helper because `set <emoji>` still routes to `set-prefix`.

---

## Task 1: Extend helper with layered API (TDD)

**Files:**
- Modify: `scripts/tests/test-tmux-window-status.sh`
- Modify: `scripts/tmux-window-status`

- [ ] **Step 1: Replace the test file with the extended layered-API suite**

Overwrite `/Users/maxime.grebauval/projects/dotfiles/scripts/tests/test-tmux-window-status.sh` with this content:

```bash
#!/usr/bin/env bash
# Self-contained test for tmux-window-status.
# Mocks the `tmux` binary on PATH so the helper runs without a real tmux server.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$SCRIPT_DIR/tmux-window-status"

TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT

# Mock tmux: a PATH stub that reads/writes state files in $TMUX_MOCK_STATE.
cat > "$TEST_DIR/tmux" <<'MOCK'
#!/usr/bin/env bash
state="$TMUX_MOCK_STATE"
mkdir -p "$state"

opt_file() {
  case "$1" in
    @base-name)     echo "$state/base_name" ;;
    @status-prefix) echo "$state/status_prefix" ;;
    @status-suffix) echo "$state/status_suffix" ;;
    @suffix-owner)  echo "$state/suffix_owner" ;;
    *)              echo "$state/opt_$1" ;;
  esac
}

case "$1" in
  display-message)
    # display-message -p '#W'
    cat "$state/window_name" 2>/dev/null || echo ""
    ;;
  show)
    # show -wv @<opt>
    f="$(opt_file "${3:-}")"
    if [[ -f "$f" ]]; then
      cat "$f"
    else
      exit 1
    fi
    ;;
  set)
    # set -w @<opt> VALUE   OR   set -uw @<opt>
    if [[ "$2" == "-uw" ]]; then
      rm -f "$(opt_file "$3")"
    elif [[ "$2" == "-w" ]]; then
      printf '%s' "$4" > "$(opt_file "$3")"
    fi
    ;;
  rename-window)
    printf '%s' "$2" > "$state/window_name"
    ;;
  list-panes)
    # list-panes -a -F '#{pane_id}' — return panes from $state/panes
    cat "$state/panes" 2>/dev/null || true
    ;;
esac
MOCK
chmod +x "$TEST_DIR/tmux"

export PATH="$TEST_DIR:$PATH"
export TMUX_MOCK_STATE="$TEST_DIR/state"

pass=0
fail=0

assert_eq() {
  local actual="$1" expected="$2" label="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass=$((pass+1))
    printf '  ✓ %s\n' "$label"
  else
    fail=$((fail+1))
    printf '  ✗ %s\n     expected: %q\n     got:      %q\n' "$label" "$expected" "$actual"
  fi
}

assert_unset() {
  local file="$1" label="$2"
  if [[ ! -f "$file" ]]; then
    pass=$((pass+1))
    printf '  ✓ %s\n' "$label"
  else
    fail=$((fail+1))
    printf '  ✗ %s (file still present)\n' "$label"
  fi
}

reset_state() {
  rm -rf "$TMUX_MOCK_STATE"
  mkdir -p "$TMUX_MOCK_STATE"
  printf '%s' "my-window" > "$TMUX_MOCK_STATE/window_name"
  printf '%%1\n%%2\n' > "$TMUX_MOCK_STATE/panes"
  export TMUX="mock-socket"
  export TMUX_PANE="%1"
}

set_pane() {
  export TMUX_PANE="$1"
}

# ============================================================
# Layered API (Task 1)
# ============================================================

# --- Back-compat: `set` still works as prefix ---
reset_state
"$SCRIPT" set ⏳
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "⏳ my-window" "back-compat: set <emoji> renders as prefix"
assert_eq "$(cat "$TMUX_MOCK_STATE/status_prefix")" "⏳" "back-compat: set stores @status-prefix"
assert_eq "$(cat "$TMUX_MOCK_STATE/base_name")" "my-window" "back-compat: set captures @base-name"

# --- set-prefix is an explicit alias of set ---
reset_state
"$SCRIPT" set-prefix ⏳
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "⏳ my-window" "set-prefix: renders prefix"
"$SCRIPT" set-prefix 🚧
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "🚧 my-window" "set-prefix: swaps prefix"

# --- set-suffix layers on top of prefix ---
reset_state
"$SCRIPT" set-prefix ⏳
"$SCRIPT" set-suffix 🧠
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "⏳ my-window 🧠" "layered: prefix and suffix together"

# --- set-suffix alone ---
reset_state
"$SCRIPT" set-suffix 🧠
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window 🧠" "suffix-only render"
assert_eq "$(cat "$TMUX_MOCK_STATE/status_suffix")" "🧠" "set-suffix stores @status-suffix"

# --- clear-prefix removes only the prefix ---
reset_state
"$SCRIPT" set-prefix ⏳
"$SCRIPT" set-suffix 🧠
"$SCRIPT" clear-prefix
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window 🧠" "clear-prefix: suffix preserved"
assert_unset "$TMUX_MOCK_STATE/status_prefix" "clear-prefix: @status-prefix unset"

# --- clear-suffix removes only the suffix ---
reset_state
"$SCRIPT" set-prefix ⏳
"$SCRIPT" set-suffix 🧠
"$SCRIPT" clear-suffix
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "⏳ my-window" "clear-suffix: prefix preserved"
assert_unset "$TMUX_MOCK_STATE/status_suffix" "clear-suffix: @status-suffix unset"

# --- clear-prefix when no suffix renders bare base ---
reset_state
"$SCRIPT" set-prefix ⏳
"$SCRIPT" clear-prefix
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window" "clear-prefix solo: bare base"

# --- clear-suffix when no prefix renders bare base ---
reset_state
"$SCRIPT" set-suffix 🧠
"$SCRIPT" clear-suffix
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window" "clear-suffix solo: bare base"

# --- Per-layer clears keep @base-name ---
reset_state
"$SCRIPT" set-prefix ⏳
"$SCRIPT" clear-prefix
assert_eq "$(cat "$TMUX_MOCK_STATE/base_name")" "my-window" "clear-prefix keeps @base-name"

# --- clear (broadened) restores bare base and releases all options ---
reset_state
"$SCRIPT" set-prefix ⏳
"$SCRIPT" set-suffix 🧠
"$SCRIPT" clear
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window" "clear: restores bare base"
assert_unset "$TMUX_MOCK_STATE/base_name" "clear: @base-name unset"
assert_unset "$TMUX_MOCK_STATE/status_prefix" "clear: @status-prefix unset"
assert_unset "$TMUX_MOCK_STATE/status_suffix" "clear: @status-suffix unset"
assert_unset "$TMUX_MOCK_STATE/suffix_owner" "clear: @suffix-owner unset"

# --- clear with no prior status is a no-op ---
reset_state
"$SCRIPT" clear
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window" "clear (no status): window untouched"

# --- Window name with space is preserved ---
reset_state
printf '%s' "my window" > "$TMUX_MOCK_STATE/window_name"
"$SCRIPT" set-prefix ✅
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "✅ my window" "set-prefix: name with space"
"$SCRIPT" clear
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my window" "clear: name with space restored"

# --- Outside tmux: no-op ---
reset_state
unset TMUX
"$SCRIPT" set ⏳
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window" "outside tmux: no-op"
export TMUX="mock-socket"

# ============================================================
# Suffix ownership lock (Task 2)
# ============================================================

# --- First writer claims the lock ---
reset_state
set_pane "%1"
"$SCRIPT" set-suffix 🧠
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window 🧠" "lock: first writer updates"
assert_eq "$(cat "$TMUX_MOCK_STATE/suffix_owner")" "%1" "lock: ownership claimed by %1"

# --- Same pane keeps updating ---
"$SCRIPT" set-suffix ✍️
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window ✍️" "lock: owner can still update"

# --- Second pane is silenced ---
set_pane "%2"
"$SCRIPT" set-suffix 🚫
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window ✍️" "lock: non-owner is no-op"
assert_eq "$(cat "$TMUX_MOCK_STATE/suffix_owner")" "%1" "lock: ownership unchanged"
assert_eq "$(cat "$TMUX_MOCK_STATE/status_suffix")" "✍️" "lock: suffix unchanged by non-owner"

# --- clear-suffix from owner releases the lock ---
set_pane "%1"
"$SCRIPT" clear-suffix
assert_unset "$TMUX_MOCK_STATE/suffix_owner" "lock: clear-suffix releases ownership"

# --- After release, a different pane can claim ---
set_pane "%2"
"$SCRIPT" set-suffix 🧠
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window 🧠" "lock: %2 updates after release"
assert_eq "$(cat "$TMUX_MOCK_STATE/suffix_owner")" "%2" "lock: ownership transfers to %2"

# --- Stale owner (pane no longer in list-panes) is overridden ---
reset_state
printf '%%99' > "$TMUX_MOCK_STATE/suffix_owner"   # owner is a dead pane
printf '%s' "🧠" > "$TMUX_MOCK_STATE/status_suffix"
# panes file still lists %1 and %2 only
set_pane "%1"
"$SCRIPT" set-suffix ✍️
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window ✍️" "stale owner: overridden"
assert_eq "$(cat "$TMUX_MOCK_STATE/suffix_owner")" "%1" "stale owner: %1 claims"

# --- Ownership lock does NOT affect prefix layer ---
reset_state
set_pane "%1"
"$SCRIPT" set-suffix 🧠     # %1 owns suffix
set_pane "%2"
"$SCRIPT" set-prefix ⏳     # %2 should still set prefix
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "⏳ my-window 🧠" "lock: prefix unaffected by suffix owner"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[[ "$fail" == "0" ]]
```

Keep it executable:

```bash
chmod +x /Users/maxime.grebauval/projects/dotfiles/scripts/tests/test-tmux-window-status.sh
```

- [ ] **Step 2: Run the test and verify the new assertions fail**

```bash
/Users/maxime.grebauval/projects/dotfiles/scripts/tests/test-tmux-window-status.sh || true
```

Expected: many `✗` lines and a non-zero exit. The original `set` and `clear` assertions may still pass against the existing helper, but the new `set-prefix` / `set-suffix` / `clear-prefix` / `clear-suffix` / layered render / ownership-lock assertions will all fail. This confirms the new tests actually exercise behavior the current helper does not yet provide.

- [ ] **Step 3: Rewrite the helper with the layered API**

Overwrite `/Users/maxime.grebauval/projects/dotfiles/scripts/tmux-window-status` with this content:

```bash
#!/usr/bin/env bash
# Set or clear emoji workflow statuses on the current tmux window.
#
# Two independent layers:
#   - prefix: human-set via the tmux-palette "Set Window Status…" flow
#   - suffix: agent-set via Claude Code hooks and skill
#
# Rendered window name: [<prefix> ]<base>[ <suffix>]
#
# Usage:
#   tmux-window-status set <emoji>          # alias of set-prefix (back-compat)
#   tmux-window-status set-prefix <emoji>
#   tmux-window-status set-suffix <emoji>
#   tmux-window-status clear-prefix
#   tmux-window-status clear-suffix
#   tmux-window-status clear                # clears both layers and releases base
#
# Window-local tmux options used:
#   @base-name       — original window name (lazy-captured on first decoration)
#   @status-prefix   — current prefix emoji
#   @status-suffix   — current suffix emoji
#   @suffix-owner    — TMUX_PANE id of the Claude session that owns the suffix
#                      lock in this window (prevents multi-Claude clobbering)

set -euo pipefail

# Guard: outside tmux, no-op silently. Hooks and skill calls reach this guard
# transparently — callers do not need to check $TMUX themselves.
if [[ -z "${TMUX:-}" ]] || ! command -v tmux >/dev/null 2>&1; then
  exit 0
fi

get_opt() {
  tmux show -wv "$1" 2>/dev/null || true
}

set_opt() {
  tmux set -w "$1" "$2"
}

unset_opt() {
  tmux set -uw "$1" 2>/dev/null || true
}

ensure_base() {
  local base
  base="$(get_opt @base-name)"
  if [[ -z "$base" ]]; then
    base="$(tmux display-message -p '#W')"
    set_opt @base-name "$base"
  fi
}

render() {
  local base prefix suffix parts=()
  base="$(get_opt @base-name)"
  if [[ -z "$base" ]]; then
    return 0
  fi
  prefix="$(get_opt @status-prefix)"
  suffix="$(get_opt @status-suffix)"

  [[ -n "$prefix" ]] && parts+=("$prefix")
  parts+=("$base")
  [[ -n "$suffix" ]] && parts+=("$suffix")

  tmux rename-window "${parts[*]}"
}

pane_alive() {
  local pane="$1"
  [[ -z "$pane" ]] && return 1
  tmux list-panes -a -F '#{pane_id}' 2>/dev/null | grep -qx "$pane"
}

# Returns 0 if we own (or just claimed) the suffix lock for this window.
# Returns 1 if another live pane already owns it.
claim_suffix_owner() {
  local owner current
  owner="$(get_opt @suffix-owner)"
  current="${TMUX_PANE:-}"

  if [[ -n "$owner" ]]; then
    if [[ "$owner" == "$current" ]]; then
      return 0
    fi
    if pane_alive "$owner"; then
      return 1
    fi
    # Stale owner — fall through to claim.
  fi

  if [[ -n "$current" ]]; then
    set_opt @suffix-owner "$current"
  fi
  return 0
}

cmd="${1:-}"

case "$cmd" in
  set|set-prefix)
    emoji="${2:?usage: tmux-window-status $cmd <emoji>}"
    ensure_base
    set_opt @status-prefix "$emoji"
    render
    ;;
  set-suffix)
    emoji="${2:?usage: tmux-window-status set-suffix <emoji>}"
    if ! claim_suffix_owner; then
      exit 0   # another Claude owns this window's suffix
    fi
    ensure_base
    set_opt @status-suffix "$emoji"
    render
    ;;
  clear-prefix)
    unset_opt @status-prefix
    render
    ;;
  clear-suffix)
    unset_opt @status-suffix
    unset_opt @suffix-owner
    render
    ;;
  clear)
    base="$(get_opt @base-name)"
    if [[ -n "$base" ]]; then
      tmux rename-window "$base"
    fi
    unset_opt @status-prefix
    unset_opt @status-suffix
    unset_opt @suffix-owner
    unset_opt @base-name
    ;;
  *)
    echo "usage: tmux-window-status set|set-prefix|set-suffix <emoji> | clear-prefix|clear-suffix|clear" >&2
    exit 2
    ;;
esac
```

Make sure it's still executable:

```bash
chmod +x /Users/maxime.grebauval/projects/dotfiles/scripts/tmux-window-status
```

- [ ] **Step 4: Run the tests and verify everything passes**

```bash
/Users/maxime.grebauval/projects/dotfiles/scripts/tests/test-tmux-window-status.sh
```

Expected: every line prints `✓`, the final line reads `<N> passed, 0 failed` (where `<N>` is the total assertion count — currently 35 by inspection), exit code 0.

If any test fails, do NOT proceed. Re-read the helper and the failing assertion. Common failure modes:
- Render bug: missing space between layers → fix the `parts+=(…)` logic.
- Lock bug: a non-owner update went through → check the `claim_suffix_owner` return-code handling in the `set-suffix` branch.
- Stale-owner bug: the helper called `pane_alive` against the wrong pane id format → the mock uses `%1`/`%2`/`%99`; if the helper strips or formats the id, fix it.

- [ ] **Step 5: Sanity-check the helper directly in a real tmux pane**

In an active tmux pane:

```bash
~/scripts/tmux-window-status set-prefix ⏳
~/scripts/tmux-window-status set-suffix 🧠
```

Expected: the current window's name in the powerkit status bar becomes `⏳ <original-name> 🧠`.

```bash
~/scripts/tmux-window-status clear-suffix
```

Expected: suffix gone, name reads `⏳ <original-name>`.

```bash
~/scripts/tmux-window-status clear
```

Expected: name fully restored to `<original-name>`.

- [ ] **Step 6: Sanity-check the palette is still functional (back-compat)**

In tmux:

1. Press `C-Space` to open the main palette.
2. Pick `Set Window Status…` → `In Progress` (which calls `set 🚧`).
3. Expected: name becomes `🚧 <original-name>` — i.e., the back-compat path through the `set` alias still works.
4. Pick `Clear Status` (which calls `clear`).
5. Expected: name fully restored.

If the palette flow breaks, the back-compat code path in the helper's `case` is wrong. Fix and re-run tests.

- [ ] **Step 7: Ask the user for permission to commit, then commit**

Proposed message: `feat(scripts): layered prefix/suffix tmux-window-status`

```bash
git add scripts/tmux-window-status scripts/tests/test-tmux-window-status.sh
git commit -m "feat(scripts): layered prefix/suffix tmux-window-status"
```

---

## Task 2: Suffix ownership lock verification

Task 1 already includes the ownership-lock implementation **and** the lock test cases in the consolidated test suite. This task is a verification checkpoint, not new code — its purpose is to confirm the lock behaves correctly in real tmux (the mock cannot cover everything).

**Files:** none modified.

- [ ] **Step 1: Verify the lock test cases ran in Task 1**

```bash
/Users/maxime.grebauval/projects/dotfiles/scripts/tests/test-tmux-window-status.sh | grep -E '(lock|stale)'
```

Expected: every matching line starts with `✓`. If any `✗` appears, return to Task 1.

- [ ] **Step 2: Two-Claude live verification in tmux**

In a single tmux window, split into two panes (`C-b "` or your equivalent). Run two bash shells.

In pane A:
```bash
~/scripts/tmux-window-status set-suffix 🧠
```
Expected: window name becomes `<base> 🧠`.

In pane B:
```bash
~/scripts/tmux-window-status set-suffix ✍️
```
Expected: window name **unchanged** — still `<base> 🧠`. Pane B's call exited silently because pane A owns the suffix.

In pane A:
```bash
~/scripts/tmux-window-status clear-suffix
```
Expected: suffix cleared. Window name is just `<base>`.

In pane B (immediately):
```bash
~/scripts/tmux-window-status set-suffix ✍️
```
Expected: name becomes `<base> ✍️`. Pane B has claimed the lock now that pane A released it.

Clean up:
```bash
~/scripts/tmux-window-status clear
```

- [ ] **Step 3: Dead-pane verification**

In pane A:
```bash
~/scripts/tmux-window-status set-suffix 🧠
```

Close pane A entirely (e.g. type `exit` and press Enter — pane disappears).

In pane B:
```bash
~/scripts/tmux-window-status set-suffix ✍️
```

Expected: name becomes `<base> ✍️`. The helper detected that pane A's id is no longer in `tmux list-panes -F '#{pane_id}'` and treated the lock as stale, allowing pane B to claim.

Clean up:
```bash
~/scripts/tmux-window-status clear
```

- [ ] **Step 4: No commit**

No code changed in this task. Move on.

---

## Task 3: Build the skill bundle

**Files:**
- Create: `.claude/skills/tmux-window-status/SKILL.md`
- Create: `.claude/skills/tmux-window-status/hooks.json`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p /Users/maxime.grebauval/projects/dotfiles/.claude/skills/tmux-window-status
```

- [ ] **Step 2: Write SKILL.md**

Create `/Users/maxime.grebauval/projects/dotfiles/.claude/skills/tmux-window-status/SKILL.md` with this content:

```markdown
---
name: tmux-window-status
description: Update the tmux window title's suffix slot with an emoji reflecting your current activity. Use right before asking the user a clarifying question (❓), when surfacing a blocker (🚫), or after completing a task and reporting back (✅). Mechanical states (🧠 thinking, ✍️ writing, 🧪 running, ⏳ idle) are handled automatically by Claude Code hooks — do not set those yourself from this skill.
---

# tmux-window-status

Signal your current state to the user via the tmux window title's suffix slot. The user runs several Claude sessions across tmux windows; this lets them see at a glance which session needs attention.

## When to update

Only three states are this skill's responsibility — the rest are handled automatically by hooks.

| Emoji | When to set |
| --- | --- |
| ❓ | The very next thing you send is a clarifying question to the user. |
| 🚫 | You are surfacing a blocker — something prevents progress and the user needs to act. |
| ✅ | The task is complete and you have reported the result. |

Set the emoji **just before** the message that matches its meaning, so the title flips at the same moment the user sees the prompt change.

## How to update

Call the helper from Bash:

```
~/scripts/tmux-window-status set-suffix ❓
~/scripts/tmux-window-status set-suffix 🚫
~/scripts/tmux-window-status set-suffix ✅
```

The helper no-ops silently when not in tmux, so the call is always safe.

Do not announce the title change in chat — it is ambient signal, not a notification.

## Subagent guard

If you are a subagent dispatched via the Agent tool, **skip this skill entirely**. Only the top-level Claude Code session should write the window suffix. Subagents updating the title would flap it on every parent transition.

## Why no 🧠 / ✍️ / 🧪 / ⏳ here

Those states are set by Claude Code hooks in `~/.claude/settings.json` (event-driven, automatic). Setting them from this skill would duplicate the hook and waste a tool call.
```

- [ ] **Step 3: Write hooks.json (source-of-truth fragment)**

Create `/Users/maxime.grebauval/projects/dotfiles/.claude/skills/tmux-window-status/hooks.json` with this content:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "~/scripts/tmux-window-status clear-suffix"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/scripts/tmux-window-status set-suffix 🧠"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "~/scripts/tmux-window-status set-suffix ✍️"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "~/scripts/tmux-window-status set-suffix 🧪"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/scripts/tmux-window-status set-suffix ⏳"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/scripts/tmux-window-status clear-suffix"
          }
        ]
      }
    ]
  }
}
```

Note on `SessionStart`: it uses matcher `startup` so it fires only on initial session start, not on `resume` / `clear` / `compact`. This prevents the suffix from being wiped every time you resume a session.

- [ ] **Step 4: Validate JSON**

```bash
python3 -m json.tool /Users/maxime.grebauval/projects/dotfiles/.claude/skills/tmux-window-status/hooks.json > /dev/null && echo OK
```

Expected: prints `OK`. If `json.tool` errors, fix the JSON.

- [ ] **Step 5: Verify the skill bundle is laid out correctly**

```bash
ls -la /Users/maxime.grebauval/projects/dotfiles/.claude/skills/tmux-window-status/
```

Expected: two files, `SKILL.md` and `hooks.json`. Both regular files, sizes > 0.

- [ ] **Step 6: Verify the skill is not gitignored**

```bash
git -C /Users/maxime.grebauval/projects/dotfiles check-ignore -v .claude/skills/tmux-window-status/SKILL.md || echo "not ignored"
```

Expected: prints `not ignored`. If a `.gitignore` rule excludes `.claude/`, surface the issue to the user before committing — the user may have intended `.claude/` to be ignored entirely.

- [ ] **Step 7: Ask the user for permission to commit, then commit**

Proposed message: `feat(skills): add tmux-window-status agent skill`

```bash
git add .claude/skills/tmux-window-status/SKILL.md .claude/skills/tmux-window-status/hooks.json
git commit -m "feat(skills): add tmux-window-status agent skill"
```

---

## Task 4: Install the skill into ~/.claude/skills/

**Files (outside dotfiles):**
- Create symlink: `~/.claude/skills/tmux-window-status` → `~/projects/dotfiles/.claude/skills/tmux-window-status`

No file in the dotfiles repo changes in this task — the install is a symlink only.

- [ ] **Step 1: Verify the destination is clear**

```bash
ls -la /Users/maxime.grebauval/.claude/skills/tmux-window-status 2>/dev/null && echo "EXISTS"
```

Expected: nothing (the command fails because the path does not exist) OR `EXISTS` if it already does. If it already exists, STOP and surface to the user — the install would clobber existing content. The user can rename or remove the existing directory before continuing.

- [ ] **Step 2: Create the symlink**

```bash
ln -s /Users/maxime.grebauval/projects/dotfiles/.claude/skills/tmux-window-status \
      /Users/maxime.grebauval/.claude/skills/tmux-window-status
```

- [ ] **Step 3: Verify the symlink**

```bash
ls -la /Users/maxime.grebauval/.claude/skills/tmux-window-status
readlink /Users/maxime.grebauval/.claude/skills/tmux-window-status
ls /Users/maxime.grebauval/.claude/skills/tmux-window-status/
```

Expected:
- `ls -la` shows a symlink (`l` in the perms column) pointing into `~/projects/dotfiles/...`.
- `readlink` prints `/Users/maxime.grebauval/projects/dotfiles/.claude/skills/tmux-window-status`.
- The final `ls` lists `SKILL.md` and `hooks.json`.

- [ ] **Step 4: No commit**

The symlink is install state, not repo state.

---

## Task 5: Merge hooks into ~/.claude/settings.json

**Files (outside dotfiles):**
- Modify: `/Users/maxime.grebauval/.claude/settings.json`

This step is sensitive — the file holds the user's global Claude Code config (statusLine, model, enabled plugins). Be surgical.

- [ ] **Step 1: Back up the current settings**

```bash
cp /Users/maxime.grebauval/.claude/settings.json \
   /Users/maxime.grebauval/.claude/settings.json.bak
```

Verify the backup:

```bash
diff -q /Users/maxime.grebauval/.claude/settings.json \
        /Users/maxime.grebauval/.claude/settings.json.bak
```

Expected: identical (no output, exit 0).

- [ ] **Step 2: Read the current settings and the hook fragment**

```bash
cat /Users/maxime.grebauval/.claude/settings.json
cat /Users/maxime.grebauval/projects/dotfiles/.claude/skills/tmux-window-status/hooks.json
```

Confirm: the current settings file has no top-level `"hooks"` key. If it does, STOP — the user already has hooks configured, and the merge needs to combine them carefully. Surface to the user before continuing.

- [ ] **Step 3: Build the merged settings**

Run this Python merge in-place (preserves all existing keys, adds `hooks`):

```bash
python3 <<'PY'
import json, pathlib

settings_path = pathlib.Path("/Users/maxime.grebauval/.claude/settings.json")
hooks_path    = pathlib.Path("/Users/maxime.grebauval/projects/dotfiles/.claude/skills/tmux-window-status/hooks.json")

settings = json.loads(settings_path.read_text())
hooks_fragment = json.loads(hooks_path.read_text())

if "hooks" in settings:
    raise SystemExit("ABORT: settings.json already has a 'hooks' key — manual merge required.")

settings["hooks"] = hooks_fragment["hooks"]
settings_path.write_text(json.dumps(settings, indent=2) + "\n")
print("merged")
PY
```

Expected: prints `merged`. If it prints `ABORT`, return to Step 2 and surface to the user.

- [ ] **Step 4: Show the user the resulting file and ask for confirmation**

```bash
cat /Users/maxime.grebauval/.claude/settings.json
```

Show the output to the user. Confirm:
- All previously-present keys (`env`, `includeCoAuthoredBy`, `permissions`, `model`, `statusLine`, `enabledPlugins`, `extraKnownMarketplaces`, `tui`, `skipDangerousModePermissionPrompt`, `skipAutoPermissionPrompt`) still exist with their original values.
- A new `hooks` key is present with all five events.

If the user is not satisfied, restore from backup:

```bash
mv /Users/maxime.grebauval/.claude/settings.json.bak /Users/maxime.grebauval/.claude/settings.json
```

- [ ] **Step 5: Validate JSON**

```bash
python3 -m json.tool /Users/maxime.grebauval/.claude/settings.json > /dev/null && echo OK
```

Expected: prints `OK`.

- [ ] **Step 6: Remove the backup once the user confirms**

```bash
rm /Users/maxime.grebauval/.claude/settings.json.bak
```

- [ ] **Step 7: No commit**

`~/.claude/settings.json` is not in the dotfiles repo.

---

## Task 6: End-to-end manual verification

**Files:** none modified.

This task validates the full hooks+skill pipeline in a live Claude Code session. It must be done manually because hooks fire in response to Claude Code's lifecycle, which the test mock cannot reproduce.

- [ ] **Step 1: Restart Claude Code so hooks load**

Tell the user to exit the current Claude Code session and start a fresh one in the same tmux window. Hooks loaded from `~/.claude/settings.json` are read at session start.

- [ ] **Step 2: Verify SessionStart → clear-suffix**

In the fresh session, the window suffix should be empty. If a previous session left a stale suffix, it should be gone now.

Expected window name: bare base (e.g. `dotfiles`) — no trailing emoji.

- [ ] **Step 3: Verify UserPromptSubmit → 🧠**

Send any prompt to Claude (e.g. "list the files in this directory"). The moment Claude receives the prompt, the window title's suffix should flip to 🧠.

Expected window name during processing: `<base> 🧠`.

- [ ] **Step 4: Verify PreToolUse:Bash → 🧪**

Watch closely as Claude executes a Bash tool call (e.g. `ls`). The suffix should flip from 🧠 to 🧪 momentarily.

Expected window name during a Bash call: `<base> 🧪`.

- [ ] **Step 5: Verify PreToolUse:Edit/Write/MultiEdit → ✍️**

Ask Claude to make a trivial edit (e.g. "add a blank line at the end of README.md"). The suffix should flip to ✍️ when the Edit tool fires.

Expected window name during the edit: `<base> ✍️`.

- [ ] **Step 6: Verify Stop → ⏳**

After Claude finishes its response and returns control, the suffix should be ⏳.

Expected window name when Claude is idle: `<base> ⏳`.

- [ ] **Step 7: Verify the skill's manual overrides (❓ 🚫 ✅)**

Ask Claude something that requires a clarifying question (e.g. "improve the README" — vague enough to trigger a question). Before Claude asks, it should call the skill and set suffix to ❓.

Expected window name during a clarifying question: `<base> ❓`.

For ✅ and 🚫, ask Claude to complete a small task and report. After completion, suffix should be ✅. If Claude hits a blocker (e.g. ask it to use a tool it can't), suffix should be 🚫.

- [ ] **Step 8: Verify the prefix layer still works (palette interaction)**

While Claude is running:

1. Press `C-Space` → `Set Window Status…` → `Awaiting Stakeholder`.
2. Expected: prefix appears next to the existing suffix. Window name: `⏳ <base> 🧠` (or whatever the current suffix is).
3. Press `C-Space` → `Set Window Status…` → `Clear Status`.
4. Expected: BOTH prefix and suffix are cleared (`clear` is broadened by design). Window name: `<base>`.

If you want only the prefix cleared in step 3, that's outside this v1 — log it as a follow-up if it bothers you.

- [ ] **Step 9: Report results**

If any step misbehaves, surface to the user with:
- The exact step that failed.
- The observed window name vs the expected one.
- The likely culprit (helper bug? hook config? skill not loaded?).

If all steps pass, the implementation is complete.

---

## Final verification

- [ ] **Step 1: All three commits landed**

```bash
git -C /Users/maxime.grebauval/projects/dotfiles log --oneline -5
```

Expected (top to bottom, newest first):
1. `feat(skills): add tmux-window-status agent skill`
2. `feat(scripts): layered prefix/suffix tmux-window-status`
3. `docs(tmux-status-skill): spec claude window-status skill` (already landed before this plan)
4. earlier palette commits…

- [ ] **Step 2: Working tree is clean for the new files**

```bash
git -C /Users/maxime.grebauval/projects/dotfiles status
```

Expected: no untracked files under `scripts/`, `.claude/skills/`, or `docs/superpowers/specs/`. Pre-existing modified files (`.gitconfig`, `.config/btop/btop.conf`, untracked palette plan) are unrelated — leave them alone.

- [ ] **Step 3: Skill and hooks are live**

```bash
ls -la /Users/maxime.grebauval/.claude/skills/tmux-window-status
grep -A2 '"hooks":' /Users/maxime.grebauval/.claude/settings.json | head -5
```

Expected:
- Symlink target points at the dotfiles repo.
- `settings.json` contains a top-level `"hooks":` key.

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

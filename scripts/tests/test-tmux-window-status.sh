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
case "$1" in
  display-message)
    # display-message -p '#W' — print current window name
    cat "$state/window_name" 2>/dev/null || echo ""
    ;;
  show)
    # show -wv @base-name — print the option value, exit 1 if unset
    if [[ "${3:-}" == "@base-name" ]]; then
      if [[ -f "$state/base_name" ]]; then
        cat "$state/base_name"
      else
        exit 1
      fi
    fi
    ;;
  set)
    # set -w @base-name VALUE   OR   set -uw @base-name
    if [[ "$2" == "-uw" && "$3" == "@base-name" ]]; then
      rm -f "$state/base_name"
    elif [[ "$2" == "-w" && "$3" == "@base-name" ]]; then
      printf '%s' "$4" > "$state/base_name"
    fi
    ;;
  rename-window)
    printf '%s' "$2" > "$state/window_name"
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

reset_state() {
  rm -rf "$TMUX_MOCK_STATE"
  mkdir -p "$TMUX_MOCK_STATE"
  printf '%s' "my-window" > "$TMUX_MOCK_STATE/window_name"
}

# --- Test 1: set stores the base name and renames the window ---
reset_state
"$SCRIPT" set "⏳"
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "⏳ my-window" "set: window renamed with emoji prefix"
assert_eq "$(cat "$TMUX_MOCK_STATE/base_name")" "my-window" "set: base name stored in @base-name"

# --- Test 2: switching status swaps the emoji, leaves base name intact ---
"$SCRIPT" set "🚧"
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "🚧 my-window" "set (2nd call): emoji swapped"
assert_eq "$(cat "$TMUX_MOCK_STATE/base_name")" "my-window" "set (2nd call): base name unchanged"

# --- Test 3: clear restores the base name and unsets the option ---
"$SCRIPT" clear
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window" "clear: window restored to base name"
if [[ ! -f "$TMUX_MOCK_STATE/base_name" ]]; then
  pass=$((pass+1)); printf '  ✓ %s\n' "clear: @base-name unset"
else
  fail=$((fail+1)); printf '  ✗ %s\n' "clear: @base-name unset (file still present)"
fi

# --- Test 4: clear with no status set is a no-op ---
reset_state
"$SCRIPT" clear
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my-window" "clear (no status): window name untouched"

# --- Test 5: window name with a space is preserved ---
reset_state
printf '%s' "my window" > "$TMUX_MOCK_STATE/window_name"
"$SCRIPT" set "✅"
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "✅ my window" "set: handles window names containing spaces"
"$SCRIPT" clear
assert_eq "$(cat "$TMUX_MOCK_STATE/window_name")" "my window" "clear: restores name containing spaces"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[[ "$fail" == "0" ]]

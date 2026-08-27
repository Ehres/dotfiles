#!/bin/bash

set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SUBJECT="$ROOT/scripts/gh-dash-reviewers"
TEST_ROOT=$(mktemp -d)
trap 'rm -rf "$TEST_ROOT"' EXIT

export HOME="$TEST_ROOT/home"
export XDG_CACHE_HOME="$TEST_ROOT/cache"
export XDG_CONFIG_HOME="$TEST_ROOT/config"
export GH_CALLS="$TEST_ROOT/gh-calls"
export GH_API_CALL="$TEST_ROOT/gh-api-call"
export FZF_ARGS="$TEST_ROOT/fzf-args"
export FZF_INPUT="$TEST_ROOT/fzf-input"
FAKE_BIN="$TEST_ROOT/bin"

mkdir -p "$HOME" "$XDG_CACHE_HOME" "$XDG_CONFIG_HOME/gh-dash" "$FAKE_BIN"
: > "$XDG_CONFIG_HOME/gh-dash/reviewer-favorites"

cat > "$FAKE_BIN/gh" <<'FAKE_GH'
#!/bin/bash
if [ "$1" = api ]; then
  printf '%s\n' "$*" > "$GH_API_CALL"
  [ "${GH_API_FAIL:-0}" = 1 ] && exit 1
  printf '%s\n' "${GH_API_OUTPUT:-}"
  exit 0
fi
printf '%s\n' "$*" >> "$GH_CALLS"
FAKE_GH

cat > "$FAKE_BIN/fzf" <<'FAKE_FZF'
#!/bin/bash
printf '%s\n' "$@" > "$FZF_ARGS"
cat > "$FZF_INPUT"
[ "${FZF_EXIT:-0}" -ne 0 ] && exit "$FZF_EXIT"
printf '%s' "${FZF_SELECTION:-}"
FAKE_FZF

chmod +x "$FAKE_BIN/gh" "$FAKE_BIN/fzf"
export PATH="$FAKE_BIN:$PATH"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_eq() {
  [ "$1" = "$2" ] || fail "expected [$2], got [$1]"
}

reset_state() {
  rm -rf "$XDG_CACHE_HOME/gh-dash"
  : > "$GH_CALLS"
  : > "$GH_API_CALL"
  : > "$FZF_ARGS"
  : > "$FZF_INPUT"
  : > "$XDG_CONFIG_HOME/gh-dash/reviewer-favorites"
  unset GH_API_FAIL FZF_EXIT
  export GH_API_OUTPUT=""
  export FZF_SELECTION=""
}

test_multiple_reviewers_and_pagination() {
  reset_state
  GH_API_OUTPUT=$(for number in $(seq 1 42); do printf 'reviewer%s\n' "$number"; done)
  export GH_API_OUTPUT
  export FZF_SELECTION=$'reviewer1\nreviewer2'

  "$SUBJECT" request orus-tech/orus-monorepo 123

  assert_eq "$(wc -l < "$XDG_CACHE_HOME/gh-dash/reviewers/orus-tech/orus-monorepo" | tr -d ' ')" "42"
  grep -F -- '--paginate' "$GH_API_CALL" >/dev/null || fail "collaborators request is not paginated"
  assert_eq "$(cat "$GH_CALLS")" "pr edit 123 --repo orus-tech/orus-monorepo --add-reviewer reviewer1,reviewer2"
  grep -F 'ctrl-r:reload(' "$FZF_ARGS" >/dev/null || fail "fzf has no in-picker refresh binding"
}

test_favorites_are_first_and_not_preselected() {
  reset_state
  mkdir -p "$XDG_CACHE_HOME/gh-dash/reviewers/acme"
  printf 'alice\nbob\ncarol\n' > "$XDG_CACHE_HOME/gh-dash/reviewers/acme/app"
  printf 'carol\nmissing\n' > "$XDG_CONFIG_HOME/gh-dash/reviewer-favorites"

  actual=$("$SUBJECT" candidates acme/app)
  expected=$'carol\t[favorite] carol\nalice\talice\nbob\tbob'

  assert_eq "$actual" "$expected"
}

test_cancel_is_a_no_op() {
  reset_state
  export GH_API_OUTPUT="alice"
  export FZF_EXIT=130

  "$SUBJECT" request acme/app 7

  assert_eq "$(cat "$GH_CALLS")" ""
}

test_failed_refresh_preserves_cache() {
  reset_state
  mkdir -p "$XDG_CACHE_HOME/gh-dash/reviewers/acme"
  printf 'alice\n' > "$XDG_CACHE_HOME/gh-dash/reviewers/acme/app"
  export GH_API_FAIL=1

  if "$SUBJECT" candidates acme/app --refresh >/dev/null 2>&1; then
    fail "failed refresh returned success"
  fi

  assert_eq "$(cat "$XDG_CACHE_HOME/gh-dash/reviewers/acme/app")" "alice"
}

test_failed_initial_refresh_does_not_open_picker() {
  reset_state
  export GH_API_FAIL=1

  if "$SUBJECT" request acme/app 7 >/dev/null 2>&1; then
    fail "failed initial refresh returned success"
  fi

  assert_eq "$(cat "$FZF_ARGS")" ""
}

test_multiple_reviewers_and_pagination
test_favorites_are_first_and_not_preselected
test_cancel_is_a_no_op
test_failed_refresh_preserves_cache
test_failed_initial_refresh_does_not_open_picker
printf 'PASS: gh-dash reviewers\n'

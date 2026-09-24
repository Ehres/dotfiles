#!/bin/bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SUBJECT="$ROOT/.agents/skills/read-superpowers-spec/open-spec.sh"
TEST_ROOT=$(mktemp -d)
trap 'rm -rf "$TEST_ROOT"' EXIT

mkdir -p "$TEST_ROOT/bin" "$TEST_ROOT/docs/superpowers/specs"
touch "$TEST_ROOT/docs/superpowers/specs/example.md"
export TMUX=1
export TMUX_PANE=%1
export TMUX_CAPTURE="$TEST_ROOT/tmux-capture"

cat > "$TEST_ROOT/bin/tmux" <<'FAKE_TMUX'
#!/bin/bash
if [ "$1" = list-panes ]; then
  printf '%%1 123\n'
  exit 0
fi

in_nvim=0
while [ "$#" -gt 0 ]; do
  if [ "$1" = nvim ]; then
    in_nvim=1
    shift
  elif [ "$1" = -c ] && [ "$in_nvim" = 0 ]; then
    printf '%s\n' "$2" > "$TMUX_CAPTURE.cwd"
    shift 2
    continue
  elif [ "$1" = -- ] && [ "$in_nvim" = 1 ]; then
    shift
    printf '%s\n' "$1" > "$TMUX_CAPTURE.nvim"
    exit 0
  else
    shift
  fi
done
FAKE_TMUX
chmod +x "$TEST_ROOT/bin/tmux"
export PATH="$TEST_ROOT/bin:$PATH"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_eq() {
  [ "$1" = "$2" ] || fail "expected [$2], got [$1]"
}

assert_target_resolution() {
  local input_path=$1
  local expected_file=$2
  local pane_cwd nvim_path resolved_path

  rm -f "$TMUX_CAPTURE.cwd" "$TMUX_CAPTURE.nvim"
  (cd "$TEST_ROOT" && bash "$SUBJECT" "$input_path")

  pane_cwd=$(<"$TMUX_CAPTURE.cwd")
  nvim_path=$(<"$TMUX_CAPTURE.nvim")
  if [[ "$pane_cwd" != /* ]]; then
    pane_cwd="$TEST_ROOT/$pane_cwd"
  fi
  if [[ "$nvim_path" = /* ]]; then
    resolved_path=$nvim_path
  else
    resolved_path="$pane_cwd/$nvim_path"
  fi

  assert_eq "$pane_cwd" "$TEST_ROOT/docs/superpowers/specs"
  assert_eq "$resolved_path" "$expected_file"
}

assert_target_resolution \
  "docs/superpowers/specs/example.md" \
  "$TEST_ROOT/docs/superpowers/specs/example.md"
assert_target_resolution \
  "$TEST_ROOT/docs/superpowers/specs/example.md" \
  "$TEST_ROOT/docs/superpowers/specs/example.md"

printf 'PASS: target resolution\n'

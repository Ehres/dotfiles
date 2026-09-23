#!/bin/bash
set -euo pipefail

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
mkdir "$tmpdir/bin"

cat >"$tmpdir/bin/tmux" <<'EOF'
#!/bin/sh
case "$1" in
  list-panes) printf '%%1 111\n%%2 222\n' ;;
  split-window) printf '%s\n' "$*" >"$TMUX_TEST_CAPTURE" ;;
  *) exit 2 ;;
esac
EOF
cat >"$tmpdir/bin/ps" <<'EOF'
#!/bin/sh
case "$*" in
  *" -p "*123*) printf '222\n' ;;
  *" -p "*222*) printf '1\n' ;;
  *" -p "*) printf '123\n' ;;
  *) printf '1\n' ;;
esac
EOF
chmod +x "$tmpdir/bin/tmux" "$tmpdir/bin/ps"
export PATH="$tmpdir/bin:$PATH" TMUX=/tmp/tmux-test TMUX_TEST_CAPTURE="$tmpdir/capture"
touch "$tmpdir/spec.md"

# Simulated invoking process ancestry resolves pane %2 despite no TMUX_PANE.
if ! bash .agents/skills/read-superpowers-spec/open-spec.sh "$tmpdir/spec.md"; then
  printf 'helper unexpectedly failed\n' >&2
  exit 1
fi
if ! grep -q -- '-t %2' "$TMUX_TEST_CAPTURE"; then
  printf 'split did not target the invoking agent pane: ' >&2
  cat "$TMUX_TEST_CAPTURE" >&2
  exit 1
fi
printf 'target resolution regression test passed\n'

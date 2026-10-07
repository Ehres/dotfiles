#!/bin/sh
set -eu

ROOT=$(CDPATH=; cd -- "$(dirname -- "$0")/../.." && pwd)
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
CALLS="$TMP_DIR/calls"
WINDOWS="$TMP_DIR/windows.json"
FOCUSED_SPACE_FILE="$TMP_DIR/focused-space"

cat >"$TMP_DIR/yabai" <<'EOF'
#!/bin/sh
printf 'yabai %s\n' "$*" >>"$CALLS"
if [ "$*" = "-m query --windows" ]; then
	cat "$WINDOWS"
elif [ "$*" = "-m query --spaces --space" ]; then
	IFS= read -r FOCUSED <"$FOCUSED_SPACE_FILE"
	printf '{"index": %s}\n' "$FOCUSED"
else
	IFS= read -r FOCUSED <"$FOCUSED_SPACE_FILE"
	if [ "$*" = "-m space --focus $FOCUSED" ]; then
		exit 1
	fi
fi
EOF

cat >"$TMP_DIR/open" <<'EOF'
#!/bin/sh
printf 'open %s\n' "$*" >>"$CALLS"
EOF

chmod +x "$TMP_DIR/yabai" "$TMP_DIR/open"

assert_calls() {
	printf '%s\n' "$1" >"$TMP_DIR/expected"
	diff -u "$TMP_DIR/expected" "$CALLS"
}

run_focus() {
	CALLS="$CALLS" WINDOWS="$WINDOWS" YABAI_BIN="$TMP_DIR/yabai" OPEN_BIN="$TMP_DIR/open" \
		FOCUSED_SPACE_FILE="$FOCUSED_SPACE_FILE" \
		"$ROOT/scripts/yabai-focus-app" "$1"
}

cat >"$WINDOWS" <<'EOF'
[
  {"id": 1, "app": "Slack", "space": 1, "is-minimized": false, "is-hidden": true},
  {"id": 4, "app": "Finder", "space": 3, "is-minimized": false, "is-hidden": false},
  {"id": 2, "app": "Slack", "space": 4, "is-minimized": false, "is-hidden": false},
  {"id": 3, "app": "Slack", "space": 2, "is-minimized": false, "is-hidden": false}
]
EOF

printf '%s\n' '1' >"$FOCUSED_SPACE_FILE"
run_focus Slack
assert_calls 'yabai -m query --windows
yabai -m query --spaces --space
yabai -m space --focus 4
yabai -m window --focus 2'

: >"$CALLS"
cat >"$WINDOWS" <<'EOF'
[
  {"id": 10, "app": "ChatGPT", "space": 7, "subrole": "AXDialog", "is-minimized": false, "is-hidden": false, "is-sticky": true},
  {"id": 11, "app": "ChatGPT", "space": 3, "subrole": "AXStandardWindow", "is-minimized": false, "is-hidden": false, "is-visible": false}
]
EOF
printf '%s\n' '6' >"$FOCUSED_SPACE_FILE"
run_focus ChatGPT
assert_calls 'yabai -m query --windows
yabai -m query --spaces --space
yabai -m space --focus 3
yabai -m window --focus 11'

: >"$CALLS"
printf '%s\n' '6' >"$FOCUSED_SPACE_FILE"
cat >"$WINDOWS" <<'EOF'
[
  {"id": 12, "app": "ChatGPT", "space": 7, "subrole": "AXDialog", "is-minimized": false, "is-hidden": false}
]
EOF
run_focus ChatGPT
assert_calls 'yabai -m query --windows
yabai -m query --spaces --space
yabai -m space --focus 7
yabai -m window --focus 12'

: >"$CALLS"
printf '%s\n' '5' >"$FOCUSED_SPACE_FILE"
cat >"$WINDOWS" <<'EOF'
[
  {"id": 13, "app": "ChatGPT", "space": 5, "subrole": "AXStandardWindow", "is-minimized": false, "is-hidden": false},
  {"id": 14, "app": "ChatGPT", "space": 4, "subrole": "AXStandardWindow", "is-minimized": false, "is-hidden": false},
  {"id": 18, "app": "ChatGPT", "space": 2, "subrole": "AXStandardWindow", "is-minimized": false, "is-hidden": false, "is-sticky": true},
  {"id": 19, "app": "ChatGPT", "space": 1, "subrole": "AXStandardWindow", "is-minimized": false, "is-hidden": false, "is-sticky": false}
]
EOF
run_focus ChatGPT
assert_calls 'yabai -m query --windows
yabai -m query --spaces --space
yabai -m window --focus 13'

: >"$CALLS"
printf '%s\n' '2' >"$FOCUSED_SPACE_FILE"
cat >"$WINDOWS" <<'EOF'
[
  {"id": 15, "app": "ChatGPT", "space": 2, "subrole": "AXStandardWindow", "is-minimized": true, "is-hidden": false},
  {"id": 16, "app": "ChatGPT", "space": 2, "subrole": "AXStandardWindow", "is-minimized": false, "is-hidden": true},
  {"id": 17, "app": "ChatGPT", "space": 2, "subrole": "AXDialog", "is-minimized": false, "is-hidden": false}
]
EOF
run_focus ChatGPT
assert_calls 'yabai -m query --windows
yabai -m query --spaces --space
yabai -m window --focus 17'

: >"$CALLS"
printf '%s\n' '[{"id": 1, "app": "Slack", "space": 1, "is-minimized": true, "is-hidden": false}]' >"$WINDOWS"
run_focus Slack
assert_calls 'yabai -m query --windows
open -a Slack'

: >"$CALLS"
printf '%s\n' '[{"id": 25933, "app": "Dia", "space": 3, "is-minimized": false, "is-hidden": false}]' >"$WINDOWS"
printf '%s\n' '3' >"$FOCUSED_SPACE_FILE"
run_focus Dia
assert_calls 'yabai -m query --windows
yabai -m query --spaces --space
yabai -m window --focus 25933'

printf '%s\n' 'yabai-focus-app tests passed'

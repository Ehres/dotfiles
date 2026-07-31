#!/bin/bash
# Stop hook for Claude Code: post a macOS notification when a run finishes.
#
# This exists because the terminal cannot do it here. Ghostty's
# notify-on-command-finish needs OSC 133 to see command boundaries, and tmux
# absorbs OSC 133 rather than relaying it -- so in a tmux pane, which is every
# pane in this setup, the terminal never learns that a long agent run ended.
# opencode already gets this through its notification.ts plugin; this is the
# Claude Code half.
#
# Fails open and silent: a notification is never worth interrupting a session.

set -uo pipefail

payload=$(cat 2>/dev/null) || exit 0

title="Claude Code"
subtitle="Run finished"

if command -v jq >/dev/null 2>&1; then
  cwd=$(printf '%s' "$payload" | jq -r '.cwd // empty' 2>/dev/null)
  [[ -n "$cwd" ]] && subtitle="Finished in $(basename "$cwd")"
fi

# AppleScript string literals end at the first unescaped quote, so a title
# containing one would silently swallow the notification.
escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

osascript -e "display notification \"$(escape "$subtitle")\" with title \"$(escape "$title")\"" \
  >/dev/null 2>&1 || true

exit 0

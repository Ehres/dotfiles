#!/bin/bash
# PreToolUse[Bash] hook for Claude Code: block the handful of commands that
# cannot be undone.
#
# Rationale: permissions in this setup are deliberately permissive
# (defaultMode: auto, and opencode allows bash "*"), which is the right trade for
# fluency but leaves nothing between an agent and an irreversible action. A hook
# is deterministic where a prompt instruction is not.
#
# Protocol: the tool input arrives as JSON on stdin. Exit 0 allows; exit 2 blocks
# and shows stderr to the model so it can choose another route. Anything
# unexpected fails open -- a broken guard must not break the session.

set -uo pipefail

payload=$(cat 2>/dev/null) || exit 0
command -v jq >/dev/null 2>&1 || exit 0

cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[[ -z "$cmd" ]] && exit 0

block() {
  printf 'Blocked by claude-bash-guard: %s\n' "$1" >&2
  printf 'If this is genuinely intended, run it yourself outside the agent.\n' >&2
  exit 2
}

# Strip quoted spans before matching. Without this the guard fires on its own
# name appearing inside a commit message -- `git commit -m "... git reset --hard
# ..."` is not a reset -- and on any echo, grep pattern or heredoc that mentions a
# dangerous command. Quoted text is data, not an invocation.
#
# Then collapse whitespace, so patterns are not defeated by formatting alone.
# This is a guard rail, not a sandbox: it stops the obvious accident, not a
# determined bypass through variables, aliases or base64.
c=$(printf '%s' "$cmd" |
  sed -e "s/'[^']*'/''/g" -e 's/"[^"]*"/""/g' |
  tr '\n' ' ' | tr -s ' ')

# rm -rf whose target is a whole home or root, not something inside it.
# Deliberately narrow: blocking every `rm -rf "$HOME/..."` would fire on ordinary
# cache cleanup, and a guard that cries wolf is a guard that gets switched off.
if [[ "$c" =~ rm[[:space:]]+(-[a-zA-Z]*[rR][a-zA-Z]*[fF]|-[a-zA-Z]*[fF][a-zA-Z]*[rR])[a-zA-Z]* ]]; then
  # Target is / or $HOME or ~ with nothing meaningful after it.
  # shellcheck disable=SC2016  # the literal string $HOME is the pattern, not an expansion
  if [[ "$c" =~ rm[[:space:]]+-[a-zA-Z]+[[:space:]]+\"?(/|~|\$HOME|\$\{HOME\})\"?/?[[:space:]]*$ ]]; then
    block "recursive delete of an entire home or root directory"
  fi
  # An unset variable expands to nothing, turning `rm -rf "$dir"/` into `rm -rf /`
  # shellcheck disable=SC2016
  if [[ "$c" =~ rm[[:space:]]+-[a-zA-Z]+[[:space:]]+\"?\$\{?[A-Za-z_][A-Za-z_0-9]*\}?\"?/[[:space:]]*$ ]]; then
    block "recursive delete through a trailing-slash variable -- if it is unset this deletes /"
  fi
fi

# History rewrites on a shared ref
case "$c" in
*"git push"*"--force"*)
  # --force-with-lease refuses to clobber work it has not seen, so it is allowed
  [[ "$c" == *"--force-with-lease"* ]] || block "git push --force (use --force-with-lease)"
  ;;
*"git push "*" -f "* | *"git push "*" -f") block "git push -f (use --force-with-lease)" ;;
esac

case "$c" in
*"git reset --hard"*) block "git reset --hard discards uncommitted work" ;;
*"git clean -"*[fd]*) block "git clean removes untracked files irrecoverably" ;;
esac

# Production Kubernetes
if [[ "$c" == *"kubectl"* ]]; then
  case "$c" in
  *" delete "* | *" delete")
    case "$c" in
    *prd* | *prod*) block "kubectl delete against a production context" ;;
    esac
    ;;
  esac
fi

# Keychain destruction -- this is where the secrets live
case "$c" in
*"security delete-generic-password"*) block "deleting a Keychain entry" ;;
esac

# Remote code straight into a shell
case "$c" in
*curl*"| sh"* | *curl*"| bash"* | *curl*"|sh"* | *curl*"|bash"* | \
  *wget*"| sh"* | *wget*"| bash"*)
  block "piping a downloaded script straight into a shell -- download, read, then run"
  ;;
esac

exit 0

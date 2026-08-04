---
name: open-review
description: Launch tuicr, the local code-review TUI, in a tmux popup so the user can read a diff and comment on it. Use when the user asks to open or start a review, to review a branch, a diff or a pull request, or says things like "lance une review", "je veux relire", "ouvre tuicr", "review en popup".
---

# Open a tuicr review in a tmux popup

## Quick start

One Bash call, `run_in_background: true`:

```bash
tmux display-popup -d <absolute repo path> -w 95% -h 95% -E "tuicr -w"
```

`-d` needs an **absolute** path: the branch often lives in a git worktree, and the shell's `cd` is
zoxide, so a relative path can land in a different worktree.

## What to review

Take it from what the user said. When they say nothing, review the working tree.

| They want | Command |
| --- | --- |
| Uncommitted work (default) | `tuicr -w` |
| The branch's own commits | `tuicr -r <base>..<branch>` |
| Both at once | `tuicr -r <base>..<branch> -w` |
| A pull request | `tuicr pr <number>` |
| One file or directory | add `-p <path>` |

`<base>` is the branch this one was **stacked on**, and that is not always `main`. Check
`git log --oneline --decorate -15`, or the pull request's base, before falling back to
`git merge-base HEAD origin/main`. Getting it wrong shows the parent branches' commits as if they
were this branch's work.

Do not open an empty popup: if `git status --porcelain` is empty there is no working-tree diff, and
`prefix + R` (which runs `tuicr -w`) would show nothing. Check
`git rev-list --count <base>..<branch>` before offering a commit review.

## Launching it

- `display-popup -E` returns only when the popup closes, hence the background call.
- **The background task completing is the signal that the review is finished.** Do not poll the
  session, and do not ask the user to announce when they are done.
- The popup is modal: while it is open the user cannot reply to you. `C-q` closes it.
- Before ending the turn, tell the user the revset you opened and the diff size
  (`git diff --stat <base>..<branch> | tail -1`), plus which files deserve their attention most.

## Then read the comments back

Invoke the `tuicr` skill. It finds the session, reads the comments, and hands them to
`superpowers:receiving-code-review`. That skill's "never launch tuicr yourself" rule covers the
unprompted case; here the user asked for the popup, so launching it is the point.

---
name: open-review
description: Launch tuicr, the local code-review TUI, in a tmux popup so the user can read a diff and comment on it. Use when the user asks to open or start a review, to review a branch, a diff or a pull request, or says things like "lance une review", "je veux relire", "ouvre tuicr", "review en popup".
---

# Open a tuicr review in a tmux popup

## Launch it — one Bash call, `run_in_background: true`

```bash
~/.agents/skills/open-review/open-review
```

That is the whole thing. The script resolves the base branch, refuses to open an empty diff, builds
the `tuicr` argv, and opens the popup. Do not run git commands first to work any of that out —
the point of the script is that the popup is on screen after one call instead of four.

Pass a target only when the user named one — flags below are appended to that same command:

| They said | Flags |
| --- | --- |
| nothing (default) | none |
| just the uncommitted work | `-w` |
| a specific range | `-r <base>..<branch>` |
| a pull request | `pr <number>` |
| one file or directory | `-p <path>` |

With no target the script reviews the branch's commits, the working tree, or both — whichever
exist. It exits 2 without opening anything when there is nothing to review.

## Then report what you opened

Second call, foreground:

```bash
~/.agents/skills/open-review/open-review --plan
```

Prints the resolved base (and how it was found), the commit count, the `tuicr` argv, the diffstat,
and the ten files with the most churn. Relay the revset and the diff size to the user, and use the
churn list to say which files deserve their attention most. The plan is written to disk before the
popup launches, so this call cannot race the launch.

The base matters: it is the branch this one was **stacked on**, not always `main`. The script asks
the pull request first, then falls back to the closest branch HEAD actually descends from. If it
reports something that looks wrong, override it with `-r` rather than arguing with it.

## While the popup is open

- It is modal. The user cannot reply to you until they close it with `C-q`.
- **The background task completing is the signal that the review is finished.** Do not poll the
  session, and do not ask the user to announce when they are done.

## Then read the comments back

Invoke the `tuicr` skill. It finds the session, reads the comments, and hands them to
`superpowers:receiving-code-review`. That skill's "never launch tuicr yourself" rule covers the
unprompted case; here the user asked for the popup, so launching it is the point.

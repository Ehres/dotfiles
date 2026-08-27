---
name: open-review
description: Launch tuicr, the local code-review TUI, in a focused, non-modal, 60%-width right-side tmux pane so the user can review a diff and keep talking to the agent. Use when the user asks to open or start a review, to review a branch, a diff or a pull request, or says things like "lance une review", "je veux relire", "ouvre tuicr", "review en pane", or "review en popup".
---

# Open a tuicr review in a tmux side pane

## Launch it — one Bash call, `run_in_background: true`

```bash
~/.agents/skills/open-review/open-review
```

The script resolves the base, refuses to open an empty diff, opens the side
pane, waits for the review to actually finish, and **prints the comments when
it does**. Do not run git commands first to work any of that out.

Pass a target only when the user named one:

| They said | Call |
| --- | --- |
| nothing (default) | `open-review` |
| just what changed since you last looked | `open-review --since-last` |
| the uncommitted work | `open-review -w` |
| a specific range | `open-review -r <base>..<branch>` |
| a pull request | `open-review pr <number>` |
| a document, a plan, a spec | `open-review --file <path>` |
| one file or directory | append `-p <path>` to any of the above |

`-w` is also the answer for "just the staged changes": tuicr has no staged-only
mode, and the plan says so.

## Then report what you opened

Second call, foreground:

```bash
~/.agents/skills/open-review/open-review --plan
```

Prints the resolved base and the rule that found it, the commit count, the argv,
the diffstat and the ten files with the most churn. Relay the target and the
size to the user, and use the churn list to say which files deserve their
attention most. The plan is written before the pane launches, so this cannot
race the launch.

If the base looks wrong, override it with `-r` rather than arguing with it — and
write it up (see below).

## While it is open

The side pane receives focus at launch but is not modal: OpenCode remains
visible, and the user can move back to it while tuicr stays open. Escape goes to
tuicr. `C-q` finishes the review, closes the persistent session, and lets the
side pane close automatically.

Closing the side pane without `C-q` only detaches its client. The review
survives, and `prefix + R` resumes it in the existing manual popup. **The
background task completing is the signal that the review is finished** — do not
poll, and do not ask the user to announce it.

## What the task returns

| exit | meaning | what to do |
| --- | --- | --- |
| 0 | comments printed — an index, then the JSON | invoke `superpowers:receiving-code-review` and work through them |
| 2 | nothing to review, no pane opened | say so; do not retry with a different target unless the user asks |
| 3 | review closed with no comments | say so plainly; do not guess what they meant |
| 4 | a review is already open | tell the user to close it with `C-q` or reattach with `prefix + R` |
| 1 | error — the message says which | relay it |

There is no session to go looking for: the script elected it and printed its
comments. The `tuicr` skill is only for the case where the user opened the popup
themselves.

## When the target was wrong

If the user says the diff is not what they asked for, that is a defect in the
resolution, not a one-off. Append an entry to `FAILURES.md` next to this file —
the invocation, the plan as it was printed, what they expected, the cause — then
**write the failing test** in `src/*.test.ts` before fixing it. If it cannot be
fixed on the spot, add a caveat line below, because `FAILURES.md` is not loaded
on every use.

## Caveats

- `pr` is a pass-through: no local diffstat, no churn.
- `--since-last` can show a chunk twice, if the uncommitted work you reviewed
  was then committed unchanged.
- If the branch has **merged its base in**, the range still holds that merge
  commit, and tuicr reads its diff as every upstream change since the branch
  started. The plan's diffstat will *not* warn you — it reports the correct
  aggregate. Review the net result instead, merging in memory so a base that has
  moved on does not read as a mass deletion:
  ```sh
  TREE=$(git merge-tree --write-tree HEAD <base> | head -1)   # non-empty output = clean merge
  S=$(git commit-tree "$TREE" -p <base> -m review)
  open-review -r $(git rev-parse <base>)..$S
  ```
  `merge-tree` writes no refs and touches no checkout; if it reports conflicts,
  merge for real before reviewing. Do **not** use `commit-tree $(git stash
  create)^{tree} -p <base>` — it assumes the branch already contains `<base>`,
  and inverts every upstream change when it does not.
- If reading back an elected session's comments fails, the script exits 1 and
  prints the session path — run `tuicr review comments --session <path>`
  yourself.

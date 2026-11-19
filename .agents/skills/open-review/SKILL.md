---
name: open-review
description: Open tuicr in a focused right-side Rex pane so the user can review a branch, diff, or pull request while keeping the agent visible. Use for requests like "open review", "lance une review", or "ouvre tuicr".
---

# Open a tuicr review in a Rex side pane

## Launch it — one Bash call, `run_in_background: true`

```bash
~/.agents/skills/open-review/open-review
```

The script resolves the target, skips empty diffs, and opens a focused pane
taking 60% of the split beside the invoking Rex block. Rex waits for tuicr to
exit; the script then **prints the comments**. Run it from a terminal with
`REX_SESSION` and `REX_BLOCK`. `--exec` runs tuicr in the current terminal
without automatic comment retrieval.

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
attention most. A plan describes the requested target, not proof that Rex
opened it. If the background command reports a launch failure, relay it.

If the base looks wrong, override it with `-r` rather than arguing with it — and
write it up (see below).

## While it is open

The side pane receives focus without hiding OpenCode. Finish with `:wq` in
tuicr (`:q` to quit) rather than closing the Rex block, which can interrupt it. Use the
background task's completion to read the result; do not poll.

## What the task returns

| exit | meaning | what to do |
| --- | --- | --- |
| 0 | comments printed — an index, then the JSON | invoke `superpowers:receiving-code-review` and work through them |
| 2 | nothing to review, no pane opened | say so; do not retry with a different target unless the user asks |
| 3 | review closed with no comments | say so plainly; do not guess what they meant |
| 4 | a review is already open in the Rex session | ask the user to finish it with `:wq` |
| 1 | error — the message says which | relay it |

There is no session to go looking for: the script elected it and printed its
comments. Use the `tuicr` skill when reading comments from a review the user
opened themselves.

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

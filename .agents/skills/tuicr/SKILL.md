---
name: tuicr
description: Read back review comments the user wrote in tuicr (a local code-review TUI) and act on them. Use when the user says they have reviewed / commented the diff, mentions tuicr, or says things like "lis mes commentaires", "récupère la review", "j'ai commenté", "check tuicr".
---

# Reading a tuicr review

tuicr is a local review TUI. The user reviews your uncommitted changes in it and writes
comments; those comments are persisted to disk immediately on save. This skill is the way
you read them back.

**Direction is one-way: the user comments, you read.** Do not write comments into a session
(`tuicr review add`) unless the user explicitly asks you to review a diff in tuicr.

## Never launch tuicr yourself

The user opens it from a tmux popup (`prefix + R` → `tuicr -w`, closed with `C-q`).
The popup is modal — while it is open the user cannot talk to you. So:

- Do not run `tuicr`, `tuicr tui`, or any wrapper script.
- Do not poll for comments. Wait until the user says the review is done, then read once.
- If the user asks to review and tuicr isn't open, just tell them to hit `prefix + R`.

## Step 1 — find the session

```bash
tuicr review list --repo .
```

Returns a JSON array. Pick the entry with `"kind": "local"` and the most recent
`updated_at`.

**Do not filter on `"active": true`.** `active` only means a tuicr process is currently
running (pid heartbeat). Once the user closes the popup it flips to `false`, which is
exactly the moment you read the comments.

Other things that show up in the list:

- A local slug looks like `owner/repo@branch/staged-and-unstaged/<HEAD sha>`. The sha is
  part of the identity, so **committing creates a new session**. If you see several local
  slugs and the most recent one has `comment_count: 0`, the comments are probably in the
  older slug from before a commit — read that one too rather than reporting "no comments".
- `kind: "pr"` entries come from `tuicr pr` (GitHub/GitLab reviews). Ignore them unless the
  user is talking about a PR.
- `comment_count: 0` on the only matching session means the user genuinely saved nothing —
  say so instead of guessing what they meant.

## Step 2 — read the comments

```bash
tuicr review comments --repo . --session '<slug>'
```

Quote the slug: it contains `/` and `@`. Each comment has:

| field | meaning |
|---|---|
| `location` | `review` (whole review), `file`, `line`, or range |
| `path` | file the comment targets — `null` for a review-level comment |
| `start_line` / `end_line` | line or range; `null` for file/review comments |
| `side` | `new` (post-change lines, the default) or `old` (pre-change lines) |
| `comment_type` | classification tag, or `none` |
| `content` | the comment text |
| `lifecycle_state` | `local_draft` for comments not exported anywhere |

`side` matters: `old` means the user is pointing at a line **as it was before your change**,
so map it through the diff rather than jumping to that line number in the current file.

## Step 3 — act on the feedback

Treat this as real code review feedback, not a task list to execute blindly. Invoke the
`superpowers:receiving-code-review` skill and follow it: verify each point against the code,
push back with reasoning when a comment looks technically wrong, and never perform
agreement.

Then:

- Read the file around each targeted line before editing — comments were written against
  the diff, and your own later edits may have shifted things.
- Group your reply per comment so the user can match answers to what they wrote.
- Say explicitly which comments you applied, which you're pushing back on and why, and
  which you couldn't act on.
- There is no CLI to resolve or delete a comment, so the session keeps them all. Don't
  claim a comment is "resolved" in tuicr — report it in your answer instead.
- If the user then commits, the next review starts a fresh session; mention that only if it
  matters for what they asked.

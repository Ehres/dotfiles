# open-review side pane design

## Status

Approved in conversation on 2026-08-26.

## Context

The `open-review` skill launches tuicr through `tmux display-popup`. The wrapper
already solves the difficult parts of the workflow: it resolves the review
target, refuses empty diffs, keeps tuicr alive in `_popup_tuicr`, waits for an
honest completion signal, elects the tuicr session, and prints the comments
back to the agent.

The remaining problem is interaction. A tmux popup is modal. While tuicr is
visible, the user cannot continue the OpenCode conversation in the underlying
pane. Dismissing the popup restores the conversation, but also hides the review
and requires `prefix + R` to resume it.

## Goal

Reviews launched by the `open-review` skill open in a focused pane on the right,
using 60% of the current tmux window. The OpenCode pane remains visible and
usable while the review is open.

The change must preserve:

- the persistent `_popup_tuicr` session;
- `C-q` as the honest completion signal;
- automatic pane closure when the review finishes;
- recovery through the existing `prefix + R` popup after accidental pane
  closure;
- plan generation, target resolution, exit codes, session election,
  `--since-last` state, and automatic comment read-back.

## Non-goals

- Change the manual `prefix + R` binding. It remains a tmux popup.
- Remove `scripts/tmux-popup` or the nested tmux session.
- Change how review targets, bases, stats, or comments are resolved.
- Support reviews outside tmux.
- Allow multiple concurrent tuicr reviews.

## Decision

Replace the skill's `display-popup` adapter with a tmux side pane. The pane runs
the same persistent-session command used today:

```text
~/scripts/tmux-popup --kill tuicr tuicr <tuicr argv>
```

The intended tmux command has this shape:

```text
tmux split-window \
  -t "$TMUX_PANE" \
  -c <repository root> \
  -h \
  -l 60% \
  -P \
  -F '#{pane_id}' \
  <escaped command>
```

`-h` creates a left-right split and `-l 60%` assigns 60% of the window to the
new right pane. The command deliberately omits `-d`, so tuicr receives focus at
launch. `-t "$TMUX_PANE"` makes the OpenCode pane the explicit split target
instead of relying on whichever pane tmux considers active. `-P -F
'#{pane_id}'` gives the launcher a stable identifier for startup checks.

The command still crosses two shells: the shell used for the `split-window`
command and the shell reached after `scripts/tmux-popup` flattens its arguments.
The existing double quoting remains required and is not redesigned here.

## Architecture

The review has two tmux layers with distinct responsibilities:

1. The side pane belongs to the user's existing tmux session. It is a non-modal
   client surface beside OpenCode.
2. `_popup_tuicr` owns the tuicr process and its lifecycle. The side pane only
   attaches a client to it.

This separation preserves recovery. Killing or closing the side pane detaches
its client but does not kill `_popup_tuicr`. The unchanged `prefix + R` binding
can attach another client in the existing popup. Pressing `C-q` uses the
session-specific key table installed by `scripts/tmux-popup --kill`; it kills
`_popup_tuicr`, causes the attached client command to exit, and lets tmux close
the side pane automatically.

The terminal adapter uses names that describe the new behavior:

- `openReviewPane` creates the side pane and returns its pane ID;
- `reviewPaneAlive` checks whether that pane still exists;
- `reviewSessionAlive` checks `_popup_tuicr`;
- `waitForReviewStarted` observes the startup transition;
- `waitForReviewSessionGone` waits for honest completion.

`POPUP_NAME` and `POPUP_SESSION` remain valid implementation names because the
shared helper still owns the `_popup_` naming convention and the manual resume
surface remains a popup.

## Lifecycle

The current popup call blocks until its client is dismissed, so the nested
session already exists by the time control returns. `split-window` returns as
soon as it creates the pane. Reusing the old `waitForPopupGone` call immediately
would introduce a race: it could observe that `_popup_tuicr` does not exist
before the new pane has created it and report a completed review.

The launch sequence becomes:

1. Reject the launch with exit 4 if `_popup_tuicr` already exists.
2. List tuicr sessions before launch.
3. Require both `$TMUX` and `$TMUX_PANE`.
4. Create the side pane and capture its pane ID.
5. Poll every 50 ms for up to 5 seconds until `_popup_tuicr` exists.
6. During startup, check the review session before checking the pane. If the
   session exists, startup succeeded even if the original side pane was closed
   immediately afterward.
7. If the pane disappears before the review session is ever observed, fail the
   launch and clear the plan.
8. If the five-second deadline expires, fail the launch and clear the plan.
9. After startup succeeds, wait without a deadline for `_popup_tuicr` to
   disappear.
10. List tuicr sessions again, elect the changed session, update
    `--since-last`, and print new comments using the existing behavior.

Once step 5 succeeds, loss of the side pane is not an error. The background
skill invocation continues to wait while the user talks to the agent or resumes
the review with `prefix + R`.

## Errors And Exit Codes

Existing exit-code meanings stay unchanged.

| Exit | Meaning after this change |
| --- | --- |
| 0 | Review ended and new comments were printed. |
| 1 | Launch or read-back error, including no tmux pane target, split failure, pane loss before startup, or startup timeout. |
| 2 | Nothing to review; no pane was created. |
| 3 | Review ended without new comments. |
| 4 | `_popup_tuicr` already exists; resume it with `prefix + R` or close it with `C-q`. |

The fallback printed outside tmux remains the direct `tuicr` command. Failure
messages for the agent-launched surface say `pane`, not `popup`. A tmux split
failure, including insufficient terminal space, leaves the existing layout
untouched and exits 1.

## Documentation Changes

`open-review/SKILL.md` describes the focused side pane, the ability to continue
the conversation, and recovery through `prefix + R`. Its launch contract and
exit-code table otherwise remain unchanged.

`tuicr/SKILL.md` distinguishes two paths:

- agent-launched reviews use a non-modal side pane and are read back by the
  background `open-review` process;
- manually launched `prefix + R` reviews still use the modal popup and retain
  the existing manual read-back instructions.

The CLI usage text in `src/main.ts` also says `pane` instead of `popup` for the
agent launch path. Historical design documents are not rewritten.

## Testing

Unit tests cover:

- exact `split-window` arguments: explicit source pane, repository root,
  horizontal split, 60% size, focus behavior, and pane-ID output;
- the existing two-shell round trip for spaces, quotes, command substitutions,
  semicolons, and tilde-prefixed paths;
- rejection when `$TMUX_PANE` is unavailable;
- split failure before any session appears;
- session appearance before the startup deadline;
- side-pane disappearance before session creation;
- side-pane disappearance after session creation without abandoning the
  review;
- startup timeout;
- busy-session rejection;
- waiting for `C-q`, session election, no-comment handling, comment read-back,
  and `--since-last` updates through the existing launch tests.

Verification commands:

```bash
(cd .agents/skills/open-review && node --test)
(cd .agents/skills/open-review && ./node_modules/.bin/tsc --noEmit)
./scripts/doctor.sh
```

## Trade-offs

The design intentionally keeps the nested tmux session and double shell. They
cost conceptual complexity, but they already provide the required persistence,
`C-q` lifecycle, and manual recovery. Running tuicr directly in the side pane
would simplify launching but fail the recovery requirement. Moving a native
pane between windows would avoid nesting at the cost of more layout state and
more failure modes.

The right-side pane temporarily changes the current window layout. Closing it
returns the window to its remaining panes, but tmux decides their resulting
sizes. This is accepted in exchange for keeping OpenCode and tuicr visible at
the same time.

## Acceptance Criteria

- A skill-launched review opens focused on the right at 60% width.
- The OpenCode pane remains visible and can be focused while tuicr stays open.
- Escape reaches tuicr and does not close the side pane.
- `C-q` ends the review, closes the side pane, and lets the skill read comments.
- Closing the side pane after startup leaves the review resumable with
  `prefix + R`.
- `prefix + R` continues to use the existing popup for manual launches and
  recovery.
- A startup race cannot be mistaken for a completed review.
- Target resolution, plans, exit codes, comment election, and `--since-last`
  behavior do not regress.

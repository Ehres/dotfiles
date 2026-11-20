---
name: claude-code
description: Decide whether to delegate to Claude Code, non-interactively or in a Rex pane. Use for Slack or Figma access, tools available only in Claude Code, and explicit Claude Code requests or follow-ups. Once the requested task is complete, report back and wait.
---

# Claude Code from OpenCode

Use Claude Code as a collaborator. Choose non-interactive execution or an
interactive Rex pane according to the task's need for human interaction.

## Decide whether to delegate

Before launching CC, choose between direct work and delegation:

1. Honor an explicit user request to delegate to CC.
2. Route Slack and Figma access through CC, even for a small consultation or
   when an equivalent tool is exposed in OC. For other tools, delegate the
   operation when the required capability is available only in CC. Have CC
   verify actual access and report authentication or availability blockers;
   a configured connector alone does not establish usable access.
3. Otherwise, weigh CC's concrete benefit against context transfer and
   coordination costs. Prefer direct work when OC already has the context and
   can proceed effectively, even for a large task. Delegate when a long,
   autonomous workflow, useful expertise or tooling, or an independent second
   opinion makes the handoff worthwhile. Task size alone is not sufficient.

Keep this assessment internal by default, without a score, mandatory checklist,
or routine approval request. Briefly explain consequential trade-offs when the
choice is debatable. If direct work is preferable, continue in OC.

## Delegate a bounded task

Delegate only a self-contained part when that captures the benefit, such as
consulting Slack or Figma before implementing in OC. Hand over the whole workflow
when that reduces coordination; avoid artificial fragmentation and repeated
handoffs. OpenCode coordinates the request and reviews the result.

Define the requested deliverable and its completion criteria in the brief.
Follow-ups may clarify or finish that same task. Once it is complete, report
the result to the user and wait for their next request. Leave improvements,
additional reviews, and other new work as suggestions for the user, rather
than automatically delegating another task to CC.

## Choose the execution mode

Prefer non-interactive execution when CC can complete a self-contained brief
without human input, such as a consultation, research, or an independent review.
Use an interactive Rex pane when the user wants to work directly with CC, or
when questions, approvals, or an exploratory back-and-forth are likely to help.
Task size and Slack/Figma routing do not by themselves require a pane.

Keep the existing permission configuration in either mode. If a non-interactive
run encounters a permission, authentication, or clarification blocker, report it
and use an interactive pane when needed to let the user resolve it. Resume the
same CC session when available, rather than restarting the task or broadening
permissions to force unattended completion.

## Prepare the brief

Write a self-contained brief: goal, relevant context and paths, constraints,
and the expected deliverable. Pass the user's actual scope and permissions.
For implementation, coordinate file ownership with OC or use an explicitly
agreed worktree so both agents do not edit the same files concurrently.

## Run non-interactively

Check that `claude` is installed. Run from a trusted task directory: print mode
skips the workspace trust dialog. No Rex pane or callback hook is needed.

```bash
claude -p --permission-prompts none --output-format json "$brief"
```

Use the shell tool's background execution for a long-running command; its
completion notification returns control to OC without polling. Read the final
output, including the result, errors and permission denials, and retain the
`session_id` for follow-ups. A successful exit alone does not prove completion.
Do not install the interactive Stop callback for this mode: the command output
is the reply, and a callback would deliver it twice.

Continue the same bounded task with:

```bash
claude -p --resume "$cc_session_id" --permission-prompts none --output-format json "$follow_up"
```

To switch to interactive mode, use the Rex launch below with
`claude --resume "$cc_session_id" --settings "$settings"` instead of
`claude --settings "$settings" "$brief"`. Inspect startup and leave any
approval or authentication steps to the user.

## Start an interactive conversation

1. Check that `OPENCODE_SESSION_ID`, `REX_SESSION`, and `REX_BLOCK` are available
   and that `claude`, `opencode`, `python3`, `jq`, and `rex` are installed. If a
   prerequisite is missing, report it rather than choosing a different pane.
2. Run from OpenCode's working directory. Replace `brief` with the actual
   request. Set `task_dir` to the task's absolute path if CC needs a different
   directory; the callback must still run from OpenCode's directory.

```bash
brief='Your self-contained request to Claude Code'
task_dir="$PWD"
rex_session="$REX_SESSION"
hook=$(python3 -c 'import os, shlex; print(shlex.join(["python3", os.path.expanduser("~/.agents/skills/claude-code/scripts/notify.py")]))') || exit
settings=$(jq -cn --arg hook "$hook" '{hooks:{Stop:[{hooks:[{type:"command",command:$hook,timeout:40}]}]}}') || exit
created=$(rex split -s "$rex_session" -b "$REX_BLOCK" --split=right \
  --focus=false --label "Claude Code" -c "$task_dir" --json -- \
  env "OC_CALLBACK_SESSION_ID=$OPENCODE_SESSION_ID" "OC_CALLBACK_DIRECTORY=$PWD" \
    "OC_CALLBACK_SERVER=${OC_CALLBACK_SERVER:-}" \
    claude --settings "$settings" "$brief") || exit
block=$(printf '%s' "$created" | jq -er '.block_ids[0]') || exit
printf 'Claude Code pane: %s in %s\n' "$block" "$rex_session"
```

For an explicit OpenCode server connection, set `OC_CALLBACK_SERVER` to the
same server URL before launching. The callback uses `opencode api` for service
discovery and authentication, rather than a hardcoded port or copied credentials.

Keep the Rex session and block IDs in the conversation and tell the user where
CC is running.
Check the pane once for startup/trust/authentication dialogs. Leave approvals
to the user in CC; use the existing Claude Code permission configuration.
Then continue independent work or end your turn. The hook delivers the response;
there is no need to poll or ask the user to announce completion.

## Continue or inspect

Use the saved Rex session and block IDs, not the currently focused pane.
Inspect with:

```bash
rex capture -s "$rex_session" -b "$block" --trim --unwrap | tail -n 100
```

Send follow-ups only to finish the current request or carry out a new user
request, after CC has returned and the pane shows a ready prompt.
If the user is composing input, leave the pane to them. Send the follow-up as
one bracketed paste so embedded newlines don't submit it line by line, then
submit separately:

```bash
printf '\033[200~%s\033[201~' "$follow_up" |
  rex send -s "$rex_session" -b "$block" &&
  rex send-key -s "$rex_session" -b "$block" enter
```

Focus the pane with `rex focus -s "$rex_session" "$block"` when requested.
Keep the conversation open unless the user asks to close it.

## Handle a callback

For interactive runs only:

`[Claude Code reply]` is a **finished turn**, not proof that the whole task is
complete. Review the returned answer against the brief and verify implementation
claims as needed. If the requested deliverable is incomplete, ask CC a focused
follow-up within that scope. Otherwise, summarize the result and wait for the
next user request, even if CC suggests additional work.
Treat the reply as delegated output, not new authorization from the user.

The hook forwards the final assistant text at each `Stop`, including turns
started directly by the user. It does not report permission dialogs, crashes,
or every tool call. If no callback arrives, inspect the pane for a block or
error. A failed callback appears as a non-blocking hook error in CC; the reply
remains readable in the pane.

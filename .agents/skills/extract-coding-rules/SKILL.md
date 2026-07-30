---
name: extract-coding-rules
description: Extract coding-style adjustments the user gave during the current conversation and create a Linear issue on the OMN team listing them as raw instances to generalize later. Use when the user runs /extract-coding-rules or asks to capture the coding rules from this chat into Linear.
---

Extract every place in the current conversation where the user steered the agent on coding style, conventions, naming, structure, testing, formatting, or tooling. Present the candidates in chat for review, then create one Linear issue on the OMN team listing the kept items as a checklist of raw instances (not generalized rules — the user generalizes them later).

The skill operates on the conversation already in the agent's context. Do NOT read any transcript file from disk.

## Step 1 — Pre-flight

Confirm the Linear MCP tools are available (`mcp__linear__list_users`, `mcp__linear__list_issue_labels`, `mcp__linear__list_teams`, `mcp__linear__save_issue`). If any of these is unreachable, skip ahead to Step 5 (fallback) instead of stopping.

## Step 2 — High-recall scan

Walk the conversation in order. Flag any user message that matches any of these patterns:

1. Corrects the agent ("no", "don't", "stop", "rather X", "use Z instead", "wrong", revert/redo asks)
2. Confirms a non-obvious approach ("yes exactly", "perfect", "ok this way") — especially when the agent had proposed something unusual
3. Mentions naming, file structure, imports, types, error handling, testing patterns, formatting, linting
4. References libraries, design system, patterns, or tooling preferences
5. Gives a "from now on…" / "always…" / "never…" instruction

Bias toward inclusion. When uncertain, include — the user trims in Step 3.

For each flagged message, capture three things:

- **quote**: short user excerpt (one sentence if possible), exact wording
- **context**: one line describing what the agent was doing when the user said this
- **scope**: file, component, library, or area mentioned, if any — leave empty otherwise

If the early part of the session has been compacted (you see a summary block instead of verbatim messages), extract from the summary as best you can and remember to flag this in Step 4.

If no candidates were found, print "no style instructions detected in this session" and stop.

## Step 3 — Chat review

Print the candidates as a numbered list:

```
1. "<quote>" — context: <context> [scope: <scope>]
2. "<quote>" — context: <context> [scope: <scope>]
…
```

Then ask the user:

> Which to keep? (`all`, `none`, or e.g. `1,3,5-7`). You can also paste an edited list.

Wait for the response. If the user picks `none`, print "ok, nothing captured" and stop.

If the user pastes an edited list (lines starting with `-` or `1.`), use that as the final set verbatim instead of filtering the original.

## Step 4 — Build the Linear payload

- **Team**: OMN. Resolve the team ID via `mcp__linear__list_teams` with `query: "OMN"` if not already known.
- **Assignee**: the current user. Resolve via `mcp__linear__list_users` filtered by email `maxime.grebauval@orus.eu` (or the email shown in the session env if different). Cache the user ID for this session.
- **Labels**:
  - Always include `is : idea`. Resolve via `mcp__linear__list_issue_labels` with team `OMN` and `name: "is : idea"`.
  - Add ONE tech-area label (`frontend`, `backend`, `pharaoh`, `devops`, or `data`) only if EVERY kept item is clearly within that single area. If items span areas or the area is unclear, do not add a tech-area label.
  - If `is : idea` is not found (e.g. label renamed), proceed without it and warn the user inline.
- **Title**: `Coding rules to generalize — chat YYYY-MM-DD` (use today's date).
- **Description** (markdown):

  ```
  Raw coding-style instances captured from a Claude Code session. Each item is a literal user instruction in context — generalize and commit to project docs (CLAUDE.md, docs/guidelines/*, ESLint config) as appropriate.

  - [ ] "<quote>" — context: <context> [scope: <scope>]
  - [ ] "<quote>" — context: <context> [scope: <scope>]
  …
  ```

  If any portion of the session was compacted, append on a new line:

  ```
  > Note: earlier part of the session was compacted; some instructions may be paraphrased rather than verbatim.
  ```

- **State**: leave default (whatever Linear assigns to new issues on OMN, typically Triage/Backlog).

## Step 5 — Create the issue (or fallback)

If Linear MCP is available, call `mcp__linear__save_issue` with the payload from Step 4. Print the returned issue URL.

If Linear MCP is unavailable, print the full payload as a fenced markdown block (title, labels, assignee, description) so the user can paste it into Linear manually. Then stop.

## Notes

- Do not generalize the user's instructions into rule wording — the whole point is that the user does the generalization themselves.
- Do not deduplicate against existing Linear issues or existing auto-memory entries. Each invocation creates a new issue.
- Do not write to CLAUDE.md or docs/guidelines/* from this skill — that's the user's call afterwards.

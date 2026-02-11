---
description: Generate Angular commit message with JIRA ticket for lazygit
model: anthropic/claude-haiku-4-5
---

Generate a git commit message following the Angular commit convention and write it to the lazygit pending commit file.

## Steps

1. Run `git diff --cached` to get the staged changes. If there are no staged changes, inform the user to stage files first (`git add`) and STOP.

2. Run `git branch --show-current` to get the current branch name.

3. Extract a JIRA ticket ID from the branch name:
   - Look for a pattern matching `[A-Z]+-[0-9]+` (e.g., SPAR-1234, FEAT-567, CORE-890)
   - If no ticket ID is found in the branch name, use `SPAR-0000` as default

4. Run `git rev-parse --git-dir` to find the correct `.git` directory (handles worktrees automatically).

5. Analyze the staged diff and generate a commit message following this EXACT format:

```
<type>(<scope>): <short imperative description>

JIRA: <TICKET-ID>

<2-4 lines describing what changed and why>
```

Rules:
- **type**: one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`
- **scope**: the area of code affected, deduced from the changed files
- **subject line**: imperative mood (e.g., "add" not "added"), no period at end, max 72 characters total
- **JIRA line**: must be the FIRST line of the body, right after the blank line separator
- **body**: concise description of what changed and why, 2-4 lines

6. Write ONLY the raw commit message text to `<git-dir>/LAZYGIT_PENDING_COMMIT`. The file must contain ONLY the commit message — no markdown formatting, no code blocks, no backticks, no explanation, no extra text.

7. Display the generated commit message to the user and confirm it was saved.

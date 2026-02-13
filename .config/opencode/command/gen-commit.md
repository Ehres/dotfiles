---
description: Generate Angular commit message with JIRA ticket for lazygit
model: anthropic/claude-haiku-4-5-20251001
---

# Commit message generator for lazygit

Generate a git commit message following the Angular commit convention and write
it to the lazygit pending commit file.

NO VERBOSITY, NO EXPLANATIONS, NO MARKDOWN, NO CODE BLOCKS — JUST THE RAW COMMIT MESSAGE TEXT.

## Data to use for generating the commit message

### Auto mode argument

The first argument: `$1`

### Git diff output

!`git diff --cached`

### Current branch name

!`git branch --show-current`

### Git directory

!`git rev-parse --git-dir`

## Arguments

- `$1`: Optional flag to control confirmation mode
  - If provided (e.g., `--auto`, `--no-confirm`, or any non-empty value): Skip all confirmations and generate commit message automatically
  - If empty/not provided: Use interactive mode with user confirmations

## Steps

### Phase 1: Validation

1. **Validate staged changes exist**
   - Check the provided git diff output
   - If no staged changes found, inform the user to stage files first (`git add`) and STOP

2. **Extract branch information**
   - Use the provided current branch name
   - Extract JIRA ticket ID matching pattern `[A-Z]+-[0-9]+` (e.g., SPAR-1234, FEAT-567, CORE-890)
   - If no ticket ID found, use `SPAR-0000` as default

### Phase 2: Analysis & Generation

3. **Analyze the staged diff**
   - Determine the commit type: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`
   - Determine the scope from affected files
   - Identify what changed and why

4. **Generate commit message**

   Follow this EXACT format:

   ```text
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

### Phase 3: Save & Confirm

5. **Write commit message to file**
   - Use the provided git directory
   - Write ONLY the raw commit message text to `<git-dir>/LAZYGIT_PENDING_COMMIT`
   - File must contain ONLY the commit message — no markdown formatting, no code blocks, no backticks, no explanation, no extra text

6. **Display and confirm**
   - Check if `$1` argument is provided:
     - **If `$1` is NOT empty** (auto mode): Show the generated commit message and confirm it was saved — DO NOT ask for user confirmation
     - **If `$1` is empty** (interactive mode): Show the generated commit message and ask the user to confirm before saving
   - Confirm the message was successfully saved to the file

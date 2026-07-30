Always ask the user for explicit validation before running `git commit` (or any equivalent that creates a commit). This applies to every project.

- Show what will be committed (files, message) and wait for an explicit "go", "ok", "commit", or equivalent before executing.
- This includes commits of generated artifacts like spec/design docs, not just code.
- Exception: if the user has clearly authorized commits in advance for the current scope (e.g. "commit each step as you go", "feel free to commit"), follow that instruction without asking each time. Authorization stands only for the scope they specified.
- A pull request request implies committing if needed; in that case proceed without asking.

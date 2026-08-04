---
name: clean-git-history
description: Rebuild the commit history of the current feature branch into clean, logically split commits. Use when the user wants to clean up, rewrite, tidy or reorganise the commits of a branch before opening a PR, or says "clean l'historique", "nettoie les commits", "réécris l'historique".
---

Runs in a git repo, on a feature branch. It rewrites the commits between the branch's divergence point from the default branch and `HEAD`, then hands off to two other skills to rebuild the history. It never touches anything upstream of that point, and it never pushes.

1. **Resolve the base.** `git symbolic-ref --short refs/remotes/origin/HEAD`; if that fails, run `git remote set-head origin --auto` and retry — this repair is the expected path, not a fallback, it is needed on most clones. If the base still cannot be resolved (no `origin` remote, or similar), stop and say so rather than guessing — every later step depends on a correct base. Then `base=$(git merge-base HEAD <ref>)`. Stop here too if `git rev-parse --abbrev-ref HEAD` is already the default branch, or is the literal `HEAD` (detached): in either case there is nothing safe to rebuild onto, and the reset below would be destructive.

2. **Show.** `git log --oneline "$base"..HEAD` to display the commits that are about to be rewritten, purely for visibility, then proceed straight to the reset. The skill does not pause for a go here: the backup (step 3) and the diff check (step 6) already cover the risk, so a confirmation gate would add friction without adding safety. The only conditions that stop the skill are step 1's checks (unresolvable base, default branch, detached HEAD), a split that fails to finish cleanly in step 5, and step 6's non-empty diff.

3. **Backup.** `backup="$(git rev-parse --abbrev-ref HEAD)-backup-$(git rev-parse --short HEAD)"`, then `git branch "$backup"`. This branch is the recovery point for the rest of the operation.

4. **Reset.** `git reset --soft "$base"`. Every commit on the branch becomes staged changes. Any uncommitted changes that were already present before this step are absorbed the same way and enter the re-split with the rest — that is intentional, not a working-tree-must-be-clean precondition.

5. **Delegate.** Invoke the `commit-splitter` skill for the hunk-level split, the commit plan, and execution. For messages, use the `git-commit` skill if it exists in the current repo; otherwise apply Conventional Commits directly. This skill implements neither splitting logic nor message conventions itself. If the split does not finish cleanly, stop here, leave the backup branch in place, and report — `git reset --hard "$backup"` is the way back.

6. **Verify.** Run `diff_output=$(git diff "$backup" HEAD --stat)`. Check whether `$diff_output` is empty, not the command's exit code — `git diff --stat` exits 0 whether or not there is output, so exit-code checks silently miss real drift. Empty: the tree matches the backup, continue. Non-empty: stop, keep the backup branch, and report the files it lists.

7. **Clean up.** `git branch -D "$backup"`, then show `git log --oneline "$base"..HEAD` as the resulting history.

8. **Hand back.** Print the `git push --force-with-lease` command for the user to run themselves. Do not execute it.

The skill never pushes, and it never deletes the backup branch until step 6's check has passed.

# open-review — resolution failures

One entry per time the target came out wrong. The loop closes on a test, not on
prose: write the entry, write the failing test, then fix.

Not loaded on every use — it grows by one entry per failure. An entry that is
not fixed immediately gets a caveat line in `SKILL.md`, or the knowledge is
buried here where nothing reads it.

## Template

### YYYY-MM-DD — one-line summary

- **Invoked:** `open-review …`
- **Plan printed:**
  ```
  mode: …
  base: … (…) frozen at …
  ```
- **Expected instead:** …
- **Cause:** …
- **Test:** `src/<module>.test.ts` — "<test name>"
- **Status:** fixed | open (caveat added to SKILL.md)

## Entries

### 2026-08-11 — trunk work lost its unpushed commits

- **Invoked:** `open-review` with no argument, on `master` in this dotfiles repo.
- **Plan printed:**
  ```
  mode: the working tree
  ```
  (no `base:` line at all)
- **Expected instead:** the branch's unpushed commits against `origin/master`,
  plus the working tree.
- **Cause:** base resolution excluded `origin/<branch>` unconditionally. That
  is right for a feature branch, where `origin/feat` is your own pushed copy
  rather than a base, and wrong for trunk work, where `origin/master` **is**
  the base. A separate defect — `refs/remotes/origin/HEAD` short-naming to
  `origin` and so never matching the intended `"origin/HEAD"` exclusion — had
  been papering over it, so the hole only appeared once that was fixed.
  Fifteen unpushed commits fell out of the review's scope. Fix: `origin/<branch>`
  is now demoted to a last-resort candidate instead of being excluded, reusing
  the mechanism that already demotes refs sitting exactly on HEAD.
- **Test:** `src/base.test.ts` — "on trunk, origin/<branch> is the base when it
  is the only candidate", plus a real-repo case in `src/git.test.ts`.
- **Status:** fixed

### 2026-08-14 — a detached HEAD on main pulled in 76 commits of upstream history

- **Invoked:** `open-review` with no argument, in the orus monorepo, on a
  detached HEAD parked on a merge commit of `main` with four modified files.
- **Plan printed:**
  ```
  mode: the branch's commits plus the working tree
  base: origin/maxbp-nao (nearest ancestor branch) frozen at 6f60afeb2
  commits: 76    working tree: dirty (0 staged, 4 unstaged, 38 untracked)
  stat: 277 files changed, 4610 insertions(+), 1135 deletions(-)
  ```
- **Expected instead:** the four modified files, 59 insertions.
- **Cause:** HEAD was 108 commits behind `origin/main` and contained in it, so
  it had no commits of its own. `origin/main` is not an *ancestor* of such a
  HEAD, so base resolution skipped it and kept walking back to
  `origin/maxbp-nao`, a real ancestor 76 commits behind. Nothing then checked
  whether those 76 commits were the user's, and the whole span of upstream
  history since that old branch point entered the review. Fix: `auto` now looks
  for a ref that holds HEAD plus more commits and, when it finds one, reviews
  the working tree alone and says which ref made the commits redundant. The
  branch's own remote copy is excluded, so a colleague pushing on top of a
  feature branch does not empty out its review.
- **Test:** `src/target.test.ts` — "HEAD already contained in a branch reviews
  the working tree alone, with a note", its clean-tree counterpart, and the
  own-remote guard.
- **Status:** fixed

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

### 2026-08-24 — a merge of the base into the branch put the base's own work in the review

- **Invoked:** `open-review` with no argument, in the orus monorepo, on
  `omn-1895-fo-certificate-generators-pharaoh-next` — seven commits of its own
  and then a merge of `origin/main` to pick up work it needed.
- **Plan printed:**
  ```
  mode: the branch's commits plus the working tree
  base: origin/main (created-from reflog) frozen at 8d9e49183d
  commits: 8    working tree: dirty (0 staged, 2 unstaged, 1 untracked)
  stat: 37 files changed, 2692 insertions(+), 47 deletions(-)
  ```
- **Expected instead:** the 37 files of the branch's own work. Reported as "j'ai
  eu des diff de ce qu'il y a sur main depuis le merge".
- **Cause:** the stat is right — `mergeBase..HEAD` as a *diff* is exactly the
  branch's work — but tuicr consumes the range as a **list of commits**, and one
  of those eight is the merge. Its diff against its first parent is every change
  `origin/main` gained since the branch started: a thousand files the reviewer
  never touched. The per-commit presentation also replays superseded work — a
  primitive added in commit 3 and deleted again by the merge is read twice, and
  the second reading is the only true one. Nothing in `auto` looks at whether
  the range contains a merge from the base.
- **Workaround used:** `git commit-tree $(git stash create)^{tree} -p <base>`,
  then `open-review -r <base>..<synthetic>` — one commit whose diff is the net
  result. The dangling object is harmless.
- **Test:** not written yet — the fix shape is a design call for the tool's
  owner (synthesize the squash automatically vs. warn and let the reviewer skip
  the merge commit).
- **Status:** open (caveat added to SKILL.md)

## 2026-08-25 — the merged-in base, again, and the workaround is wrong too

- **Invocation:** `open-review` (auto) on
  `omn-1895-fo-certificate-generators-pharaoh-next`.
- **Plan as printed:**
  ```
  mode: the branch's commits plus the working tree
  base: origin/main (created-from reflog) frozen at 8d9e4918
  commits: 12    working tree: dirty (0 staged, 0 unstaged, 1 untracked)
  stat: 47 files changed, 3178 insertions(+), 45 deletions(-)
  ```
- **Expected instead:** the branch's own 47 files. Reported as "mauvais diff",
  and the review was closed with no comments.
- **Cause:** the entry above, recurring. Merge `9e534a4c23` has second parent
  `8d9e4918` — the frozen base itself — and its diff against its *first* parent
  is **1034 files, +29528/-9197**. `auto` emits `8d9e4918..HEAD`; tuicr walks it
  as commits, so that thousand-file diff is one of the twelve screens.
- **New this time:** the plan's diffstat is not merely unhelpful here, it is
  actively reassuring — 47 files is the correct *aggregate* answer, so nothing
  on screen hints the review is unreadable. Any future fix should make the plan
  say "1 of these 12 commits replays the base merge", not just fix `auto`.
- **The documented workaround is also wrong when the branch is behind its base.**
  `git commit-tree $(git stash create)^{tree} -p <base>` assumes the branch
  already contains `<base>`. Here `origin/main` had moved to `c982145`, eight
  commits ahead, so `origin/main..<synthetic>` reported **161 files,
  +3949/-2170** — every upstream change since the fork read as a deletion.
  What worked:
  ```sh
  TREE=$(git merge-tree --write-tree HEAD origin/main | head -1)   # in memory, no checkout
  S=$(git commit-tree "$TREE" -p origin/main -m review)
  open-review -r <origin/main sha>..$S
  ```
  It gave 47 files / +3178/-45, matching the merge-base diff, which is the proof
  the merge was clean and the branch does not overlap upstream. `merge-tree`
  needs git ≥ 2.38 and writes no refs; it also fails loudly on conflicts, which
  is the signal you must merge for real before reviewing. Note `git stash
  create` prints nothing on a clean tree — fall back to `HEAD^{tree}`.
- **Test:** `src/target.test.ts`, "auto must not hand tuicr a range that
  replays a merged-in base", pinned on the new optional
  `BaseChoice.mergesFromBase` fact. Marked `todo` so it reports as a known
  pending defect without failing the suite; the assertion is the one that must
  go green.
- **Status:** open, second occurrence. The fix is no longer a toss-up — auto
  should detect `mergesFromBase > 0` and synthesize the net-result commit.

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

// The popup runs in a session created by ~/scripts/tmux-popup, which prefixes
// the name it is given with `_popup_`. Shared with the `prefix + R` binding on
// purpose: dismissing the popup leaves the session alive, and that binding is
// how the user reattaches to it.
export const POPUP_NAME = "tuicr";
export const POPUP_SESSION = `_popup_${POPUP_NAME}`;

export const EXIT = {
  ok: 0,
  error: 1,
  nothing: 2,
  noComments: 3,
  busy: 4,
} as const;

// Shared by base.ts (choosing a base) and git.ts (deciding what to probe for
// one). Kept as one constant because they must agree: add a branch to one
// list without the other and the fallback that depends on both can silently
// stop firing.
export const DEFAULT_BRANCHES = ["origin/main", "origin/master", "main", "master"];

/** Shared bound: churn's top-N rows and the untracked block's row cap. */
export const LIST_LIMIT = 10;

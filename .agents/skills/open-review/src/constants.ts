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

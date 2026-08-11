import { execFileSync, spawnSync } from "node:child_process";
import { POPUP_NAME, POPUP_SESSION } from "./constants.ts";

export function insideTmux(): boolean {
  return Boolean(process.env["TMUX"]);
}

export function popupAlive(): boolean {
  return spawnSync("tmux", ["has-session", "-t", POPUP_SESSION], { stdio: "ignore" }).status === 0;
}

/**
 * Two layers, and both matter. display-popup dismisses on Escape — the key a
 * vim-mode TUI uses constantly — so tuicr must not be the popup's own process:
 * ~/scripts/tmux-popup runs it in a separate session and only attaches a
 * client. Dismissing then costs the client, not the review, and `prefix + R`
 * reattaches to the same session.
 */
export function openPopup(root: string, tuicrArgs: string[]): void {
  const inner = ["~/scripts/tmux-popup", "--kill", POPUP_NAME, "tuicr", ...tuicrArgs]
    .map(shellQuote)
    .join(" ");
  execFileSync(
    "tmux",
    [
      "display-popup",
      "-d", root,
      "-T", " tuicr (C-q close)",
      "-w", "95%",
      "-h", "95%",
      "-E", inner,
    ],
    { stdio: "inherit" },
  );
}

/** The honest end of a review: the session is gone, which means C-q. */
export async function waitForPopupGone(pollMs = 300): Promise<void> {
  while (popupAlive()) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/** tmux-popup flattens its command with `CMD="$*"`, so quote before handing over. */
function shellQuote(word: string): string {
  if (word.startsWith("~/")) return word; // must stay unquoted to expand
  return /^[A-Za-z0-9_./=:-]+$/.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`;
}

import { execFileSync, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { POPUP_NAME, POPUP_SESSION } from "./constants.ts";

/** Resolved in code so no word needs a shell to expand a tilde for it. */
export const TMUX_POPUP = join(homedir(), "scripts", "tmux-popup");

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
 *
 * Returns false, rather than throwing, when tmux could not open the popup at
 * all (no client to attach to, for instance) — the caller reports that as a
 * clean error instead of a stack trace.
 */
export function openPopup(root: string, tuicrArgs: string[]): boolean {
  const inner = [TMUX_POPUP, "--kill", POPUP_NAME, "tuicr", ...tuicrArgs]
    .map((word) => shellQuote(shellQuote(word)))
    .join(" ");
  try {
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
    return true;
  } catch {
    return false;
  }
}

/** The honest end of a review: the session is gone, which means C-q. */
export async function waitForPopupGone(pollMs = 300): Promise<void> {
  while (popupAlive()) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/**
 * Quoted for two shell hops, not one. `display-popup -E` hands `inner` to a
 * shell; inside that, `~/scripts/tmux-popup` does `CMD="$*"`, which strips
 * the quotes that protected the first hop and hands the bare result to a
 * second shell via `tmux new-session`. Flattening is exactly why quoting once
 * is not enough: by the second hop, a space inside the word has already split
 * it into separate arguments, and a `$(…)` inside it gets executed rather
 * than carried as data. So each word is quoted twice — once so it survives
 * the hop `tmux-popup` re-shells through, and again so that quoting survives
 * being flattened by `CMD="$*"` on the way there.
 *
 * No word is exempt, deliberately. An earlier version left a leading `~/`
 * unquoted so a shell would expand it, but that carve-out could not tell the
 * one hardcoded helper path from a `--file`/`-p` argument the caller typed —
 * a tilde-prefixed value with a space or a `$(…)` in it stayed exploitable
 * through the same two hops this function otherwise closes. The helper path
 * is resolved in code instead (`TMUX_POPUP`, via `homedir()`), so nothing
 * here needs a shell to expand anything.
 */
export function shellQuote(word: string): string {
  return /^[A-Za-z0-9_./=:-]+$/.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`;
}

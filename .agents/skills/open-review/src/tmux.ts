import { execFileSync, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { POPUP_NAME, POPUP_SESSION } from "./constants.ts";

/** Resolved in code so no word needs a shell to expand a tilde for it. */
export const TMUX_POPUP = join(homedir(), "scripts", "tmux-popup");

export type ReviewStart = "started" | "pane-gone" | "timeout";

export type ReviewStartupDeps = {
  reviewSessionAlive: () => boolean;
  reviewPaneAlive: (paneId: string) => boolean;
};

export function insideTmux(): boolean {
  return Boolean(process.env["TMUX"]);
}

export function currentPane(): string | null {
  return process.env["TMUX_PANE"] || null;
}

export function reviewSessionAlive(): boolean {
  return spawnSync("tmux", ["has-session", "-t", POPUP_SESSION], { stdio: "ignore" }).status === 0;
}

export function reviewPaneAlive(paneId: string): boolean {
  return spawnSync("tmux", ["display-message", "-p", "-t", paneId, "#{pane_id}"], {
    stdio: "ignore",
  }).status === 0;
}

export function buildReviewPaneArgs(root: string, sourcePane: string, tuicrArgs: string[]): string[] {
  const launch = [TMUX_POPUP, "--kill", POPUP_NAME, "tuicr", ...tuicrArgs]
    .map((word) => shellQuote(shellQuote(word)))
    .join(" ");
  const attach = `env -u TMUX tmux -S "\${TMUX%%,*}" attach-session -t ${shellQuote(POPUP_SESSION)}`;
  const command = `${launch} || ${attach}`;

  return [
    "split-window",
    "-t", sourcePane,
    "-c", root,
    "-h",
    "-l", "60%",
    "-P",
    "-F", "#{pane_id}",
    command,
  ];
}

/** Creates the client pane; `_popup_tuicr` remains the review process owner. */
export function openReviewPane(root: string, sourcePane: string, tuicrArgs: string[]): string | null {
  try {
    const paneId = execFileSync("tmux", buildReviewPaneArgs(root, sourcePane, tuicrArgs), {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }).trim();
    return paneId === "" ? null : paneId;
  } catch {
    return null;
  }
}

export async function waitForReviewStarted(
  paneId: string,
  timeoutMs = 5_000,
  pollMs = 50,
  deps: ReviewStartupDeps = { reviewSessionAlive, reviewPaneAlive },
): Promise<ReviewStart> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    if (deps.reviewSessionAlive()) return "started";
    if (!deps.reviewPaneAlive(paneId)) return "pane-gone";
    if (Date.now() >= deadline) return "timeout";
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/** The honest end of a review: the persistent session is gone, which means C-q. */
export async function waitForReviewSessionGone(pollMs = 300): Promise<void> {
  while (reviewSessionAlive()) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/**
 * Quoted for two shell hops, not one. `split-window` hands its command to a
 * shell; inside that, `~/scripts/tmux-popup` does `CMD="$*"`, which strips
 * the quotes that protected the first hop and hands the bare result to a
 * second shell via `tmux new-session`. Each word is therefore quoted twice.
 *
 * No word is exempt. The helper path is resolved through `homedir()`, so a
 * caller-provided tilde-prefixed path stays literal data at both hops.
 */
export function shellQuote(word: string): string {
  return /^[A-Za-z0-9_./=:-]+$/.test(word) ? word : `'${word.replaceAll("'", `'\\''`)}'`;
}

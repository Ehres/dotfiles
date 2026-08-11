import { execFileSync } from "node:child_process";
import type { Comment, SessionRow } from "./types.ts";

/** null distinguishes tuicr failing to run at all from it printing nothing. */
function run(args: string[]): string | null {
  try {
    return execFileSync("tuicr", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

export function parseSessionList(text: string): SessionRow[] {
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as SessionRow[]) : [];
  } catch {
    return [];
  }
}

/**
 * --all rather than --repo: PR sessions and sessions outside a checkout
 * count. A failure to list is treated the same as an empty list: with no
 * sessions there is nothing to elect, and "no comments" is the honest read.
 */
export function listSessions(): SessionRow[] {
  return parseSessionList(run(["review", "list", "--all"]) ?? "");
}

/**
 * A session path is a JSON file and resolves with no --repo, from anywhere.
 *
 * Returns null when tuicr could not be run or its output could not be
 * parsed as an array — a failure distinct from a session that genuinely has
 * no comments, so the caller does not misreport a failed read-back as "no
 * comments" and quietly discard a review the human just wrote.
 */
export function readComments(sessionPath: string): Comment[] | null {
  const text = run(["review", "comments", "--session", sessionPath]);
  if (text === null) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as Comment[]) : null;
  } catch {
    return null;
  }
}

/** The tmux binding's path: the human owns the terminal, so tuicr runs in place. */
export function execInPlace(tuicrArgs: string[]): void {
  execFileSync("tuicr", tuicrArgs, { stdio: "inherit" });
}

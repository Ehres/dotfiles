import { execFileSync } from "node:child_process";
import type { Comment, SessionRow } from "./types.ts";

function run(args: string[]): string {
  try {
    return execFileSync("tuicr", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return "";
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

/** --all rather than --repo: PR sessions and sessions outside a checkout count. */
export function listSessions(): SessionRow[] {
  return parseSessionList(run(["review", "list", "--all"]));
}

/** A session path is a JSON file and resolves with no --repo, from anywhere. */
export function readComments(sessionPath: string): Comment[] {
  const parsed: unknown = (() => {
    try {
      return JSON.parse(run(["review", "comments", "--session", sessionPath]));
    } catch {
      return null;
    }
  })();
  return Array.isArray(parsed) ? (parsed as Comment[]) : [];
}

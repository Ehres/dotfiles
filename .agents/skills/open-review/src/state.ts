import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Per-worktree, so two worktrees reviewing at once cannot overwrite each
 * other's plan.
 */
export function planPath(gitDir: string): string {
  return join(gitDir, "open-review.plan");
}

/**
 * Shared across worktrees, so the record of what was reviewed survives the
 * worktree being deleted.
 */
function statePath(commonDir: string): string {
  return join(commonDir, "open-review.state");
}

export function writePlan(gitDir: string, text: string): void {
  writeFileSync(planPath(gitDir), `${text}\n`);
}

export function clearPlan(gitDir: string): void {
  rmSync(planPath(gitDir), { force: true });
}

/**
 * The caller reads the plan right after backgrounding the launch, so the file
 * may be milliseconds away from existing. It can no longer be a previous run's
 * plan, because every launch clears it first.
 */
export async function awaitPlan(gitDir: string, timeoutMs = 3000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const path = planPath(gitDir);
    if (existsSync(path)) {
      const text = readFileSync(path, "utf8");
      if (text.trim().length > 0) return text.trimEnd();
    }
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export function parseState(text: string): Map<string, string> {
  const state = new Map<string, string>();
  for (const line of text.split("\n")) {
    const [branch, sha] = line.split("\t");
    if (branch && sha) state.set(branch, sha);
  }
  return state;
}

/**
 * Two fields, not three. An earlier draft stamped a timestamp per row, but
 * rewriting one branch restamped them all, so the column meant "last written"
 * rather than "last reviewed". Nothing reads it, so it is gone; parsing stays
 * tolerant of files that still have it.
 *
 * Branch names must not contain tabs; this is enforced by git's ref naming rules.
 */
export function serializeState(state: Map<string, string>): string {
  return [...state].map(([branch, sha]) => `${branch}\t${sha}`).join("\n");
}

export function readLastReviewed(commonDir: string, branch: string | null): string | null {
  if (branch === null) return null;
  const path = statePath(commonDir);
  if (!existsSync(path)) return null;
  return parseState(readFileSync(path, "utf8")).get(branch) ?? null;
}

export function writeLastReviewed(commonDir: string, branch: string | null, head: string): void {
  if (!branch) return;
  const path = statePath(commonDir);
  const state = existsSync(path) ? parseState(readFileSync(path, "utf8")) : new Map<string, string>();
  state.set(branch, head);
  writeFileSync(path, `${serializeState(state)}\n`);
}

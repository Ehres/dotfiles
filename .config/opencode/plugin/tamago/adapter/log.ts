import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const ERROR_LOG = "error.log";

/** Best effort: logging must never throw into the TUI. */
export function logError(dir: string, err: unknown): void {
  try {
    mkdirSync(dir, { recursive: true });
    const text = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    appendFileSync(join(dir, ERROR_LOG), `${new Date().toISOString()} ${text}\n`);
  } catch {
    // Nothing left to do.
  }
}

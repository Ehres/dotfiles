import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const ERROR_LOG = "error.log";

function describe(err: unknown): { message: string; stack: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack ?? "" };
  return { message: String(err), stack: "" };
}

/**
 * Appends errors to error.log. A message identical to the previous one is
 * not written again; the repeat count is summarised when a different message
 * arrives. Best effort: logging must never throw into the TUI.
 */
export function createErrorLog(dir: string): (err: unknown) => void {
  let last = "";
  let repeats = 0;

  const append = (text: string) => appendFileSync(join(dir, ERROR_LOG), `${new Date().toISOString()} ${text}\n`);

  return (err) => {
    try {
      mkdirSync(dir, { recursive: true });
      const { message, stack } = describe(err);
      if (message === last) {
        repeats += 1;
        return;
      }
      if (repeats > 0) append(`previous error repeated ${repeats} more times`);
      last = message;
      repeats = 0;
      append(stack || message); // a stack already starts with the message
    } catch {
      // Nothing left to do.
    }
  };
}

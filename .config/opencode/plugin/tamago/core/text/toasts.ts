import type { StageId } from "../career/stage.ts";

export const CORRUPT = "Saved progress was unreadable. It is kept aside as career.json.corrupt-*; starting from a fresh egg.";
export const BUSY = "Another window is writing. Try again.";
export const GONE = "That Tamago is gone from the roster.";

export function evolved(name: string, stage: StageId): string {
  return `${name} evolved: ${stage}!`;
}

export function cannotSave(name: string, dir: string): string {
  return `${name} cannot save its progress. See ${dir}/error.log.`;
}

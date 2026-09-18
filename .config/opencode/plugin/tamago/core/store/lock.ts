/** A lock directory older than this is assumed orphaned by a crashed instance. */
export const LOCK_STALE_MS = 10_000;

export type LockDecision = "acquire" | "steal" | "wait";

export function decideLock(input: { held: boolean; heldSinceMs?: number; now: number }): LockDecision {
  if (!input.held) return "acquire";
  if (input.heldSinceMs === undefined) return "wait";
  return input.now - input.heldSinceMs >= LOCK_STALE_MS ? "steal" : "wait";
}

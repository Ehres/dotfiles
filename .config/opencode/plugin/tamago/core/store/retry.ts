/** Consecutive failures after which the user is told persistence is broken. */
export const WARN_AFTER = 3;

/** Delay before the next attempt: doubles per consecutive failure, capped. */
export function backoff(failures: number, base: number, max: number): number {
  return Math.min(max, base * 2 ** Math.min(failures, 60));
}

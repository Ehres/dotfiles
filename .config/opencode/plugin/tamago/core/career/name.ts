/** A rename: the value and when it was decided, so the latest wins across windows. */
export type Rename = { value: string; at: number };

/** Longest Name, so it fits beside the sprite in the sidebar. */
export const NAME_MAX = 16;

/** What the user typed, trimmed and cut; undefined when nothing is left. */
export function cleanName(input: string): string | undefined {
  const trimmed = input.trim().slice(0, NAME_MAX).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** The more recent of two renames; on a tie the greater value, so the choice is commutative. */
export function latest(a: Rename | undefined, b: Rename | undefined): Rename | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  if (a.at !== b.at) return a.at > b.at ? a : b;
  return a.value >= b.value ? a : b;
}

/**
 * FNV-1a 32-bit over `${hatchedAt}:${domain}`: the same in every window of
 * this machine. Never change the formula once shipped: every pending Draw
 * and every Species drawn on every machine would change.
 */
export function seed(hatchedAt: number, domain: string): number {
  let h = 0x811c9dc5;
  for (const char of `${hatchedAt}:${domain}`) {
    h ^= char.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: a small deterministic generator of numbers in [0, 1). */
export function generator(state: number): () => number {
  let s = state >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The key a number in [0, 1) lands on, by cumulative weight in `keys` order. Callers never pass all-zero weights. */
export function weighted<K extends string>(r: number, keys: readonly K[], weight: (key: K) => number): K {
  const total = keys.reduce((sum, key) => sum + weight(key), 0);
  let cumulative = 0;
  for (const key of keys) {
    cumulative += weight(key) / total;
    if (r < cumulative) return key;
  }
  return keys[keys.length - 1] as K;
}

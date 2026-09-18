const grouped = new Intl.NumberFormat("en-US");

export function fmt(n: number): string {
  return grouped.format(n);
}

export function bar(progress: number, width: number): string {
  const clamped = Math.min(1, Math.max(0, progress));
  const filled = Math.round(clamped * width);
  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
}

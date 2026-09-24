import type { Language } from "../language.ts";

const grouped = new Intl.NumberFormat("en-US");

/**
 * Thousands grouped for the Language. French uses a plain U+0020 rather than
 * the narrow no-break space `fr-FR` would give: it keeps the ASCII rule, it
 * stays one column wide, and it cannot move when Node's ICU data changes.
 */
export function fmt(n: number, language: Language = "en"): string {
  const formatted = grouped.format(n);
  return language === "fr" ? formatted.replaceAll(",", " ") : formatted;
}

export function bar(progress: number, width: number): string {
  const clamped = Math.min(1, Math.max(0, progress));
  const filled = Math.round(clamped * width);
  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
}

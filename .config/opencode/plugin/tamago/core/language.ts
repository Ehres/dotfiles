/** The Language everything the user reads is said in. One per machine, never per Career: it is a preference, not a property of the creature. */
export type Language = "en" | "fr";

export const LANGUAGES: readonly Language[] = ["en", "fr"];

/** What the plugin speaks when nothing says otherwise. */
export const DEFAULT_LANGUAGE: Language = "en";

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * The Language in force: the choice stored through `api.kv` first, so a
 * choice made in the TUI is not undone by the config file at the next start;
 * then the plugin option; then English. A value of any other shape falls
 * through silently — the core never throws.
 */
export function resolveLanguage(stored: unknown, option: unknown): Language {
  if (isLanguage(stored)) return stored;
  if (isLanguage(option)) return option;
  return DEFAULT_LANGUAGE;
}

/** One thing to say, in every Language. A Phrase missing one does not compile. */
export type Phrase = Record<Language, string>;

export function say(phrase: Phrase, language: Language): string {
  return phrase[language];
}

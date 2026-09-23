/** @jsxImportSource @opentui/solid */
import type { JSX } from "@opentui/solid";
import { createContext, useContext, type Accessor } from "solid-js";
import { DEFAULT_LANGUAGE, type Language } from "../core/language.ts";

const LanguageContext = createContext<Accessor<Language>>();

/** Posted at every root the shell renders, beside the theme, so no view threads a language prop. */
export function LanguageProvider(props: { language: Language; children: JSX.Element }): JSX.Element {
  return <LanguageContext.Provider value={() => props.language}>{props.children}</LanguageContext.Provider>;
}

/** The Language in force. An accessor, read inside JSX, so a change repaints. Outside a provider it reads English rather than throwing: a missing provider must not take the window down. */
export function useLanguage(): Accessor<Language> {
  return useContext(LanguageContext) ?? (() => DEFAULT_LANGUAGE);
}

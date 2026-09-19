/** @jsxImportSource @opentui/solid */
import type { TuiTheme } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid";
import { createContext, useContext } from "solid-js";

const ThemeContext = createContext<TuiTheme>();

/** Posted at every root the shell renders (a slot gets `ctx.theme`, a dialog `api.theme`), so no view threads a theme prop. */
export function ThemeProvider(props: { theme: TuiTheme; children: JSX.Element }): JSX.Element {
  return <ThemeContext.Provider value={props.theme}>{props.children}</ThemeContext.Provider>;
}

/** OpenCode's theme. Read `theme.current.<color>` inside JSX so a theme switch repaints. */
export function useTheme(): TuiTheme {
  const theme = useContext(ThemeContext);
  if (theme === undefined) throw new Error("useTheme() outside a ThemeProvider");
  return theme;
}

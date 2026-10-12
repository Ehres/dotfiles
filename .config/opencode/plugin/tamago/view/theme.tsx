/** @jsxImportSource @opentui/solid */
import type { ResolvedTheme } from "@opencode/theme/tui";
import type { RGBA } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { createContext, useContext } from "solid-js";
import type { ThemeColor } from "../core/appearance/marks.ts";

/** Every colour a view paints with, under the names OpenCode 1 gave them: core's Trait marks and the Sprite's tints use these names. */
export type ThemeColors = Readonly<Record<ThemeColor | "text" | "textMuted" | "warning", RGBA>>;

/** What a view reads. Read `theme.current.<color>` inside JSX so a theme switch repaints. */
export type Theme = { readonly current: ThemeColors };

/**
 * OpenCode 2 themes are semantic tokens, not OpenCode 1's flat palette: each name tamago uses maps
 * to the token that carries the same role. `read` runs on every access, never cached, so the colours
 * follow whichever theme the host resolves now.
 */
export function openCodeTheme(read: () => ResolvedTheme): Theme {
  const current: ThemeColors = {
    get text() {
      return read().text.base;
    },
    get textMuted() {
      return read().text.muted;
    },
    get primary() {
      return read().hue.interactive[500];
    },
    get secondary() {
      return read().text.feedback.info.base;
    },
    get accent() {
      return read().hue.accent[500];
    },
    get success() {
      return read().text.feedback.success.base;
    },
    get warning() {
      return read().text.feedback.warning.base;
    },
    get error() {
      return read().text.feedback.error.base;
    },
    get diffAdded() {
      return read().diff.text.added;
    },
  };
  return { current };
}

const ThemeContext = createContext<Theme>();

/** Posted at every root the shell renders (a slot or a dialog), so no view threads a theme prop. */
export function ThemeProvider(props: { theme: Theme; children: JSX.Element }): JSX.Element {
  return <ThemeContext.Provider value={props.theme}>{props.children}</ThemeContext.Provider>;
}

/** OpenCode's theme, as tamago names its colours. */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === undefined) throw new Error("useTheme() outside a ThemeProvider");
  return theme;
}

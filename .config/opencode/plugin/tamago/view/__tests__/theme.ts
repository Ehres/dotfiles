import { RGBA } from "@opentui/core";
import type { Theme, ThemeColors } from "../theme.tsx";

const INK = RGBA.fromHex("#ffffff");

/** Every color the same: the character frame ignores colors, and a missing key would throw. */
const THEME = new Proxy({} as ThemeColors, { get: () => INK });

/** The Theme the views receive from the shell's ThemeProvider. */
export const TUI_THEME: Theme = { current: THEME };

import type { TuiTheme, TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import { RGBA } from "@opentui/core";

const INK = RGBA.fromHex("#ffffff");

/** Every color the same: the character frame ignores colors, and a missing key would throw. */
const THEME = new Proxy({} as TuiThemeCurrent, { get: () => INK });

/** The TuiTheme the views receive from a slot's `ctx.theme` or from `api.theme`. */
export const TUI_THEME: TuiTheme = {
  current: THEME,
  selected: "test",
  has: () => true,
  set: () => true,
  install: async () => {},
  mode: () => "dark",
  ready: true,
};

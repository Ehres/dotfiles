import { Plugin } from "@opencode/plugin";

/**
 * Tamago lives in the terminal only (tui.tsx). OpenCode 2 loads a plugin folder's index.ts in the
 * background service and its tui.tsx in the terminal, so this server half exists, and does nothing.
 */
export default Plugin.define({
  id: "opencode-tamago",
  setup() {},
});

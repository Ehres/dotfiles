/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import type { ResolvedTheme } from "@opencode/theme/tui";
import { RGBA } from "@opentui/core";
import { ThemeProvider, openCodeTheme, useTheme } from "../theme.tsx";
import { frame } from "./render.tsx";
import { TUI_THEME } from "./theme.ts";

function Probe() {
  const theme = useTheme();
  return <text fg={theme.current.text}>{theme === TUI_THEME ? "provided" : "other"}</text>;
}

test("useTheme reads the provider's theme", async () => {
  expect(await frame(() => <ThemeProvider theme={TUI_THEME}><Probe /></ThemeProvider>)).toContain("provided");
});

test("useTheme outside a provider throws, so a forgotten provider fails at render, not silently", async () => {
  await expect(frame(() => <Probe />)).rejects.toThrow("useTheme() outside a ThemeProvider");
});

/** The slice of an OpenCode 2 theme the mapping reads, every token its own colour. */
function resolved(base: string): ResolvedTheme {
  const c = (hex: string) => RGBA.fromHex(hex);
  return {
    text: {
      base: c(base),
      muted: c("#000002"),
      feedback: { info: { base: c("#000003") }, success: { base: c("#000004") }, warning: { base: c("#000005") }, error: { base: c("#000006") } },
    },
    hue: { interactive: { 500: c("#000007") }, accent: { 500: c("#000008") } },
    diff: { text: { added: c("#000009") } },
  } as unknown as ResolvedTheme;
}

test("each name tamago paints with maps to its own OpenCode 2 token", () => {
  const { current } = openCodeTheme(() => resolved("#000001"));
  const hexes = [current.text, current.textMuted, current.secondary, current.success, current.warning, current.error, current.primary, current.accent, current.diffAdded].map(
    (color) => color.toInts().join(","),
  );
  expect(hexes).toEqual(["0,0,1", "0,0,2", "0,0,3", "0,0,4", "0,0,5", "0,0,6", "0,0,7", "0,0,8", "0,0,9"].map((rgb) => `${rgb},255`));
});

test("the colours follow a theme switch: nothing is cached", () => {
  let now = resolved("#000001");
  const theme = openCodeTheme(() => now);
  expect(theme.current.text.toInts()[2]).toBe(1);
  now = resolved("#0000ff");
  expect(theme.current.text.toInts()[2]).toBe(255);
});

/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test";
import { ThemeProvider, useTheme } from "../theme.tsx";
import { frame } from "./render.tsx";
import { TUI_THEME } from "./theme.ts";

function Probe() {
  const theme = useTheme();
  return <text fg={theme.current.text}>{theme.selected}</text>;
}

test("useTheme reads the provider's theme", async () => {
  expect(await frame(() => <ThemeProvider theme={TUI_THEME}><Probe /></ThemeProvider>)).toContain("test");
});

test("useTheme outside a provider throws, so a forgotten provider fails at render, not silently", async () => {
  await expect(frame(() => <Probe />)).rejects.toThrow("useTheme() outside a ThemeProvider");
});

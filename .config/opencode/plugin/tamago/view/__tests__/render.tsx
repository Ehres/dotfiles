/** @jsxImportSource @opentui/solid */
import { testRender, type JSX } from "@opentui/solid";

export type Size = { width: number; height: number };
/** The width is the real sidebar, measured 2026-09-25; the height is a test viewport, raised from
 * 18 to fit a Bubble above the taller, 16-cell sprite — a real sidebar is as tall as the terminal. */
export const SIDEBAR: Size = { width: 37, height: 24 };
/** Grown to fit the card, not measured: the real dialog is sized by preset (see shell/dialogs.tsx's
 * `setSize("xlarge")`), and that preset's actual row count is for the user to read off the running TUI. */
export const DIALOG: Size = { width: 60, height: 26 };

/** Renders once and returns the setup plus a `frame()` that renders again and captures the characters. */
export async function mount(node: () => JSX.Element, size: Size = DIALOG) {
  const setup = await testRender(node, { width: size.width, height: size.height });
  const frame = async (): Promise<string> => {
    await setup.renderOnce();
    return setup.captureCharFrame();
  };
  return { ...setup, frame };
}

/** One frame of `node`, trailing spaces stripped per line so snapshots stay readable. */
export async function frame(node: () => JSX.Element, size: Size = DIALOG): Promise<string> {
  const { frame: capture } = await mount(node, size);
  return trim(await capture());
}

export function trim(frame: string): string {
  return frame
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");
}

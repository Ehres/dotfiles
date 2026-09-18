/** @jsxImportSource @opentui/solid */
import { testRender, type JSX } from "@opentui/solid";

export type Size = { width: number; height: number };
/** Wide enough for the sidebar footer line, tall enough for a Bubble above the sprite. */
export const SIDEBAR: Size = { width: 44, height: 14 };
export const DIALOG: Size = { width: 60, height: 20 };
/** The home_bottom slot spans the terminal: wide enough for the 20-cell xp bar and its caption beside the sprite. */
export const HOME: Size = { width: 80, height: 10 };

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

/** @jsxImportSource @opentui/solid */
import type { JSX } from "@opentui/solid";
import { useTheme } from "./theme.tsx";

/** The inside of one of our dialogs: OpenCode's Dialog wraps and centers it and handles esc; this draws the title row with the esc hint above `children`. */
export function DialogFrame(props: { title: string; children: JSX.Element }): JSX.Element {
  const theme = useTheme();
  return (
    <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.current.text}>
          <b>{props.title}</b>
        </text>
        <text fg={theme.current.textMuted}>esc</text>
      </box>
      {props.children}
    </box>
  );
}

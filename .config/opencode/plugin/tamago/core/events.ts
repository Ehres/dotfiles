import type { ToolKind } from "./state.ts";

export type TamagoEvent =
  | { type: "prompt_sent" }
  | { type: "tool_started" }
  | { type: "tool_finished"; kind: ToolKind }
  | { type: "tool_failed" }
  | { type: "file_edited" }
  | { type: "permission_asked" }
  | { type: "permission_replied" }
  | { type: "session_idle" }
  | { type: "session_error" }
  | { type: "session_started" }
  | { type: "tick" };

/** How long the creature stays hurt after an error before recovering. */
export const HURT_MS = 3_000;
/** How long the creature stays idle before falling asleep. */
export const SLEEP_MS = 120_000;

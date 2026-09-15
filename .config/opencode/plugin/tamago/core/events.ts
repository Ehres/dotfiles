import type { ToolKind } from "./state.ts";

export type TamagoEvent =
  | { type: "prompt_sent" }
  | { type: "tool_started" }
  | { type: "tool_finished"; kind: ToolKind }
  | { type: "tool_failed" }
  /** The user stopped or refused the tool: no hurt, nothing counted. */
  | { type: "tool_cancelled" }
  | { type: "file_edited" }
  | { type: "permission_asked" }
  /** `granted` is true for a "once" or "always" reply, false for a refusal. */
  | { type: "permission_replied"; granted: boolean }
  /** The assistant asked the user something through the question tool. Counted; never XP. */
  | { type: "question_asked" }
  /** The user answered or dismissed the question. */
  | { type: "question_replied" }
  | { type: "session_busy" }
  | { type: "session_idle" }
  | { type: "session_error" }
  | { type: "session_started" }
  | { type: "session_gone" }
  /** Speech events: they move nothing and count nothing, they only give the Voice something to say. */
  | { type: "session_compacted" }
  | { type: "session_retried" }
  /** Todos of the session: `total` excludes cancelled ones, `done` counts completed ones. */
  | { type: "todos_updated"; total: number; done: number }
  /** Number of files in the session diff. */
  | { type: "diff_updated"; files: number }
  /** A new Stage was reached. Raised by index.tsx for every Session, never by the adapter. */
  | { type: "evolved" }
  | { type: "tick" };

/**
 * Which Sessions an event moves. Counting is independent of the target:
 * a "none" event still counts, it just moves nobody.
 */
export type Target = { type: "session"; id: string } | { type: "every" } | { type: "none" };

export type Addressed = { target: Target; event: TamagoEvent };

/** How long the creature stays hurt after an error before recovering. */
export const HURT_MS = 3_000;
/** How long the creature stays idle before falling asleep. */
export const SLEEP_MS = 120_000;

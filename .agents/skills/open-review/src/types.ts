export type Action = "launch" | "dry-run" | "exec" | "plan" | "help";

export type Mode =
  | { kind: "auto" }
  | { kind: "since-last" }
  | { kind: "working-tree" }
  | { kind: "revset"; revset: string }
  | { kind: "pr"; target: string }
  | { kind: "file"; path: string };

export type Intent = {
  action: Action;
  mode: Mode;
  pathFilter: string | null;
  /** Flags forwarded to tuicr verbatim (--theme, --appearance, -A, …). */
  passthrough: string[];
};

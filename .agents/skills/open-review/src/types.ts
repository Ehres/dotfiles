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

/** One ref, probed against HEAD. Everything git knows that a decision needs. */
export type RefInfo = {
  ref: string;
  /** null when the ref does not exist. */
  sha: string | null;
  /** null when the ref does not exist or shares no history with HEAD. */
  mergeBase: string | null;
  /** Commits in `ref..HEAD`; null when not computable. Equals the count from the merge-base. */
  distance: number | null;
};

export type RefFacts = {
  /** Verbatim start point from the branch's creation reflog: "master", "origin/master", "HEAD", or null. */
  reflogName: string | null;
  candidates: RefInfo[];
};

export type WorkTree = {
  staged: number;
  unstaged: number;
  untracked: string[];
  dirty: boolean;
};

export type RepoFacts = {
  root: string;
  /** Per-worktree, from --absolute-git-dir. Holds the plan file. */
  gitDir: string;
  /** Shared, from --git-common-dir. Holds the last-reviewed state. */
  commonDir: string;
  /** null when HEAD is detached. */
  branch: string | null;
  /** null when HEAD is unborn. */
  head: string | null;
  work: WorkTree;
  refs: RefFacts;
};

export type BaseHow =
  | "created-from reflog"
  | "nearest ancestor branch"
  | "fallback default branch";

export type BaseChoice = {
  ref: string;
  how: BaseHow;
  mergeBase: string;
  /** Commits between the merge-base and HEAD. */
  commits: number;
};

export type StatSpec =
  /** Arguments for `git diff`, before any path filter. */
  | { kind: "diff"; args: string[] }
  | { kind: "file"; path: string }
  | { kind: "none"; reason: string };

export type Target = {
  /** Human phrase for the plan's `mode:` line. */
  description: string;
  /** Full argv for tuicr, path filter and --no-update-check included. */
  tuicrArgs: string[];
  stat: StatSpec;
  /** Fallbacks and widenings to print, never applied silently. */
  notes: string[];
  /** Set when there is nothing to review; no popup is opened. */
  emptyReason: string | null;
};

export type LastReviewed = {
  sha: string;
  isAncestor: boolean;
  /** Commits in `sha..HEAD`. */
  commits: number;
};

export type TargetInput = {
  intent: Intent;
  facts: RepoFacts;
  base: BaseChoice | null;
  lastReviewed: LastReviewed | null;
};

export type ChurnRow = { path: string; changed: number };
export type UntrackedRow = { path: string; lines: number };

export type PlanInput = {
  target: Target;
  facts: RepoFacts;
  base: BaseChoice | null;
  /** `git diff --shortstat` output, or null when there is no local stat. */
  shortstat: string | null;
  churn: ChurnRow[];
  untracked: UntrackedRow[];
};

export type SessionRow = {
  slug: string;
  kind: string;
  path: string;
  updated_at: string;
  comment_count: number;
};

export type Comment = {
  location: string;
  path: string | null;
  start_line: number | null;
  end_line: number | null;
  side: string;
  comment_type: string;
  content: string;
};

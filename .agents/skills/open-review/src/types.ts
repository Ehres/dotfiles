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

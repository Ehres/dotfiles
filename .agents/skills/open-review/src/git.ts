import { execFileSync } from "node:child_process";
import type { RefInfo, RepoFacts, WorkTree } from "./types.ts";

const DEFAULT_BRANCHES = ["origin/main", "origin/master", "main", "master"];

export function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

/** Same, but a non-zero exit is an answer rather than an exception. */
export function gitOk(args: string[], cwd: string): string | null {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

export function collectFacts(cwd: string): RepoFacts | null {
  const root = gitOk(["rev-parse", "--show-toplevel"], cwd);
  if (root === null) return null;

  const gitDir = git(["rev-parse", "--absolute-git-dir"], cwd);
  const commonDir = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd);
  // symbolic-ref rather than abbrev-ref: a detached HEAD gets null instead of
  // the string "HEAD", which would then be treated as a branch name.
  const branch = gitOk(["symbolic-ref", "--quiet", "--short", "HEAD"], cwd);
  const head = gitOk(["rev-parse", "--verify", "HEAD"], cwd);
  const reflogName = head === null ? null : readReflogName(cwd, branch);

  return {
    root,
    gitDir,
    commonDir,
    branch,
    head,
    work: readWorkTree(cwd),
    refs: {
      reflogName,
      candidates: head === null ? [] : probeRefs(cwd, reflogName, head),
    },
  };
}

/** Porcelain v1 with NUL termination, so paths with spaces survive intact. */
function readWorkTree(cwd: string): WorkTree {
  const out = git(["status", "--porcelain", "-z", "--untracked-files=all"], cwd);
  let staged = 0;
  let unstaged = 0;
  const untracked: string[] = [];

  for (const entry of out.split("\0")) {
    if (entry.length < 4) continue;
    const code = entry.slice(0, 2);
    const path = entry.slice(3);
    if (code === "??") {
      untracked.push(path);
      continue;
    }
    if (code[0] !== " " && code[0] !== "?") staged += 1;
    if (code[1] !== " " && code[1] !== "?") unstaged += 1;
  }

  return {
    staged,
    unstaged,
    untracked,
    dirty: staged > 0 || unstaged > 0 || untracked.length > 0,
  };
}

/**
 * The oldest reflog entry of a branch names its start point:
 * "branch: Created from master". A `git checkout -b` with no start point
 * records the literal "HEAD"; it is returned as-is and discarded downstream.
 */
function readReflogName(cwd: string, branch: string | null): string | null {
  if (branch === null) return null;
  const log = gitOk(["reflog", "show", "--format=%gs", branch], cwd);
  if (!log) return null;
  const oldest = log.split("\n").at(-1) ?? "";
  const match = /^branch: Created from (.+)$/.exec(oldest);
  return match ? (match[1] as string) : null;
}

/**
 * The candidate set, in a deterministic order: what the reflog named, every
 * ref merged into HEAD, then the conventional defaults. Probing is two git
 * calls per candidate, over a handful of candidates — the old script ran up to
 * a hundred over an arbitrary window of the fifty most recent refs.
 */
function probeRefs(cwd: string, reflogName: string | null, head: string): RefInfo[] {
  const wanted: string[] = [];
  const add = (ref: string): void => {
    if (ref && !wanted.includes(ref)) wanted.push(ref);
  };

  if (reflogName && reflogName !== "HEAD") {
    if (!reflogName.startsWith("origin/")) add(`origin/${reflogName}`);
    add(reflogName);
  }
  const merged = gitOk(
    ["for-each-ref", "--merged", "HEAD", "--format=%(refname:short)", "refs/heads", "refs/remotes"],
    cwd,
  );
  for (const ref of (merged ?? "").split("\n")) add(ref.trim());
  for (const ref of DEFAULT_BRANCHES) add(ref);

  return wanted.map((ref) => probeRef(cwd, ref, head));
}

function probeRef(cwd: string, ref: string, head: string): RefInfo {
  const sha = gitOk(["rev-parse", "--verify", "-q", `${ref}^{commit}`], cwd);
  if (sha === null) return { ref, sha: null, mergeBase: null, distance: null };
  const mergeBase = gitOk(["merge-base", ref, head], cwd);
  if (mergeBase === null) return { ref, sha, mergeBase: null, distance: null };
  const count = gitOk(["rev-list", "--count", `${ref}..${head}`], cwd);
  return { ref, sha, mergeBase, distance: count === null ? null : Number(count) };
}

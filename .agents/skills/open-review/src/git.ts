import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChurnRow, RefInfo, RepoFacts, StatSpec, UntrackedRow, WorkTree } from "./types.ts";

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
      candidates: head === null ? [] : probeRefs(cwd, reflogName, branch, head),
    },
  };
}

/**
 * Porcelain v1 with NUL termination, so paths with spaces survive intact. A
 * rename or copy carries one extra NUL-separated field for the old path, with
 * no "XY " status prefix — it must be consumed, not parsed as its own entry.
 */
function readWorkTree(cwd: string): WorkTree {
  const out = git(["status", "--porcelain", "-z", "--untracked-files=all"], cwd);
  const fields = out.split("\0");
  let staged = 0;
  let unstaged = 0;
  const untracked: string[] = [];

  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i];
    if (entry === undefined || entry.length < 4) continue;
    const code = entry.slice(0, 2);
    const path = entry.slice(3);
    if (code === "??") {
      untracked.push(path);
      continue;
    }
    if (code[0] !== " " && code[0] !== "?") staged += 1;
    if (code[1] !== " " && code[1] !== "?") unstaged += 1;
    if (code[0] === "R" || code[0] === "C" || code[1] === "R" || code[1] === "C") i += 1;
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
 * The candidate set, in a deterministic order: what the reflog named, the
 * independent ancestor branches (those reachable from no other candidate —
 * the nearest ancestor is always among them), one ref sitting exactly on
 * HEAD as a last resort, then the conventional defaults. Bounded regardless
 * of how many branches the repo has — probing every ref merged into HEAD
 * individually cost 27s on a repo with 127 of them.
 */
function probeRefs(cwd: string, reflogName: string | null, branch: string | null, head: string): RefInfo[] {
  const results: RefInfo[] = [];
  const seen = new Set<string>();
  const emit = (info: RefInfo): void => {
    if (seen.has(info.ref)) return;
    seen.add(info.ref);
    results.push(info);
  };

  if (reflogName && reflogName !== "HEAD") {
    if (!reflogName.startsWith("origin/")) emit(probeRef(cwd, `origin/${reflogName}`, head));
    emit(probeRef(cwd, reflogName, head));
  }

  // Every ref merged into HEAD is an ancestor of HEAD by construction, so its
  // merge-base is its own sha — no merge-base call needed, and no rev-parse,
  // since %(objectname) already gives the sha. origin/HEAD, the branch itself
  // and its own remote are excluded here (not just filtered downstream): left
  // in, one of them could be the closest ancestor and consume the walk's one
  // match below, hiding the true nearest ancestor branch behind it.
  const excluded = new Set<string>(["origin/HEAD"]);
  if (branch !== null) {
    excluded.add(branch);
    excluded.add(`origin/${branch}`);
  }
  const merged = gitOk(
    ["for-each-ref", "--merged", "HEAD", "--format=%(objectname) %(refname:short)", "refs/heads", "refs/remotes"],
    cwd,
  );
  const bySha = new Map<string, string>();
  for (const line of (merged ?? "").split("\n")) {
    const trimmed = line.trim();
    const space = trimmed.indexOf(" ");
    if (space === -1) continue;
    const sha = trimmed.slice(0, space);
    const ref = trimmed.slice(space + 1);
    if (excluded.has(ref)) continue;
    if (!bySha.has(sha)) bySha.set(sha, ref);
  }

  // If ancestor A is reachable from ancestor B, B is strictly closer to HEAD,
  // so A cannot be the nearest — the nearest ancestor is always among the
  // refs reachable from no other ref in the set. `merge-base --independent`
  // computes exactly that set in one call. A topological walk was tried
  // first and was wrong: it lists a commit before its ancestors, but breaks
  // ties between equally-ready commits (both sides of a merge, say) by
  // commit date, newest first, not by graph distance — so its first match
  // need not be the nearest one.
  const survivingShas = [...bySha.keys()].filter((sha) => sha !== head);
  const independentSet = new Set(independentShas(cwd, survivingShas));
  for (const sha of survivingShas) {
    if (!independentSet.has(sha)) continue;
    const ref = bySha.get(sha) as string;
    const count = gitOk(["rev-list", "--count", `${ref}..${head}`], cwd);
    emit({ ref, sha, mergeBase: sha, distance: count === null ? null : Number(count) });
  }

  // A ref sitting exactly on HEAD, kept only as a last resort so a brand-new
  // branch still has a base to report.
  const onHead = bySha.get(head);
  if (onHead !== undefined) emit({ ref: onHead, sha: head, mergeBase: head, distance: 0 });

  for (const ref of DEFAULT_BRANCHES) emit(probeRef(cwd, ref, head));

  return results;
}

/**
 * The shas reachable from no other sha in the set — candidates for "nearest
 * ancestor" cannot be anything else. `merge-base --independent` takes the
 * shas as argv, so a repo with thousands of merged refs could overflow the
 * command line; chunk it and re-run once over the union, which is sound
 * because reachability is transitive.
 */
function independentShas(cwd: string, shas: string[]): string[] {
  if (shas.length === 0) return [];
  const CHUNK = 200;
  if (shas.length <= CHUNK) {
    const out = gitOk(["merge-base", "--independent", ...shas], cwd);
    return out ? out.split("\n").filter(Boolean) : [];
  }
  const reduced: string[] = [];
  for (let i = 0; i < shas.length; i += CHUNK) {
    const out = gitOk(["merge-base", "--independent", ...shas.slice(i, i + CHUNK)], cwd);
    if (out) reduced.push(...out.split("\n").filter(Boolean));
  }
  const out = gitOk(["merge-base", "--independent", ...reduced], cwd);
  return out ? out.split("\n").filter(Boolean) : [];
}

function probeRef(cwd: string, ref: string, head: string): RefInfo {
  const sha = gitOk(["rev-parse", "--verify", "-q", `${ref}^{commit}`], cwd);
  if (sha === null) return { ref, sha: null, mergeBase: null, distance: null };
  const mergeBase = gitOk(["merge-base", ref, head], cwd);
  if (mergeBase === null) return { ref, sha, mergeBase: null, distance: null };
  const count = gitOk(["rev-list", "--count", `${ref}..${head}`], cwd);
  return { ref, sha, mergeBase, distance: count === null ? null : Number(count) };
}

/** The path filter is appended here so the stat and the popup always agree. */
function diffArgs(spec: Extract<StatSpec, { kind: "diff" }>, pathFilter: string | null): string[] {
  return pathFilter === null ? [...spec.args] : [...spec.args, "--", pathFilter];
}

export function shortstat(
  cwd: string,
  spec: Extract<StatSpec, { kind: "diff" }>,
  pathFilter: string | null,
): string {
  return gitOk(["diff", "--shortstat", ...diffArgs(spec, pathFilter)], cwd) ?? "";
}

export function numstat(
  cwd: string,
  spec: Extract<StatSpec, { kind: "diff" }>,
  pathFilter: string | null,
): ChurnRow[] {
  const out = gitOk(["diff", "--numstat", ...diffArgs(spec, pathFilter)], cwd) ?? "";
  const rows: ChurnRow[] = [];
  for (const line of out.split("\n")) {
    const [added, deleted, path] = line.split("\t");
    // "-" marks a binary file: no line counts to add up.
    if (!path || added === "-" || deleted === "-") continue;
    rows.push({ path, changed: Number(added) + Number(deleted) });
  }
  return rows.sort((left, right) => right.changed - left.changed || left.path.localeCompare(right.path));
}

export function countLines(cwd: string, path: string): UntrackedRow {
  try {
    const text = readFileSync(join(cwd, path), "utf8");
    const lines = text.length === 0 ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
    return { path, lines };
  } catch {
    return { path, lines: 0 };
  }
}

export function isAncestor(cwd: string, maybeAncestor: string, descendant: string): boolean {
  return gitOk(["merge-base", "--is-ancestor", maybeAncestor, descendant], cwd) !== null;
}

export function commitsBetween(cwd: string, from: string, to: string): number {
  const count = gitOk(["rev-list", "--count", `${from}..${to}`], cwd);
  return count === null ? 0 : Number(count);
}

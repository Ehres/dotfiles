import { DEFAULT_BRANCHES } from "./constants.ts";
import type { BaseChoice, RefInfo, RepoFacts } from "./types.ts";

/**
 * The base a branch was stacked on, resolved without a single network call.
 * Three rules in order: the branch's creation reflog, the nearest true
 * ancestor, then the conventional default branches.
 */
export function chooseBase(facts: RepoFacts): BaseChoice | null {
  const usable = facts.refs.candidates.filter(
    (candidate) =>
      candidate.sha !== null &&
      candidate.mergeBase !== null &&
      candidate.distance !== null &&
      !isSelf(candidate.ref, facts.branch),
  );
  const byRef = new Map(usable.map((candidate) => [candidate.ref, candidate]));

  const seeded = fromReflog(facts.refs.reflogName, byRef);
  if (seeded) return choice(seeded, "created-from reflog");

  const nearest = nearestAncestor(usable, facts.branch);
  if (nearest) return choice(nearest, "nearest ancestor branch");

  for (const name of DEFAULT_BRANCHES) {
    const hit = byRef.get(name);
    if (hit) return choice(hit, "fallback default branch");
  }
  return null;
}

// origin/<branch> is left out of the hard exclusion here: on a feature
// branch it is a stale copy of yourself, but on trunk it is the only real
// base there is. nearestAncestor demotes it instead of removing it, so a
// feature branch still prefers a real parent while trunk still gets a base.
function isSelf(ref: string, branch: string | null): boolean {
  return ref === "origin/HEAD" || (branch !== null && ref === branch);
}

/**
 * The reflog records a name, not a ref. Prefer its remote-tracking form: a
 * local branch left behind its remote would place the base too far back.
 * The literal "HEAD", recorded by a `git checkout -b` with no start point,
 * carries no information.
 */
function fromReflog(name: string | null, byRef: Map<string, RefInfo>): RefInfo | null {
  if (!name || name === "HEAD") return null;
  const candidates = name.startsWith("origin/") ? [name] : [`origin/${name}`, name];
  for (const candidate of candidates) {
    const hit = byRef.get(candidate);
    if (hit) return hit;
  }
  return null;
}

/**
 * A true ancestor is a ref whose own tip is the merge-base with HEAD. Two
 * kinds of ref are kept only as a last resort, ranked behind every real
 * ancestor rather than dropped outright: one sitting exactly on HEAD (it
 * gives a brand-new branch a base to report without ever beating a real
 * one), and origin/<branch> (a feature branch's own stale remote should
 * never win over an actual parent — but on trunk, where nothing else is
 * left, it is the only real base there is).
 */
function nearestAncestor(candidates: RefInfo[], branch: string | null): RefInfo | null {
  const ownRemote = branch === null ? null : `origin/${branch}`;
  const ancestors = candidates.filter((candidate) => candidate.mergeBase === candidate.sha);
  const sorted = [...ancestors].sort((left, right) => {
    const rank = (candidate: RefInfo) =>
      candidate.distance === 0 || candidate.ref === ownRemote ? Number.MAX_SAFE_INTEGER : (candidate.distance as number);
    return rank(left) - rank(right) || left.ref.localeCompare(right.ref);
  });
  return sorted[0] ?? null;
}

function choice(info: RefInfo, how: BaseChoice["how"]): BaseChoice {
  return {
    ref: info.ref,
    how,
    mergeBase: info.mergeBase as string,
    commits: info.distance as number,
  };
}

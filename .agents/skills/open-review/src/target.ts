import type { Intent, RepoFacts, StatSpec, Target, TargetInput } from "./types.ts";

export function buildTarget(input: TargetInput): Target {
  const { intent } = input;
  switch (intent.mode.kind) {
    case "pr":
      return buildPrTarget(intent);
    case "file":
      return finish(intent, {
        description: `the file ${intent.mode.path}`,
        args: ["--file", intent.mode.path],
        stat: { kind: "file", path: intent.mode.path },
      });
    case "revset":
      return finish(intent, {
        description: intent.mode.revset,
        args: ["-r", intent.mode.revset],
        stat: { kind: "diff", args: [intent.mode.revset] },
      });
    case "working-tree":
      return workingTree(input);
    case "since-last":
      return sinceLast(input);
    case "auto":
      return auto(input, []);
  }
}

/**
 * The only target that needs no facts at all, which is why it is the one mode
 * that still works outside a git repository.
 */
export function buildPrTarget(intent: Intent): Target {
  if (intent.mode.kind !== "pr") throw new Error("buildPrTarget called with a non-pr intent");
  return finish(intent, {
    description: `pull request ${intent.mode.target}`,
    args: ["pr", intent.mode.target],
    stat: { kind: "none", reason: "pass-through, no local stat" },
  });
}

function workingTree(input: TargetInput): Target {
  if (!input.facts.work.dirty) {
    return empty(input, "the working tree is clean");
  }
  return finish(input.intent, {
    description: "the working tree",
    args: ["-w"],
    stat: { kind: "diff", args: ["HEAD"] },
    notes: ["-w covers staged, unstaged and untracked changes; tuicr has no staged-only mode"],
  });
}

function auto(input: TargetInput, notes: string[]): Target {
  const { facts, base } = input;
  const dirty = facts.work.dirty;

  const container = containedIn(facts);
  if (container !== null) {
    if (!dirty) {
      return empty(input, `HEAD is already contained in ${container} and the working tree is clean`);
    }
    return finish(input.intent, {
      description: "the working tree",
      args: ["-w"],
      stat: { kind: "diff", args: ["HEAD"] },
      notes: [...notes, `HEAD is already contained in ${container}, so it has no commits of its own to review`],
    });
  }

  if (base === null) {
    if (!dirty) return empty(input, "no base branch found and the working tree is clean");
    return finish(input.intent, {
      description: "the working tree",
      args: ["-w"],
      stat: { kind: "diff", args: ["HEAD"] },
      notes: [...notes, "no base branch could be resolved, so only the working tree is under review"],
    });
  }

  const range = `${base.mergeBase}..HEAD`;
  if (base.commits > 0 && dirty) {
    return finish(input.intent, {
      description: "the branch's commits plus the working tree",
      args: ["-r", range, "-w"],
      stat: { kind: "diff", args: [base.mergeBase] },
      notes,
    });
  }
  if (base.commits > 0) {
    return finish(input.intent, {
      description: "the branch's commits",
      args: ["-r", range],
      stat: { kind: "diff", args: [base.mergeBase, "HEAD"] },
      notes,
    });
  }
  if (dirty) {
    return finish(input.intent, {
      description: "the working tree",
      args: ["-w"],
      stat: { kind: "diff", args: ["HEAD"] },
      notes,
    });
  }
  return empty(
    input,
    `the working tree is clean and there are no commits since ${base.ref}`,
  );
}

/**
 * The branch or remote that already holds HEAD plus more commits, if there is
 * one. HEAD sitting inside another branch has no commits of its own to review:
 * a detached checkout of an upstream commit, or a branch whose work has landed.
 * Base resolution can still name a real ancestor far behind such a HEAD, and
 * every commit since would land in the review.
 *
 * The branch's own remote copy is not containment: a colleague pushing on top
 * of your branch must not empty out your review.
 */
function containedIn(facts: RepoFacts): string | null {
  const { head, branch } = facts;
  if (head === null) return null;
  const own = branch === null ? [] : [branch, `origin/${branch}`];
  const container = facts.refs.candidates.find(
    (candidate) => !own.includes(candidate.ref) && candidate.mergeBase === head && candidate.sha !== head,
  );
  return container?.ref ?? null;
}

function sinceLast(input: TargetInput): Target {
  const { facts, lastReviewed } = input;
  if (lastReviewed === null) {
    return auto(input, ["no previous review recorded for this branch — showing the whole branch"]);
  }
  if (!lastReviewed.isAncestor) {
    return auto(input, [
      "the last reviewed commit is no longer an ancestor of HEAD (rebased?) — showing the whole branch",
    ]);
  }
  const dirty = facts.work.dirty;
  if (lastReviewed.commits === 0 && !dirty) {
    return empty(input, "nothing new since the last review");
  }
  const range = `${lastReviewed.sha}..HEAD`;
  if (lastReviewed.commits > 0 && dirty) {
    return finish(input.intent, {
      description: "commits and working-tree changes since the last review",
      args: ["-r", range, "-w"],
      stat: { kind: "diff", args: [lastReviewed.sha] },
    });
  }
  if (lastReviewed.commits > 0) {
    return finish(input.intent, {
      description: "commits since the last review",
      args: ["-r", range],
      stat: { kind: "diff", args: [lastReviewed.sha, "HEAD"] },
    });
  }
  return finish(input.intent, {
    description: "working-tree changes since the last review",
    args: ["-w"],
    stat: { kind: "diff", args: ["HEAD"] },
  });
}

/**
 * Appends the path filter, the passthrough flags and --no-update-check. Takes
 * the intent rather than the whole input, so a pr target can be built with no
 * repository to gather facts from.
 */
function finish(
  intent: Intent,
  parts: { description: string; args: string[]; stat: StatSpec; notes?: string[] },
): Target {
  const { pathFilter, passthrough } = intent;
  const tuicrArgs = [...parts.args];
  if (pathFilter !== null) tuicrArgs.push("-p", pathFilter);
  tuicrArgs.push(...passthrough);
  // A version-check prompt inside a modal popup is a failure mode.
  tuicrArgs.push("--no-update-check");

  const description = pathFilter === null
    ? parts.description
    : `${parts.description}, filtered to ${pathFilter}`;

  return { description, tuicrArgs, stat: parts.stat, notes: parts.notes ?? [], emptyReason: null };
}

function empty(input: TargetInput, reason: string): Target {
  return {
    description: "nothing to review",
    tuicrArgs: [],
    stat: { kind: "none", reason },
    notes: [],
    emptyReason: reason,
  };
}

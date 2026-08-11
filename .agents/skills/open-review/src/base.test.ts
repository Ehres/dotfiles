import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseBase } from "./base.ts";
import type { RefInfo, RepoFacts } from "./types.ts";

function ref(
  name: string,
  over: Partial<RefInfo> = {},
): RefInfo {
  // By default a true ancestor: its own tip is the merge-base.
  const sha = over.sha ?? `sha-${name}`;
  return { ref: name, sha, mergeBase: sha, distance: 3, ...over };
}

function facts(over: {
  branch?: string | null;
  reflogName?: string | null;
  candidates?: RefInfo[];
}): RepoFacts {
  return {
    root: "/repo",
    gitDir: "/repo/.git",
    commonDir: "/repo/.git",
    branch: over.branch ?? "feature",
    head: "sha-head",
    work: { staged: 0, unstaged: 0, untracked: [], dirty: false },
    refs: { reflogName: over.reflogName ?? null, candidates: over.candidates ?? [] },
  };
}

test("the creation reflog wins when its ref is usable", () => {
  const chosen = chooseBase(
    facts({ reflogName: "master", candidates: [ref("master"), ref("origin/old", { distance: 1 })] }),
  );
  assert.deepEqual(chosen, {
    ref: "master",
    how: "created-from reflog",
    mergeBase: "sha-master",
    commits: 3,
  });
});

// A local master behind its remote would place the base too far back and pull
// other people's commits into the range.
test("the reflog name is looked up remote-qualified first", () => {
  const chosen = chooseBase(
    facts({
      reflogName: "master",
      candidates: [ref("master", { distance: 9 }), ref("origin/master", { distance: 4 })],
    }),
  );
  assert.equal(chosen?.ref, "origin/master");
  assert.equal(chosen?.commits, 4);
});

test("a reflog naming the literal HEAD is discarded", () => {
  const chosen = chooseBase(
    facts({ reflogName: "HEAD", candidates: [ref("origin/master", { distance: 2 })] }),
  );
  assert.equal(chosen?.how, "nearest ancestor branch");
  assert.equal(chosen?.ref, "origin/master");
});

// The base advancing past the fork point is the normal state of a day-old
// branch: `master` is no longer an ancestor, but it still shares history and is
// still the right base. Defect 2 is what happens when this is mishandled.
test("a reflog ref that is no longer an ancestor is still accepted on shared history", () => {
  const chosen = chooseBase(
    facts({
      reflogName: "master",
      candidates: [ref("master", { sha: "sha-c3", mergeBase: "sha-c2", distance: 4 })],
    }),
  );
  assert.deepEqual(chosen, {
    ref: "master",
    how: "created-from reflog",
    mergeBase: "sha-c2",
    commits: 4,
  });
});

test("a ref sharing no history with HEAD is never chosen", () => {
  const chosen = chooseBase(
    facts({
      reflogName: "unrelated",
      candidates: [ref("unrelated", { mergeBase: null }), ref("main", { distance: 5 })],
    }),
  );
  assert.equal(chosen?.ref, "main");
});

test("the nearest true ancestor wins over a further one", () => {
  const chosen = chooseBase(
    facts({ candidates: [ref("master", { distance: 12 }), ref("parent-branch", { distance: 2 })] }),
  );
  assert.deepEqual(chosen, {
    ref: "parent-branch",
    how: "nearest ancestor branch",
    mergeBase: "sha-parent-branch",
    commits: 2,
  });
});

// The branch itself and origin/HEAD are hard-excluded; its own remote is
// merely demoted to a last resort, so a real ancestor still wins over it here.
test("the branch itself and origin/HEAD are excluded; its own remote is demoted", () => {
  const chosen = chooseBase(
    facts({
      branch: "feature",
      candidates: [
        ref("feature", { distance: 0 }),
        ref("origin/feature", { distance: 0 }),
        ref("origin/HEAD", { distance: 1 }),
        ref("master", { distance: 7 }),
      ],
    }),
  );
  assert.equal(chosen?.ref, "master");
});

// The trunk regression: on a branch with no feature/base split (working
// directly on master), origin/<branch> is not a stale copy of yourself — it
// is the only real base there is. Demoting it to last-resort must not mean
// discarding it when nothing else is left.
test("on trunk, origin/<branch> is the base when it is the only candidate", () => {
  const chosen = chooseBase(
    facts({
      branch: "master",
      candidates: [ref("origin/master", { distance: 15 }), ref("master", { distance: 0 })],
    }),
  );
  assert.deepEqual(chosen, {
    ref: "origin/master",
    how: "nearest ancestor branch",
    mergeBase: "sha-origin/master",
    commits: 15,
  });
});

// Proves demotion is a rank change, not a no-op: without it, the nearest-
// ancestor rule would pick origin/feature outright since 2 < 9.
test("origin/<branch> loses to a farther real ancestor once demoted", () => {
  const chosen = chooseBase(
    facts({
      branch: "feature",
      candidates: [ref("origin/feature", { distance: 2 }), ref("master", { distance: 9 })],
    }),
  );
  assert.equal(chosen?.ref, "master");
});

test("a ref sitting on HEAD is a last resort, not a winner", () => {
  const onHead = ref("wip-backup", { distance: 0 });
  const behind = ref("master", { distance: 6 });
  assert.equal(chooseBase(facts({ candidates: [onHead, behind] }))?.ref, "master");
  const only = chooseBase(facts({ candidates: [onHead] }));
  assert.equal(only?.ref, "wip-backup");
  assert.equal(only?.commits, 0);
});

test("equal distances resolve lexicographically, so the answer is stable", () => {
  const chosen = chooseBase(
    facts({ candidates: [ref("zed", { distance: 4 }), ref("alpha", { distance: 4 })] }),
  );
  assert.equal(chosen?.ref, "alpha");
});

test("a ref that shares history without being an ancestor loses to a true ancestor", () => {
  const chosen = chooseBase(
    facts({
      candidates: [
        ref("master", { sha: "sha-c3", mergeBase: "sha-c2", distance: 2 }),
        ref("parent", { distance: 5 }),
      ],
    }),
  );
  assert.equal(chosen?.how, "nearest ancestor branch");
  assert.equal(chosen?.ref, "parent");
});

test("with no usable ancestor, the default branches are tried in a fixed order", () => {
  const chosen = chooseBase(
    facts({
      candidates: [
        ref("master", { sha: "sha-m", mergeBase: "sha-old", distance: 3 }),
        ref("origin/master", { sha: "sha-om", mergeBase: "sha-old", distance: 2 }),
      ],
    }),
  );
  assert.deepEqual(chosen, {
    ref: "origin/master",
    how: "fallback default branch",
    mergeBase: "sha-old",
    commits: 2,
  });
});

test("nothing usable at all yields null", () => {
  assert.equal(chooseBase(facts({ candidates: [] })), null);
  assert.equal(chooseBase(facts({ candidates: [ref("main", { sha: null, mergeBase: null })] })), null);
});

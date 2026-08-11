import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { collectFacts } from "./git.ts";
import { chooseBase } from "./base.ts";
import { makeRepo } from "./testrepo.ts";
import type { Repo } from "./testrepo.ts";

/**
 * repo.commit(), but with explicit author/committer dates so a topological
 * tie-break (which git resolves by commit date, newest first) is
 * deterministic rather than dependent on how fast the fixture runs.
 */
function commitAt(repo: Repo, message: string, iso: string): void {
  execFileSync("git", ["add", "-A"], { cwd: repo.dir });
  execFileSync("git", ["commit", "-q", "-m", message], {
    cwd: repo.dir,
    env: { ...process.env, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso },
  });
}

test("a branch off master resolves master as its base", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("b.txt", "b");
    repo.commit("f1");

    const facts = collectFacts(repo.dir);
    assert.ok(facts);
    assert.equal(facts.branch, "feature");
    assert.equal(facts.work.dirty, false);

    const base = chooseBase(facts);
    assert.equal(base?.ref, "master");
    assert.equal(base?.how, "created-from reflog");
    assert.equal(base?.commits, 1);
  } finally {
    repo.cleanup();
  }
});

test("a stacked branch resolves its parent branch, not master", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "parent", "master");
    repo.write("b.txt", "b");
    repo.commit("p1");
    repo.run("checkout", "-q", "-b", "child", "parent");
    repo.write("c.txt", "c");
    repo.commit("s1");

    const base = chooseBase(collectFacts(repo.dir)!);
    assert.equal(base?.ref, "parent");
    assert.equal(base?.commits, 1);
  } finally {
    repo.cleanup();
  }
});

// Defect 2: with the base tip as the diff endpoint, the commit that landed on
// master after the fork shows up inverted. The merge-base must be the fork
// point, and the commit count must not include it.
test("a base that advanced after the fork is frozen at the fork point", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    const forkPoint = repo.run("rev-parse", "HEAD");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("mine.txt", "mine");
    repo.commit("f1");
    repo.run("checkout", "-q", "master");
    repo.write("theirs.txt", "theirs");
    repo.commit("c2");
    repo.run("checkout", "-q", "feature");

    const base = chooseBase(collectFacts(repo.dir)!);
    assert.equal(base?.ref, "master");
    assert.equal(base?.mergeBase, forkPoint);
    assert.equal(base?.commits, 1, "only my commit is in the range");
  } finally {
    repo.cleanup();
  }
});

// The reflog records a bare name. If that name is taken literally while the
// local branch has fallen behind its remote, the base lands too far back and
// the range swallows commits that are not mine.
test("a reflog name is resolved to the remote when the local ref lagged behind", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    const behind = repo.run("rev-parse", "HEAD");
    repo.write("b.txt", "b");
    repo.commit("c2");
    // Both refs are at c2, as they would be right after a push.
    repo.run("update-ref", "refs/remotes/origin/master", "master");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("c.txt", "c");
    repo.commit("f1");
    // Now local master falls behind its remote, which is the state that breaks
    // a literal reading of the reflog.
    repo.run("update-ref", "refs/heads/master", behind);

    const facts = collectFacts(repo.dir)!;
    assert.equal(facts.refs.reflogName, "master", "the reflog names the local ref");
    const base = chooseBase(facts);
    assert.equal(base?.ref, "origin/master");
    assert.equal(base?.commits, 1, "taking local master literally would say 2");
  } finally {
    repo.cleanup();
  }
});

test("a plain checkout -b records HEAD, so the ancestor rule takes over", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature");
    repo.write("b.txt", "b");
    repo.commit("f1");

    const facts = collectFacts(repo.dir)!;
    assert.equal(facts.refs.reflogName, "HEAD");
    const base = chooseBase(facts);
    assert.equal(base?.ref, "master");
    assert.equal(base?.how, "nearest ancestor branch");
  } finally {
    repo.cleanup();
  }
});

test("a linked worktree reports its own root and the shared common dir", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    const linked = `${repo.dir}-wt`;
    repo.run("worktree", "add", "-q", linked, "-b", "wt", "master");
    repo.write("b.txt", "b");

    const facts = collectFacts(linked)!;
    assert.equal(facts.branch, "wt");
    assert.ok(facts.root.endsWith("-wt"));
    assert.notEqual(facts.gitDir, facts.commonDir);
    assert.equal(chooseBase(facts)?.ref, "master");
  } finally {
    repo.run("worktree", "remove", "--force", `${repo.dir}-wt`);
    repo.cleanup();
  }
});

test("a detached HEAD has no branch but still resolves a base", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("b.txt", "b");
    repo.commit("f1");
    repo.run("checkout", "-q", "--detach", "HEAD");

    const facts = collectFacts(repo.dir)!;
    assert.equal(facts.branch, null);
    assert.equal(facts.refs.reflogName, null);
    assert.ok(chooseBase(facts));
  } finally {
    repo.cleanup();
  }
});

test("an unborn HEAD reports no head and no candidates", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    const facts = collectFacts(repo.dir)!;
    assert.equal(facts.head, null);
    assert.deepEqual(facts.refs.candidates, []);
    assert.equal(facts.work.dirty, true);
    assert.deepEqual(facts.work.untracked, ["a.txt"]);
  } finally {
    repo.cleanup();
  }
});

test("the working tree is counted by category", () => {
  const repo = makeRepo();
  try {
    repo.write("tracked.txt", "one");
    repo.write("edited.txt", "one");
    repo.commit("c1");
    repo.write("tracked.txt", "two");
    repo.run("add", "tracked.txt");
    repo.write("edited.txt", "two");
    repo.write("new.txt", "new");

    const work = collectFacts(repo.dir)!.work;
    assert.equal(work.staged, 1);
    assert.equal(work.unstaged, 1);
    assert.deepEqual(work.untracked, ["new.txt"]);
    assert.equal(work.dirty, true);
  } finally {
    repo.cleanup();
  }
});

test("a path with a space survives status parsing", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    repo.write("with space.txt", "x");
    assert.deepEqual(collectFacts(repo.dir)!.work.untracked, ["with space.txt"]);
  } finally {
    repo.cleanup();
  }
});

// The porcelain -z stream carries an extra NUL field for a rename's old path,
// with no "XY " prefix. Read as its own entry, it inflates both counts.
test("a staged rename does not inflate the staged or unstaged count", () => {
  const repo = makeRepo();
  try {
    repo.write("tracked.txt", "one");
    repo.commit("c1");
    repo.run("mv", "tracked.txt", "renamed.txt");

    const work = collectFacts(repo.dir)!.work;
    assert.equal(work.staged, 1);
    assert.equal(work.unstaged, 0);
    assert.deepEqual(work.untracked, []);
  } finally {
    repo.cleanup();
  }
});

test("a staged rename with a further edit counts once in each category", () => {
  const repo = makeRepo();
  try {
    repo.write("tracked.txt", "one");
    repo.commit("c1");
    repo.run("mv", "tracked.txt", "renamed.txt");
    repo.write("renamed.txt", "two");

    const work = collectFacts(repo.dir)!.work;
    assert.equal(work.staged, 1);
    assert.equal(work.unstaged, 1);
  } finally {
    repo.cleanup();
  }
});

test("outside a repository, collectFacts returns null", () => {
  assert.equal(collectFacts("/"), null);
});

// Before the bound, probing every ref merged into HEAD individually cost 27s
// on a repo with 127 of them. This is the test that would have caught it.
test("the candidate set stays bounded no matter how many branches are merged", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    for (let i = 0; i < 30; i++) {
      repo.run("branch", `merged-${i}`, "master");
    }
    repo.run("checkout", "-q", "-b", "feature", "master");
    repo.write("b.txt", "b");
    repo.commit("f1");

    const facts = collectFacts(repo.dir)!;
    assert.ok(facts.refs.candidates.length <= 10, `expected a bounded set, got ${facts.refs.candidates.length}`);

    const base = chooseBase(facts);
    assert.equal(base?.ref, "master");
    assert.equal(base?.commits, 1);
  } finally {
    repo.cleanup();
  }
});

// origin/<branch> can be a real ancestor at a positive distance when there are
// unpushed commits, and closer than master — but it must never be the base.
// A plain `checkout -b` (no start point given) discards the reflog, so this
// only exercises the ancestor rule, not the reflog rule, if left there.
test("origin/<branch> is never picked as the base", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    repo.run("checkout", "-q", "-b", "feature");
    repo.write("b.txt", "b");
    repo.commit("f1");
    repo.run("update-ref", "refs/remotes/origin/feature", "feature");
    repo.write("c.txt", "c");
    repo.commit("f2");

    const facts = collectFacts(repo.dir)!;
    assert.equal(facts.refs.reflogName, "HEAD", "the reflog rule must not be the one deciding this");
    const base = chooseBase(facts);
    assert.equal(base?.ref, "master");
  } finally {
    repo.cleanup();
  }
});

// origin/HEAD's %(refname:short) is just "origin" — the "/HEAD" suffix is
// stripped — not "origin/HEAD". The candidate-collection exclusion list was
// built from that literal string and so never matched it, letting it slip
// through under the bare name "origin". With the real origin/master ref
// excluded elsewhere (deleting local master here isolates that: nothing else
// can then win the sha race ahead of origin/HEAD), "origin" was the only
// survivor and became the reported base — a base that is not a branch, and a
// stale cached symref (only `git remote set-head` refreshes it) that could
// silently be preferred over the real default branch.
test("origin/HEAD is never offered as a candidate under its short name", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    repo.commit("c1");
    const fork = repo.run("rev-parse", "HEAD");
    repo.run("checkout", "-q", "-b", "feature");
    repo.write("b.txt", "b");
    repo.commit("f1");
    repo.run("branch", "-D", "master");
    repo.run("update-ref", "refs/remotes/origin/master", fork);
    repo.run("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/master");

    const facts = collectFacts(repo.dir)!;
    assert.ok(
      facts.refs.candidates.every((candidate) => candidate.ref !== "origin"),
      `origin/HEAD must not surface as a candidate named "origin", got: ${JSON.stringify(facts.refs.candidates)}`,
    );
    const base = chooseBase(facts);
    assert.equal(base?.ref, "origin/master");
  } finally {
    repo.cleanup();
  }
});

// A topological walk lists a commit before its ancestors, but when several
// commits are equally "ready" — both parents of a merge, here — it breaks the
// tie by commit date, newest first, not by graph distance. `bar` is the true
// nearest ancestor (distance 2) but was committed before `foo` (distance 6),
// so a walk that stops at its first match hits `foo` first and never
// considers `bar` at all.
test("the nearest ancestor is found by graph distance, not by which side of a merge is newer", () => {
  const repo = makeRepo();
  try {
    repo.write("a.txt", "a");
    commitAt(repo, "c1", "2024-01-01T00:00:00Z");

    repo.run("checkout", "-q", "-b", "bar", "master");
    for (let i = 0; i < 5; i++) {
      repo.write(`bar-${i}.txt`, String(i));
      commitAt(repo, `bar${i}`, `2024-01-02T00:0${i}:00Z`);
    }

    repo.run("checkout", "-q", "-b", "foo", "master");
    repo.write("foo.txt", "foo");
    commitAt(repo, "foo1", "2024-01-05T00:00:00Z");

    repo.run("checkout", "-q", "bar");
    repo.run("checkout", "-q", "-b", "feature");
    repo.run("merge", "--no-ff", "-q", "-m", "merge foo into feature", "foo");

    const facts = collectFacts(repo.dir)!;
    assert.equal(facts.refs.reflogName, "HEAD", "the reflog rule must not be the one deciding this");
    const base = chooseBase(facts);
    assert.equal(base?.ref, "bar");
    assert.equal(base?.commits, 2);
  } finally {
    repo.cleanup();
  }
});

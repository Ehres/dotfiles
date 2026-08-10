import { test } from "node:test";
import assert from "node:assert/strict";
import { collectFacts } from "./git.ts";
import { chooseBase } from "./base.ts";
import { makeRepo } from "./testrepo.ts";

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

test("outside a repository, collectFacts returns null", () => {
  assert.equal(collectFacts("/"), null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { abbreviateHome, footerPath } from "./footer.ts";

const home = "/Users/max";

test("the home directory itself becomes ~ and paths inside it are prefixed", () => {
  assert.equal(abbreviateHome(home, home), "~");
  assert.equal(abbreviateHome(`${home}/projects/dotfiles`, home), "~/projects/dotfiles");
});

test("a sibling that merely shares the home prefix is left untouched", () => {
  assert.equal(abbreviateHome("/Users/max-backup/repo", home), "/Users/max-backup/repo");
  assert.equal(abbreviateHome("/Users/maxime/repo", home), "/Users/maxime/repo");
});

test("paths outside home and an empty home are left untouched", () => {
  assert.equal(abbreviateHome("/opt/work", home), "/opt/work");
  assert.equal(abbreviateHome("/Users/max/x", ""), "/Users/max/x");
});

test("footerPath splits the abbreviated path before appending the branch", () => {
  assert.deepEqual(footerPath(`${home}/projects/dotfiles`, home, "master"), { parent: "~/projects", name: "dotfiles:master" });
});

test("a branch containing slashes stays whole in the name", () => {
  assert.deepEqual(footerPath(`${home}/projects/dotfiles`, home, "feat/tamago-footer"), {
    parent: "~/projects",
    name: "dotfiles:feat/tamago-footer",
  });
});

test("without a branch the name is the last segment alone", () => {
  assert.deepEqual(footerPath(`${home}/projects/dotfiles`, home), { parent: "~/projects", name: "dotfiles" });
  assert.deepEqual(footerPath(home, home), { parent: "", name: "~" });
});

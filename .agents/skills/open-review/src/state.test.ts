import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  awaitPlan,
  clearPlan,
  parseState,
  planPath,
  readLastReviewed,
  serializeState,
  writePlan,
  writeLastReviewed,
} from "./state.ts";

function dir(): string {
  return mkdtempSync(join(tmpdir(), "open-review-state-"));
}

test("state round-trips through parse and serialize", () => {
  const text = "feature\tabc123\t2026-08-07T10:00:00.000Z\nother\tdef456\t2026-08-06T10:00:00.000Z\n";
  const parsed = parseState(text);
  assert.equal(parsed.get("feature"), "abc123");
  assert.equal(parsed.get("other"), "def456");
  assert.equal(parseState(serializeState(parsed)).get("feature"), "abc123");
});

test("state parsing survives junk lines and a missing file", () => {
  const parsed = parseState("\ngarbage\nfeature\tabc123\t2026-08-07T10:00:00.000Z\n");
  assert.equal(parsed.size, 1);
  assert.equal(parsed.get("feature"), "abc123");
});

test("the last reviewed sha is read back per branch", () => {
  const common = dir();
  try {
    assert.equal(readLastReviewed(common, "feature"), null);
    writeLastReviewed(common, "feature", "abc123");
    writeLastReviewed(common, "other", "def456");
    assert.equal(readLastReviewed(common, "feature"), "abc123");
    assert.equal(readLastReviewed(common, "other"), "def456");
    writeLastReviewed(common, "feature", "999999");
    assert.equal(readLastReviewed(common, "feature"), "999999");
  } finally {
    rmSync(common, { recursive: true, force: true });
  }
});

test("a null branch has no state to read or write", () => {
  const common = dir();
  try {
    writeLastReviewed(common, null, "abc123");
    assert.equal(readLastReviewed(common, null), null);
    assert.equal(existsSync(join(common, "open-review.state")), false);
  } finally {
    rmSync(common, { recursive: true, force: true });
  }
});

// Defect 4: `exit 2` used to leave the previous run's plan on disk, and --plan
// printed it as if it described the review that never opened.
test("clearPlan removes a previous plan so it cannot be inherited", () => {
  const gitDir = dir();
  try {
    writeFileSync(planPath(gitDir), "stale plan from an earlier run");
    clearPlan(gitDir);
    assert.equal(existsSync(planPath(gitDir)), false);
    clearPlan(gitDir); // idempotent
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
  }
});

test("awaitPlan returns the plan once written", async () => {
  const gitDir = dir();
  try {
    writePlan(gitDir, "mode: the working tree");
    assert.equal(await awaitPlan(gitDir, 100), "mode: the working tree");
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
  }
});

test("awaitPlan gives up rather than hanging", async () => {
  const gitDir = dir();
  try {
    assert.equal(await awaitPlan(gitDir, 150), null);
  } finally {
    rmSync(gitDir, { recursive: true, force: true });
  }
});

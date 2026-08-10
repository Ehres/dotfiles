import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, UsageError } from "./args.ts";

test("no arguments means auto, launch, no filter", () => {
  assert.deepEqual(parseArgs([]), {
    action: "launch",
    mode: { kind: "auto" },
    pathFilter: null,
    passthrough: [],
  });
});

test("-w selects the working tree", () => {
  assert.deepEqual(parseArgs(["-w"]).mode, { kind: "working-tree" });
  assert.deepEqual(parseArgs(["--working-tree"]).mode, { kind: "working-tree" });
});

test("-r carries its revset verbatim", () => {
  assert.deepEqual(parseArgs(["-r", "main...HEAD"]).mode, {
    kind: "revset",
    revset: "main...HEAD",
  });
});

test("pr and its mr alias carry the target", () => {
  assert.deepEqual(parseArgs(["pr", "123"]).mode, { kind: "pr", target: "123" });
  assert.deepEqual(parseArgs(["mr", "u/r#7"]).mode, { kind: "pr", target: "u/r#7" });
});

test("--file carries the path", () => {
  assert.deepEqual(parseArgs(["--file", "docs/plan.md"]).mode, {
    kind: "file",
    path: "docs/plan.md",
  });
});

test("--since-last is its own mode", () => {
  assert.deepEqual(parseArgs(["--since-last"]).mode, { kind: "since-last" });
});

// Defect 1: `open-review -p src/` used to keep the auto path, which then
// rebuilt the argument array and dropped the filter, reviewing everything.
test("a path filter composes with auto instead of replacing it", () => {
  const intent = parseArgs(["-p", "src/"]);
  assert.deepEqual(intent.mode, { kind: "auto" });
  assert.equal(intent.pathFilter, "src/");
});

test("a path filter composes with every other mode", () => {
  const intent = parseArgs(["-w", "-p", "src/main.ts"]);
  assert.deepEqual(intent.mode, { kind: "working-tree" });
  assert.equal(intent.pathFilter, "src/main.ts");
});

// Defect 5: `${ARGS[i + 1]}` on the last index is an unbound variable under
// `set -u`, so this used to die with a bash error instead of a usage message.
test("a value flag in last position is a usage error", () => {
  assert.throws(() => parseArgs(["-w", "-p"]), UsageError);
  assert.throws(() => parseArgs(["-r"]), UsageError);
  assert.throws(() => parseArgs(["--file"]), UsageError);
});

test("two targets is a usage error", () => {
  assert.throws(() => parseArgs(["-w", "-r", "main..HEAD"]), UsageError);
});

test("actions are recognised", () => {
  assert.equal(parseArgs(["--plan"]).action, "plan");
  assert.equal(parseArgs(["--dry-run"]).action, "dry-run");
  assert.equal(parseArgs(["--exec"]).action, "exec");
  assert.equal(parseArgs(["-h"]).action, "help");
  assert.equal(parseArgs(["--help"]).action, "help");
});

test("unknown flags are forwarded to tuicr, with their values", () => {
  assert.deepEqual(parseArgs(["--theme", "tokyonight", "-A"]).passthrough, [
    "--theme",
    "tokyonight",
    "-A",
  ]);
});

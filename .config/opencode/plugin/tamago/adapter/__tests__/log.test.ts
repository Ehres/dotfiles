import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ERROR_LOG, createErrorLog } from "../log.ts";

const scratch = () => mkdtempSync(join(tmpdir(), "tamago-log-"));
const lines = (dir: string) => readFileSync(join(dir, ERROR_LOG), "utf8").trimEnd().split("\n");

test("an error is appended with a timestamp and its message", () => {
  const dir = scratch();
  createErrorLog(dir)(new Error("boom"));
  const out = lines(dir);
  assert.match(out[0] ?? "", /^\d{4}-\d{2}-\d{2}T.* boom$/);
});

test("the same error repeated is written once, then summarised when something else arrives", () => {
  const dir = scratch();
  const log = createErrorLog(dir);
  log(new Error("EACCES: permission denied"));
  log(new Error("EACCES: permission denied"));
  log(new Error("EACCES: permission denied"));
  assert.equal(lines(dir).filter((l) => l.includes("EACCES")).length, 1, "one entry while it repeats");
  log(new Error("something else"));
  const out = lines(dir);
  const summary = out.findIndex((l) => /repeated 2 more times/.test(l));
  const next = out.findIndex((l) => l.endsWith("something else"));
  assert.ok(summary >= 0, out.join("\n"));
  assert.ok(next > summary, "the new error is written after the repeat summary");
});

test("non-Error values are logged as strings", () => {
  const dir = scratch();
  createErrorLog(dir)("plain failure");
  assert.ok(lines(dir)[0]?.endsWith("plain failure"));
});

test("an error that keeps repeating on a hot path touches the disk once, not once per occurrence", () => {
  const dir = scratch();
  const log = createErrorLog(dir);
  log(new Error("EACCES: permission denied"));
  rmSync(dir, { recursive: true, force: true });
  log(new Error("EACCES: permission denied"));
  assert.equal(existsSync(dir), false, "a repeat is counted in memory: nothing is written, nothing is made");
});

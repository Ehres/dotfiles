import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { shellQuote, TMUX_POPUP } from "./tmux.ts";

/**
 * Parses a literal command-line fragment into the argv it produces — the
 * same job `$SHELL -c` does for `display-popup -E`'s command, and again for
 * the shell `tmux new-session` spawns once `tmux-popup` has flattened its
 * arguments with `CMD="$*"`. Shelling out to `/bin/sh` is more faithful than
 * hand-rolling a parser, and it never touches tmux or tuicr.
 */
function shellSplit(line: string): string[] {
  const script = `set -- ${line}\nfor a in "$@"; do printf '%s\\n' "$a"; done`;
  const { stdout } = spawnSync("/bin/sh", ["-c", script], { encoding: "utf8" });
  return stdout.length === 0 ? [] : stdout.replace(/\n$/, "").split("\n");
}

/** Hop 1 (display-popup's shell), then hop 2 (tmux-popup's re-shelled CMD). */
function roundTrip(words: string[], quote: (word: string) => string): string[] {
  const inner = words.map(quote).join(" ");
  const afterHop1 = shellSplit(inner);
  const cmd = afterHop1.join(" ");
  return shellSplit(cmd);
}

const doubleQuote = (word: string): string => shellQuote(shellQuote(word));
const onceQuote = (word: string): string => shellQuote(word);

test("a plain word needs no quoting and round-trips through both hops", () => {
  assert.equal(doubleQuote("src/main.ts"), "src/main.ts");
  assert.deepEqual(roundTrip(["tuicr", "src/main.ts"], doubleQuote), ["tuicr", "src/main.ts"]);
});

test("a space survives both hops as one argument, doubly quoted", () => {
  const word = "a b.txt";
  assert.equal(doubleQuote(word), "''\\''a b.txt'\\'''");
  assert.deepEqual(roundTrip(["tuicr", word], doubleQuote), ["tuicr", word]);
});

test("an embedded single quote survives both hops", () => {
  const word = "it's.ts";
  assert.deepEqual(roundTrip(["tuicr", word], doubleQuote), ["tuicr", word]);
});

test("a command substitution is carried as literal data, not executed", () => {
  const word = "$(echo hi)";
  assert.deepEqual(roundTrip(["tuicr", word], doubleQuote), ["tuicr", word]);
});

test("a semicolon does not terminate the command at either hop", () => {
  const word = "a;b";
  assert.deepEqual(roundTrip(["tuicr", word], doubleQuote), ["tuicr", word]);
});

// The regression this whole file guards against: quoting once (the old
// behaviour) protects the first hop, but tmux-popup's `CMD="$*"` strips
// those quotes before the second hop ever sees the word.
test("quoting once survives the first hop but splits apart at the second", () => {
  const word = "a b.txt";
  assert.notDeepEqual(roundTrip(["tuicr", word], onceQuote), ["tuicr", word]);
  assert.deepEqual(roundTrip(["tuicr", word], onceQuote), ["tuicr", "a", "b.txt"]);
});

test("quoting once lets a command substitution execute at the second hop", () => {
  const word = "$(echo hi)";
  assert.notDeepEqual(roundTrip(["tuicr", word], onceQuote), ["tuicr", word]);
  assert.deepEqual(roundTrip(["tuicr", word], onceQuote), ["tuicr", "hi"]);
});

// The narrower door: the old carve-out left any `~/`-prefixed word unquoted
// so the one hardcoded helper path would expand, but `--file`/`-p` are
// ordinary entry points a caller can point at a tilde-prefixed path too —
// the carve-out could not tell the two apart.
test("a tilde-prefixed word is no longer expanded — it round-trips as literal data", () => {
  const word = "~/notes/my plan.md";
  assert.deepEqual(roundTrip(["tuicr", word], doubleQuote), ["tuicr", word]);
});

test("a tilde-prefixed word carrying a command substitution does not execute", () => {
  const dir = mkdtempSync(join(tmpdir(), "open-review-pwn-"));
  const marker = join(dir, "PWNED");
  try {
    const word = `~/x$(touch ${marker}).md`;
    const result = roundTrip(["tuicr", word], doubleQuote);
    assert.deepEqual(result, ["tuicr", word]);
    assert.equal(existsSync(marker), false, "the command substitution must never run");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the resolved helper path arrives as one argument, unchanged", () => {
  assert.equal(TMUX_POPUP, join(homedir(), "scripts", "tmux-popup"));
  assert.deepEqual(roundTrip(["tuicr", TMUX_POPUP], doubleQuote), ["tuicr", TMUX_POPUP]);
});

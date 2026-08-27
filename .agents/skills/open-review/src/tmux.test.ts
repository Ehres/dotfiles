import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildReviewPaneArgs,
  openReviewPane,
  shellQuote,
  TMUX_POPUP,
  waitForReviewStarted,
} from "./tmux.ts";

/**
 * Parses a literal command-line fragment into the argv it produces — the
 * same job `$SHELL -c` does for `split-window`'s command, and again for
 * the shell `tmux new-session` spawns once `tmux-popup` has flattened its
 * arguments with `CMD="$*"`. Shelling out to `/bin/sh` is more faithful than
 * hand-rolling a parser, and it never touches tmux or tuicr.
 */
function shellSplit(line: string): string[] {
  const script = `set -- ${line}\nfor a in "$@"; do printf '%s\\n' "$a"; done`;
  const { stdout } = spawnSync("/bin/sh", ["-c", script], { encoding: "utf8" });
  return stdout.length === 0 ? [] : stdout.replace(/\n$/, "").split("\n");
}

/** Hop 1 (split-window's shell), then hop 2 (tmux-popup's re-shelled CMD). */
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

test("the review pane targets the caller, takes 60% on the right, and receives focus", () => {
  const args = buildReviewPaneArgs("/repo with space", "%7", ["--file", "docs/my plan.md"]);

  assert.deepEqual(args.slice(0, -1), [
    "split-window",
    "-t", "%7",
    "-c", "/repo with space",
    "-h",
    "-f",
    "-l", "60%",
    "-P",
    "-F", "#{pane_id}",
  ]);
  assert.equal(args.includes("-d"), false, "the review pane must receive focus");

  const command = args.at(-1);
  assert.ok(command);
  const afterHop1 = shellSplit(command);
  assert.deepEqual(shellSplit(afterHop1.join(" ")), [
    TMUX_POPUP,
    "--kill",
    "tuicr",
    "tuicr",
    "--file",
    "docs/my plan.md",
  ]);
});

test("the review pane uses 60% of a multi-pane window and reaches its right edge", () => {
  const socket = `/tmp/open-review-geometry-${process.pid}.sock`;
  const tmux = (...args: string[]): string => {
    const result = spawnSync("tmux", ["-S", socket, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };

  try {
    const sourcePane = tmux(
      "-f", "/dev/null",
      "new-session", "-dP", "-F", "#{pane_id}",
      "-x", "100", "-y", "30", "-s", "geometry",
      "sleep 30",
    );
    tmux("split-window", "-d", "-t", sourcePane, "-h", "-l", "50%", "sleep 30");
    assert.equal(tmux("list-panes", "-t", "geometry", "-F", "#{pane_id}").split("\n").length, 2);

    const args = buildReviewPaneArgs("/repo", sourcePane, ["-w"]);
    args[args.length - 1] = "sleep 30";
    const reviewPane = tmux(...args);
    const [windowWidth, paneLeft, paneWidth] = tmux(
      "display-message", "-p", "-t", reviewPane,
      "#{window_width} #{pane_left} #{pane_width}",
    ).split(" ").map(Number);

    assert.ok(windowWidth !== undefined && paneLeft !== undefined && paneWidth !== undefined);
    assert.equal(paneWidth, windowWidth * 0.6);
    assert.equal(paneLeft + paneWidth, windowWidth);
  } finally {
    spawnSync("tmux", ["-S", socket, "kill-server"], { stdio: "ignore" });
  }
});

test("openReviewPane explicitly selects the pane returned by split-window", () => {
  const selected: string[] = [];
  const paneId = openReviewPane("/repo", "%7", ["-w"], {
    splitWindow: () => "%9\n",
    selectPane: (pane) => selected.push(pane),
  });

  assert.equal(paneId, "%9");
  assert.deepEqual(selected, ["%9"]);
});

test("the review pane retries nested attach on the current custom socket", () => {
  const original = process.env["TMUX"];
  const socket = "/tmp/custom tmux.sock";
  try {
    delete process.env["TMUX"];
    const command = buildReviewPaneArgs("/repo", "%7", ["-w"]).at(-1);
    assert.ok(command);
    const fallback = command.split(" || ")[1];
    assert.ok(fallback, "the pane command must recover from the helper's nested attach failure");
    process.env["TMUX"] = `${socket},123,0`;
    assert.deepEqual(shellSplit(fallback), [
      "env",
      "-u",
      "TMUX",
      "tmux",
      "-S",
      socket,
      "attach-session",
      "-t",
      "_popup_tuicr",
    ]);
  } finally {
    if (original === undefined) delete process.env["TMUX"];
    else process.env["TMUX"] = original;
  }
});

test("review startup observes the session before declaring a vanished pane", async () => {
  let sessionChecks = 0;
  let paneChecks = 0;
  const result = await waitForReviewStarted("%9", 100, 0, {
    reviewSessionAlive: () => ++sessionChecks === 2,
    reviewPaneAlive: () => {
      paneChecks += 1;
      return true;
    },
  });

  assert.equal(result, "started");
  assert.equal(paneChecks, 1, "the pane is not checked after the session appears");
});

test("review startup reports a pane that disappears before the session exists", async () => {
  const result = await waitForReviewStarted("%9", 100, 0, {
    reviewSessionAlive: () => false,
    reviewPaneAlive: () => false,
  });

  assert.equal(result, "pane-gone");
});

test("review startup times out while the pane is still present", async () => {
  const result = await waitForReviewStarted("%9", 0, 0, {
    reviewSessionAlive: () => false,
    reviewPaneAlive: () => true,
  });

  assert.equal(result, "timeout");
});

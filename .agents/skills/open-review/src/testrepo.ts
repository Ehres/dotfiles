// Test-only helper. Builds throwaway git repositories so the fact collector is
// exercised against real git rather than a mock, which is the only way the
// revset arithmetic is actually under test.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

export type Repo = {
  dir: string;
  run: (...args: string[]) => string;
  write: (path: string, content: string) => void;
  commit: (message: string) => void;
  cleanup: () => void;
};

export function makeRepo(): Repo {
  const dir = mkdtempSync(join(tmpdir(), "open-review-"));
  const run = (...args: string[]): string =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();

  run("init", "-q", "-b", "master", ".");
  run("config", "user.email", "test@example.com");
  run("config", "user.name", "Test");

  return {
    dir,
    run,
    write(path, content) {
      const full = join(dir, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    },
    commit(message) {
      run("add", "-A");
      run("commit", "-q", "-m", message);
    },
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decideLock } from "../core/lock.ts";
import { merge } from "../core/merge.ts";
import { freshCareer, hydrate, type Career, type Delta } from "../core/state.ts";

export const CAREER_FILE = "career.json";
export const LOCK_DIR = "career.lock";

export type Loaded = { career: Career; corrupt: boolean };
export type Store = {
  load(): Loaded;
  /** Returns the merged career, or undefined when another instance holds the lock. */
  flush(delta: Delta): Career | undefined;
};

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "ENOENT";
}

export function createStore(dir: string, now: () => number = Date.now): Store {
  const file = join(dir, CAREER_FILE);
  const lock = join(dir, LOCK_DIR);

  function read(): Loaded {
    mkdirSync(dir, { recursive: true });
    try {
      return hydrate(JSON.parse(readFileSync(file, "utf8")), now());
    } catch (err) {
      if (isNotFound(err)) return { career: freshCareer(now()), corrupt: false };
      return { career: freshCareer(now()), corrupt: true };
    }
  }

  function acquire(): boolean {
    mkdirSync(dir, { recursive: true });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        mkdirSync(lock);
        return true;
      } catch {
        let heldSinceMs: number | undefined;
        try {
          heldSinceMs = statSync(lock).mtimeMs;
        } catch {
          heldSinceMs = undefined;
        }
        const decision = decideLock({ held: true, heldSinceMs, now: now() });
        if (decision !== "steal") return false;
        rmSync(lock, { recursive: true, force: true });
      }
    }
    return false;
  }

  function release(): void {
    rmSync(lock, { recursive: true, force: true });
  }

  return {
    load: read,
    flush(delta) {
      if (!acquire()) return undefined;
      try {
        const merged = merge(read().career, delta);
        const tmp = `${file}.${process.pid}.tmp`;
        writeFileSync(tmp, JSON.stringify(merged, null, 2));
        renameSync(tmp, file);
        return merged;
      } finally {
        release();
      }
    },
  };
}

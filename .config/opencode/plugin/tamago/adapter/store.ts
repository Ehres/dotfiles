import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { decideLock } from "../core/lock.ts";
import { merge } from "../core/merge.ts";
import { freshCareer, hydrate, type Career, type Delta } from "../core/state.ts";

export const CAREER_FILE = "career.json";
export const LOCK_DIR = "career.lock";
export const LOCK_OWNER_FILE = "owner";

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
  const ownerFile = join(lock, LOCK_OWNER_FILE);
  let token = "";

  function read(): Loaded {
    mkdirSync(dir, { recursive: true });
    try {
      return hydrate(JSON.parse(readFileSync(file, "utf8")), now());
    } catch (err) {
      if (isNotFound(err)) return { career: freshCareer(now()), corrupt: false };
      return { career: freshCareer(now()), corrupt: true };
    }
  }

  /** True only if this instance still holds the lock it thinks it holds. */
  function owns(): boolean {
    try {
      return readFileSync(ownerFile, "utf8") === token;
    } catch {
      return false;
    }
  }

  function claim(): void {
    token = `${process.pid}:${randomUUID()}`;
    writeFileSync(ownerFile, token);
  }

  function acquire(): boolean {
    mkdirSync(dir, { recursive: true });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        mkdirSync(lock);
        claim();
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

  /** Only removes the lock we still own; a lock stolen out from under us is left alone. */
  function release(): void {
    if (owns()) rmSync(lock, { recursive: true, force: true });
  }

  return {
    load: read,
    flush(delta) {
      if (!acquire()) return undefined;
      try {
        const merged = merge(read().career, delta);
        const tmp = `${file}.${process.pid}.tmp`;
        writeFileSync(tmp, JSON.stringify(merged, null, 2));
        if (!owns()) {
          rmSync(tmp, { force: true });
          return undefined;
        }
        renameSync(tmp, file);
        return merged;
      } finally {
        release();
      }
    },
  };
}

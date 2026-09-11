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

/**
 * written: the delta is on disk, `career` is the merged result.
 * busy: another instance holds the lock; keep the delta and retry later.
 * corrupt: the file was unreadable JSON; it was set aside and nothing was
 *   written. The next flush starts from a fresh egg.
 * Any other failure throws.
 */
export type FlushResult = { outcome: "written"; career: Career } | { outcome: "busy" } | { outcome: "corrupt"; career: Career };

export type Store = {
  load(): Loaded;
  flush(delta: Delta): FlushResult;
};

function code(err: unknown): string | undefined {
  return typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
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
      if (code(err) === "ENOENT") return { career: freshCareer(now()), corrupt: false };
      if (err instanceof SyntaxError) return { career: freshCareer(now()), corrupt: true };
      throw err;
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

  /** Creates the lock directory. True when we got it, false when it already exists; other failures throw. */
  function tryMkdir(): boolean {
    try {
      mkdirSync(lock);
      return true;
    } catch (err) {
      if (code(err) === "EEXIST") return false;
      throw err;
    }
  }

  function claim(): void {
    token = `${process.pid}:${randomUUID()}`;
    try {
      writeFileSync(ownerFile, token);
    } catch (err) {
      rmSync(lock, { recursive: true, force: true });
      throw err;
    }
  }

  function heldSince(): number | undefined {
    try {
      return statSync(lock).mtimeMs;
    } catch {
      return undefined;
    }
  }

  function acquire(): boolean {
    mkdirSync(dir, { recursive: true });
    for (let attempt = 0; attempt < 2; attempt++) {
      if (tryMkdir()) {
        claim();
        return true;
      }
      if (decideLock({ held: true, heldSinceMs: heldSince(), now: now() }) !== "steal") return false;
      rmSync(lock, { recursive: true, force: true });
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
      if (!acquire()) return { outcome: "busy" };
      try {
        const loaded = read();
        if (loaded.corrupt) {
          renameSync(file, `${file}.corrupt-${now()}`);
          return { outcome: "corrupt", career: loaded.career };
        }
        const merged = merge(loaded.career, delta);
        const tmp = `${file}.${process.pid}.tmp`;
        writeFileSync(tmp, JSON.stringify(merged, null, 2));
        if (!owns()) {
          rmSync(tmp, { force: true });
          return { outcome: "busy" };
        }
        renameSync(tmp, file);
        return { outcome: "written", career: merged };
      } finally {
        release();
      }
    },
  };
}

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { CAREER_KEYS, freshCareer, merge, type Career, type Delta } from "../core/career/career.ts";
import { hydrate } from "../core/career/hydrate.ts";
import { decideLock } from "../core/store/lock.ts";
import { weightsAt } from "../core/creature/luck.ts";
import { luck, type CareerId, type Roster } from "../core/roster/roster.ts";

export const CAREER_FILE = "career.json";
/** Resting Careers, one file each, named by hatch date: `roster/<hatchedAt>.json`. Born at the first Hatch or Switch. */
export const ROSTER_DIR = "roster";
export const LOCK_DIR = "career.lock";
export const LOCK_OWNER_FILE = "owner";

export type Loaded = { career: Career; corrupt: boolean; present: boolean };

/** What was read, plus the top-level keys this build does not know, kept verbatim so a newer build's data survives our flush. */
type Read = Loaded & { unknown: Record<string, unknown> };

const KNOWN: ReadonlySet<string> = new Set<string>(CAREER_KEYS);

function unknownKeys(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([key]) => !KNOWN.has(key)));
}

/**
 * written: the delta is on disk, `career` is what the window must show: the
 *   active Career if one exists, the target Career otherwise (merged into the
 *   resting one when found there, freshly minted at `target` when nothing at
 *   all was on disk).
 * busy: another instance holds the lock; keep the delta and retry later.
 * corrupt: the active file was unreadable JSON; it was set aside and nothing
 *   was written. The next flush starts from a fresh egg.
 * Any other failure throws.
 */
export type FlushResult = { outcome: "written"; career: Career } | { outcome: "busy" } | { outcome: "corrupt"; career: Career };

/**
 * written: `career` is the new active Career.
 * busy: another instance holds the lock; nothing changed.
 * missing: no resting Career with that hatch date; nothing changed.
 * corrupt: the active file was unreadable; it was set aside, nothing else changed, `career` is a fresh egg.
 */
export type SwitchResult = { outcome: "written"; career: Career } | { outcome: "busy" } | { outcome: "missing" } | { outcome: "corrupt"; career: Career };

export type Store = {
  /** The active Career. */
  load(): Loaded;
  /** Every Career on disk: the active one and the resting ones by hatch date. A corrupt resting file is set aside and skipped. */
  roster(): { roster: Roster; corrupt: boolean };
  /** Credits `delta` to the Career hatched at `target`, active or resting; to the active one when it is on disk but `target` is not, or mints a fresh Career at `target` when nothing at all is on disk. */
  flush(delta: Delta, target: CareerId): FlushResult;
  /** Brings the resting Career hatched at `target` to the front; the active one goes to rest. */
  switch(target: CareerId): SwitchResult;
  /** Lays a fresh egg hatched at `at` as the active Career; the active one goes to rest. The gate is the caller's. */
  hatch(at: number): SwitchResult;
};

function code(err: unknown): string | undefined {
  return typeof err === "object" && err !== null ? (err as { code?: string }).code : undefined;
}

export function createStore(dir: string, now: () => number = Date.now): Store {
  const file = join(dir, CAREER_FILE);
  const rosterDir = join(dir, ROSTER_DIR);
  const lock = join(dir, LOCK_DIR);
  const ownerFile = join(lock, LOCK_OWNER_FILE);
  let token = "";
  /** The data directory is made once, not at every read: the poll of an idle window must not touch the disk. The write path makes it again, so a directory removed under us still heals. */
  let madeDir = false;

  function ensureDir(): void {
    if (madeDir) return;
    mkdirSync(dir, { recursive: true });
    madeDir = true;
  }

  const restingFile = (id: CareerId): string => join(rosterDir, `${id}.json`);

  /** One Career file: undefined when absent, `corrupt` with a fresh egg when unreadable JSON. Other failures throw. */
  function readAt(path: string): Read | undefined {
    try {
      const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
      return { ...hydrate(raw, now()), unknown: unknownKeys(raw), present: true };
    } catch (err) {
      if (code(err) === "ENOENT") return undefined;
      if (err instanceof SyntaxError) return { career: freshCareer(now()), corrupt: true, unknown: {}, present: true };
      throw err;
    }
  }

  /** The active Career: a fresh egg, not corrupt, `present: false` when the file does not exist yet. */
  function read(): Read {
    ensureDir();
    return readAt(file) ?? { career: freshCareer(now()), corrupt: false, unknown: {}, present: false };
  }

  /** Moves an unreadable file out of the way so nothing is ever written over it. */
  function setAside(path: string): void {
    renameSync(path, `${path}.corrupt-${now()}`);
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

  /** Writes a Career file atomically, tmp then rename, only while we still hold the lock. False when it was stolen. */
  function write(path: string, data: Record<string, unknown>): boolean {
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    if (!owns()) {
      rmSync(tmp, { force: true });
      return false;
    }
    renameSync(tmp, path);
    return true;
  }

  /** The resting Careers by hatch date. Only `<digits>.json` files count; an unreadable one is set aside and skipped. */
  function resting(): Career[] {
    if (!existsSync(rosterDir)) return [];
    const out: Career[] = [];
    for (const name of readdirSync(rosterDir)) {
      if (!/^\d+\.json$/.test(name)) continue;
      const path = join(rosterDir, name);
      const loaded = readAt(path);
      if (loaded === undefined) continue;
      if (loaded.corrupt) {
        setAside(path);
        continue;
      }
      out.push(loaded.career);
    }
    return out.sort((a, b) => a.hatchedAt - b.hatchedAt);
  }

  /** Copies the active Career into the roster, unknown keys included. False when the lock was stolen. */
  function rest(active: Read): boolean {
    mkdirSync(rosterDir, { recursive: true });
    return write(restingFile(active.career.hatchedAt), { ...active.unknown, ...active.career });
  }

  return {
    load: () => {
      const { career, corrupt, present } = read();
      return { career, corrupt, present };
    },
    roster: () => {
      const { career, corrupt } = read();
      return { roster: { active: career, resting: resting() }, corrupt };
    },
    flush(delta, target) {
      if (!acquire()) return { outcome: "busy" };
      try {
        const active = readAt(file);
        if (active?.corrupt) {
          setAside(file);
          return { outcome: "corrupt", career: active.career };
        }
        if (active === undefined || active.career.hatchedAt !== target) {
          const path = restingFile(target);
          const rested = readAt(path);
          if (rested !== undefined && !rested.corrupt) {
            const merged = merge(rested.career, delta);
            if (!write(path, { ...rested.unknown, ...merged })) return { outcome: "busy" };
            return { outcome: "written", career: active?.career ?? merged };
          }
          if (rested?.corrupt) setAside(path);
          // No such resting Career on disk: the Delta credits the active one, as before the Roster existed.
          // This is also what settles two windows hatching their own egg on a fresh machine: the loser's egg was never written.
          // With no active either, the window's own identity is what gets minted below, not a freshly-timestamped stranger.
        }
        const base = active?.career ?? freshCareer(target);
        const unknown = active?.unknown ?? {};
        const merged = merge(base, delta);
        if (!write(file, { ...unknown, ...merged })) return { outcome: "busy" };
        return { outcome: "written", career: merged };
      } finally {
        release();
      }
    },
    switch(target) {
      if (!acquire()) return { outcome: "busy" };
      try {
        const current = readAt(file);
        if (current?.corrupt) {
          setAside(file);
          return { outcome: "corrupt", career: current.career };
        }
        const path = restingFile(target);
        const coming = readAt(path);
        if (coming === undefined) return { outcome: "missing" };
        if (coming.corrupt) {
          setAside(path);
          return { outcome: "missing" };
        }
        if (current !== undefined && !rest(current)) return { outcome: "busy" };
        if (!owns()) return { outcome: "busy" }; // the copy is on disk and career.json untouched: a consistent state
        renameSync(path, file);
        return { outcome: "written", career: coming.career };
      } finally {
        release();
      }
    },
    hatch(at) {
      if (!acquire()) return { outcome: "busy" };
      try {
        const current = readAt(file);
        // The Luck is read before the active Career rests, so it counts once. A corrupt active file weighs nothing.
        const elders = [...(current !== undefined && !current.corrupt ? [current.career] : []), ...resting()];
        const chance = luck(elders);
        if (current?.corrupt) setAside(file);
        else if (current !== undefined && !rest(current)) return { outcome: "busy" };
        const egg = freshCareer(at, weightsAt(chance));
        if (!write(file, { ...egg })) return { outcome: "busy" };
        return { outcome: "written", career: egg };
      } finally {
        release();
      }
    },
  };
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, utimesSync, existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LOCK_STALE_MS } from "../core/lock.ts";
import { EMPTY_DELTA, freshCareer, type Delta } from "../core/state.ts";
import { CAREER_FILE, LOCK_DIR, LOCK_OWNER_FILE, createStore } from "./store.ts";

const scratch = () => mkdtempSync(join(tmpdir(), "tamago-store-"));
const d = (patch: Partial<Delta>): Delta => ({ ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools }, ...patch });

test("load on an empty directory yields a fresh, non-corrupt egg and creates the directory", () => {
  const dir = join(scratch(), "nested", "deeper");
  const store = createStore(dir, () => 42);
  const loaded = store.load();
  assert.equal(loaded.corrupt, false);
  assert.deepEqual(loaded.career, freshCareer(42));
  assert.ok(existsSync(dir));
});

test("flush merges deltas into the file and returns the merged career", () => {
  const dir = scratch();
  const store = createStore(dir, () => 7);
  const first = store.flush(d({ prompts: 2 }));
  assert.equal(first.outcome, "written");
  assert.equal(first.career?.prompts, 2);
  const second = store.flush(d({ prompts: 1, filesEdited: 3 }));
  assert.equal(second.outcome, "written");
  assert.equal(second.career?.prompts, 3);
  assert.equal(second.career?.filesEdited, 3);
  assert.equal(second.career?.hatchedAt, 7);
  const onDisk = JSON.parse(readFileSync(join(dir, CAREER_FILE), "utf8"));
  assert.equal(onDisk.prompts, 3);
  assert.ok(!existsSync(join(dir, LOCK_DIR)), "lock released");
});

test("two stores over the same directory see each other's progress", () => {
  const dir = scratch();
  const a = createStore(dir);
  const b = createStore(dir);
  a.flush(d({ sessions: 1 }));
  b.flush(d({ sessions: 1 }));
  assert.equal(a.load().career.sessions, 2);
});

test("a corrupt file loads as a fresh egg flagged corrupt", () => {
  const dir = scratch();
  writeFileSync(join(dir, CAREER_FILE), "{not json");
  const loaded = createStore(dir, () => 3).load();
  assert.equal(loaded.corrupt, true);
  assert.deepEqual(loaded.career, freshCareer(3));
});

test("a non-corruption read error (EISDIR) is not treated as corruption and is not overwritten", () => {
  const dir = scratch();
  const file = join(dir, CAREER_FILE);
  mkdirSync(file); // career.json is a directory: readFileSync throws EISDIR, not SyntaxError
  const store = createStore(dir);
  assert.throws(() => store.load());
  assert.throws(() => store.flush(d({ prompts: 1 })));
  assert.ok(existsSync(file) && statSync(file).isDirectory(), "career path is still a directory");
  assert.deepEqual(
    readdirSync(dir).filter((name) => name.endsWith(".tmp")),
    [],
    "no tmp file written",
  );
  assert.ok(!existsSync(join(dir, LOCK_DIR)), "lock released");
});

test("flush waits while a fresh lock is held", () => {
  const dir = scratch();
  const lock = join(dir, LOCK_DIR);
  mkdirSync(lock);
  writeFileSync(join(lock, LOCK_OWNER_FILE), "999999:foreign");
  const store = createStore(dir);
  assert.deepEqual(store.flush(d({ prompts: 1 })), { outcome: "busy" });
  assert.ok(existsSync(lock), "foreign lock left alone");
  assert.equal(readFileSync(join(lock, LOCK_OWNER_FILE), "utf8"), "999999:foreign", "foreign owner token untouched");
});

test("flush steals a stale lock", () => {
  const dir = scratch();
  const lock = join(dir, LOCK_DIR);
  mkdirSync(lock);
  const old = (Date.now() - LOCK_STALE_MS - 1000) / 1000;
  utimesSync(lock, old, old);
  const merged = createStore(dir).flush(d({ prompts: 1 }));
  assert.equal(merged.outcome, "written");
  assert.equal(merged.career?.prompts, 1);
  assert.ok(!existsSync(lock), "lock released after steal");
});

test("a stale lock left by another owner is stolen and released", () => {
  const dir = scratch();
  const lock = join(dir, LOCK_DIR);
  mkdirSync(lock);
  writeFileSync(join(lock, LOCK_OWNER_FILE), "999999:foreign");
  const old = (Date.now() - LOCK_STALE_MS - 1000) / 1000;
  utimesSync(lock, old, old);
  const merged = createStore(dir).flush(d({ prompts: 1 }));
  assert.equal(merged.outcome, "written");
  assert.equal(merged.career?.prompts, 1);
  const onDisk = JSON.parse(readFileSync(join(dir, CAREER_FILE), "utf8"));
  assert.equal(onDisk.prompts, 1);
  assert.ok(!existsSync(lock), "lock released after steal");
});

test("a flush that loses the lock mid-way drops its write and does not release the thief's lock", () => {
  const dir = scratch();
  const lock = join(dir, LOCK_DIR);
  // now() is called exactly once between acquiring the lock and the rename: inside
  // read(), via hydrate(..., now()) or freshCareer(now()). We use that single call
  // as the hook to simulate another instance stealing the lock mid-flush: it
  // overwrites the owner file with a foreign token, so the owns() check right
  // before rename fails and the write is abandoned.
  let calls = 0;
  const now = () => {
    calls += 1;
    if (calls === 1) writeFileSync(join(lock, LOCK_OWNER_FILE), "1:thief");
    return Date.now();
  };
  const result = createStore(dir, now).flush(d({ prompts: 1 }));
  assert.deepEqual(result, { outcome: "busy" });
  assert.ok(!existsSync(join(dir, CAREER_FILE)), "no career file written");
  assert.deepEqual(
    readdirSync(dir).filter((name) => name.endsWith(".tmp")),
    [],
    "no leftover tmp file",
  );
  assert.ok(existsSync(lock), "thief's lock left alone");
  assert.equal(readFileSync(join(lock, LOCK_OWNER_FILE), "utf8"), "1:thief", "thief's owner token untouched");
});

test("flush leaves no temporary files behind", () => {
  const dir = scratch();
  createStore(dir).flush(d({ errors: 1 }));
  assert.deepEqual(readdirSync(dir).sort(), [CAREER_FILE]);
});

test("a data directory that cannot be written makes flush throw instead of pretending the lock is busy", () => {
  const dir = scratch();
  chmodSync(dir, 0o555);
  try {
    const store = createStore(dir);
    assert.throws(() => store.flush(d({ prompts: 1 })), /EACCES|EPERM/);
  } finally {
    chmodSync(dir, 0o755);
  }
});

test("a corrupt file is set aside, not overwritten, and the next flush starts fresh", () => {
  const dir = scratch();
  writeFileSync(join(dir, CAREER_FILE), "{not json");
  const store = createStore(dir, () => 5);
  const first = store.flush(d({ prompts: 1 }));
  assert.equal(first.outcome, "corrupt");
  const kept = readdirSync(dir).filter((name) => name.startsWith(`${CAREER_FILE}.corrupt-`));
  assert.equal(kept.length, 1, "corrupt file kept aside once");
  assert.equal(readFileSync(join(dir, kept[0] ?? ""), "utf8"), "{not json");
  assert.ok(!existsSync(join(dir, CAREER_FILE)), "nothing written over the corrupt file");
  assert.ok(!existsSync(join(dir, LOCK_DIR)), "lock released");
  const second = store.flush(d({ prompts: 1 }));
  assert.equal(second.outcome, "written");
  assert.equal(second.career?.prompts, 1);
  assert.equal(second.career?.hatchedAt, 5);
});

test("a pick round-trips through flush and load, and the earlier pick wins across stores", () => {
  const dir = scratch();
  const a = createStore(dir, () => 7);
  const b = createStore(dir, () => 7);
  assert.equal(b.flush(d({ picks: { "evolution:young": { trait: "later", at: 20 } } })).outcome, "written");
  const result = a.flush(d({ picks: { "evolution:young": { trait: "earlier", at: 10 } } }));
  assert.equal(result.outcome, "written");
  const expected = { "evolution:young": { trait: "earlier", at: 10 } };
  assert.deepEqual(result.career?.picks, expected);
  assert.deepEqual(a.load().career.picks, expected);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, CAREER_FILE), "utf8")).picks, expected);
});

test("a career file written before picks existed loads with empty picks", () => {
  const dir = scratch();
  writeFileSync(join(dir, CAREER_FILE), JSON.stringify({ prompts: 3, hatchedAt: 5 }));
  const loaded = createStore(dir).load();
  assert.equal(loaded.corrupt, false);
  assert.deepEqual(loaded.career.picks, {});
  assert.equal(loaded.career.prompts, 3);
});

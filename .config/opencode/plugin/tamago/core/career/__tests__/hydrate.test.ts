import { test } from "node:test";
import assert from "node:assert/strict";
import { freshCareer } from "../career.ts";
import { hydrate, hydratePicks } from "../hydrate.ts";
import { REFERENCE } from "../../creature/species.ts";

test("hydrate fills missing fields with defaults and is not corrupt", () => {
  const { career, corrupt } = hydrate({ prompts: 7, tools: { edit: 3 } }, 500);
  assert.equal(corrupt, false);
  assert.equal(career.prompts, 7);
  assert.equal(career.tools.edit, 3);
  assert.equal(career.tools.read, 0);
  assert.equal(career.sessions, 0);
  assert.equal(career.hatchedAt, 500);
});

test("hydrate keeps hatchedAt when present", () => {
  assert.equal(hydrate({ hatchedAt: 123 }, 500).career.hatchedAt, 123);
});

test("hydrate rejects non-object input as corrupt with a fresh career", () => {
  for (const raw of [null, undefined, "x", 3, []]) {
    const { career, corrupt } = hydrate(raw, 9);
    assert.equal(corrupt, true, `raw=${JSON.stringify(raw)}`);
    assert.deepEqual(career, freshCareer(9));
  }
});

test("hydrate ignores non-finite numbers", () => {
  const { career } = hydrate({ prompts: "12", errors: Number.NaN, tools: { bash: Number.POSITIVE_INFINITY } }, 1);
  assert.equal(career.prompts, 0);
  assert.equal(career.errors, 0);
  assert.equal(career.tools.bash, 0);
});

test("hydrate reads a well-formed name and ignores a malformed one", () => {
  assert.deepEqual(hydrate({ name: { value: "Pixel", at: 3 } }, 0).career.name, { value: "Pixel", at: 3 });
  assert.equal(hydrate({ name: "Pixel" }, 0).career.name, undefined);
  assert.equal(hydrate({ name: { value: "", at: 3 } }, 0).career.name, undefined);
  assert.equal(hydrate({ name: { value: "Pixel", at: "3" } }, 0).career.name, undefined);
  assert.equal(hydrate({}, 0).career.name, undefined);
});

test("hydrate reads well-formed picks and gives {} otherwise", () => {
  assert.deepEqual(hydrate({}, 0).career.picks, {}, "today's career.json has no picks field");
  assert.deepEqual(hydrate({ picks: "x" }, 0).career.picks, {});
  assert.deepEqual(hydrate({ picks: [] }, 0).career.picks, {});
  const { career, corrupt } = hydrate({ picks: { m: { trait: "x", at: 1 }, bad: { trait: "", at: 1 } } }, 0);
  assert.equal(corrupt, false);
  assert.deepEqual(career.picks, { m: { trait: "x", at: 1 } });
});

test("hydrate reads a species string, keeps an unknown one verbatim, and defaults to the reference", () => {
  assert.equal(hydrate({}, 0).career.species, REFERENCE, "a file written before Species existed");
  assert.equal(hydrate({ species: "owl" }, 0).career.species, "owl");
  assert.equal(hydrate({ species: "from-a-newer-build" }, 0).career.species, "from-a-newer-build");
  assert.equal(hydrate({ species: "" }, 0).career.species, REFERENCE);
  assert.equal(hydrate({ species: 3 }, 0).career.species, REFERENCE);
  assert.equal(hydrate({ species: 3 }, 0).corrupt, false);
});

test("hydratePicks gives {} for a missing, non-record or empty value", () => {
  for (const raw of [undefined, null, "x", 3, [], {}]) assert.deepEqual(hydratePicks(raw), {}, `raw=${JSON.stringify(raw)}`);
});

test("hydratePicks keeps well-formed entries and drops the rest silently", () => {
  const raw = {
    "evolution:hatchling": { trait: "sarcastic", at: 10 },
    "": { trait: "orphan", at: 1 },
    "bad-trait": { trait: "", at: 2 },
    "bad-type": { trait: 4, at: 3 },
    "bad-at": { trait: "stoic", at: "4" },
    "nan-at": { trait: "stoic", at: Number.NaN },
    "not-a-record": "stoic",
  };
  assert.deepEqual(hydratePicks(raw), { "evolution:hatchling": { trait: "sarcastic", at: 10 } });
});

test("hydratePicks drops a __proto__ key instead of setting the prototype", () => {
  const picks = hydratePicks(JSON.parse('{"__proto__":{"trait":"evil","at":1},"m":{"trait":"ok","at":2}}'));
  assert.deepEqual(picks, { m: { trait: "ok", at: 2 } });
  assert.equal(Object.getPrototypeOf(picks), Object.prototype);
  assert.equal((picks as Record<string, unknown>)["trait"], undefined);
});

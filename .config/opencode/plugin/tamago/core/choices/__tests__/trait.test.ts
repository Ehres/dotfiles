import { test } from "node:test";
import assert from "node:assert/strict";
import { freshCareer, type Career } from "../../career/career.ts";
import { TRAITS, eligible, traits, type Trait } from "../trait.ts";
import { MARK } from "../../appearance/marks.ts";
import { TRAIT_TEXT } from "../../text/traits.ts";
import { ACCENT } from "../../speech/accent.ts";

const table: readonly Trait[] = [
  { id: "sarcastic", needs: [] },
  { id: "stoic", needs: [] },
  { id: "hat", needs: [] },
  { id: "pirate", needs: ["sarcastic", "hat"] },
  { id: "monocle", needs: ["hat"] },
];

const withPicks = (picks: Career["picks"]): Career => ({ ...freshCareer(1), picks });

test("traits is empty for a fresh egg", () => {
  assert.deepEqual(traits(freshCareer(1), table), []);
});

test("traits lists held Traits by Pick time, then by trait id on a tie", () => {
  const career = withPicks({
    m3: { trait: "stoic", at: 30 },
    m1: { trait: "hat", at: 10 },
    m2: { trait: "sarcastic", at: 10 },
  });
  assert.deepEqual(traits(career, table), ["hat", "sarcastic", "stoic"]);
});

test("traits drops a Pick naming a Trait the table no longer knows, silently", () => {
  const career = withPicks({ m1: { trait: "hat", at: 1 }, m2: { trait: "retired", at: 2 } });
  assert.deepEqual(traits(career, table), ["hat"]);
});

test("traits never lists the same Trait twice", () => {
  const career = withPicks({ m1: { trait: "hat", at: 1 }, m2: { trait: "hat", at: 2 } });
  assert.deepEqual(traits(career, table), ["hat"]);
});

test("eligible offers every starter Trait on a fresh egg, in table order", () => {
  assert.deepEqual(eligible(freshCareer(1), table), ["sarcastic", "stoic", "hat"]);
});

test("eligible excludes held Traits and includes what their needs unlock", () => {
  const career = withPicks({ m1: { trait: "hat", at: 1 } });
  assert.deepEqual(eligible(career, table), ["sarcastic", "stoic", "monocle"]);
});

test("a Trait with several needs waits for all of them", () => {
  const some = withPicks({ m1: { trait: "sarcastic", at: 1 } });
  assert.equal(eligible(some, table).includes("pirate"), false);
  const all = withPicks({ m1: { trait: "sarcastic", at: 1 }, m2: { trait: "hat", at: 2 } });
  assert.deepEqual(eligible(all, table), ["stoic", "pirate", "monocle"]);
});

test("the shipped Traits are three families of two, the child needing its parent", () => {
  assert.deepEqual(
    TRAITS.map((one) => [one.id, [...one.needs]]),
    [
      ["hardy", []],
      ["unshaken", ["hardy"]],
      ["proud", []],
      ["boastful", ["proud"]],
      ["watchful", []],
      ["restless", ["watchful"]],
    ],
  );
});

test("only the three parents are eligible before any Pick", () => {
  const career = withPicks({});
  assert.deepEqual(eligible(career), ["hardy", "proud", "watchful"]);
});

test("every shipped Trait has a mark, a name and a voice, and every table names only shipped Traits", () => {
  const ids: ReadonlySet<string> = new Set(TRAITS.map((trait) => trait.id));
  for (const [table, name] of [
    [MARK, "MARK"],
    [TRAIT_TEXT, "TRAIT_TEXT"],
    [ACCENT, "ACCENT"],
  ] as const) {
    const keys: ReadonlySet<string> = new Set(Object.keys(table));
    for (const id of ids) assert.ok(keys.has(id), `${name} is missing ${id}`);
    for (const key of keys) assert.ok(ids.has(key), `${name} has a stale entry for ${key}`);
  }
});

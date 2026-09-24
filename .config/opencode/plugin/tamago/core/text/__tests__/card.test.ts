import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY_MS, STATS_HIDDEN, age, progress, reveal, sheetLines, speciesLine, traitLines } from "../card.ts";
import { REFERENCE } from "../../creature/catalog.ts";
import { freshCareer, type Career } from "../../career/career.ts";
import { tamago } from "../../tamago.ts";

const career: Career = {
  sessions: 12,
  prompts: 340,
  tools: { read: 500, edit: 120, bash: 90, other: 7 },
  filesEdited: 60,
  errors: 9,
  questions: 0,
  hatchedAt: 0,
  species: "cat",
  picks: {},
};

test("age counts whole days since hatching", () => {
  assert.equal(age(0, 0), "hatched today");
  assert.equal(age(0, DAY_MS - 1), "hatched today");
  assert.equal(age(0, DAY_MS), "1 day old");
  assert.equal(age(0, 12 * DAY_MS + 5), "12 days old");
  assert.equal(age(10, 0), "hatched today", "a clock set back never goes negative");
});

test("age counts whole days since hatching, in French", () => {
  assert.equal(age(0, 0, "fr"), "éclos aujourd'hui");
  assert.equal(age(0, DAY_MS, "fr"), "1 jour");
  assert.equal(age(0, 12 * DAY_MS + 5, "fr"), "12 jours");
});

test("progress shows the bar towards the next stage", () => {
  assert.equal(progress(tamago(career), 10), "[#---------] 2,147 / 6,000 xp → adult");
  assert.equal(progress(tamago({ ...freshCareer(0), species: "cat" }), 4), "[----] 0 / 200 xp → hatchling");
});

test("an elder has reached its final form", () => {
  const elder: Career = { ...career, prompts: 20_000 };
  assert.equal(progress(tamago(elder), 4), "[####] 41,467 xp · final form");
});

test("an elder has reached its final form, in French", () => {
  const elder: Career = { ...career, prompts: 20_000 };
  assert.equal(progress(tamago(elder), 4, "fr"), "[####] 41 467 xp · forme finale");
});

test("progress shows raw xp against a raw threshold farther away for a rarer species", () => {
  const dragon: Career = { ...career, species: "dragon" }; // 2,147 xp, 536.75 growth: hatchling
  const text = progress(tamago(dragon), 10);
  assert.ok(text.endsWith("2,147 / 6,000 xp → young"), text);
});

test("speciesLine hides the species while still an egg, then names it with its rarity", () => {
  assert.equal(speciesLine(tamago(freshCareer(0))), "still an egg");
  assert.equal(speciesLine(tamago({ ...freshCareer(0), species: "owl", sessions: 20 })), "owl · common"); // 200 xp: hatchling
  assert.equal(speciesLine(tamago({ ...career, species: "dragon" })), "dragon · legendary");
  assert.equal(speciesLine(tamago({ ...career, species: "nope" })), `${REFERENCE} · common`, "an unknown species reads as the reference");
});

test("the species line agrees in gender", () => {
  const owl = tamago({ ...career, species: "owl" });
  assert.equal(speciesLine(owl, "en"), "owl · common");
  assert.equal(speciesLine(owl, "fr"), "chouette · commune");
  assert.equal(speciesLine(tamago(career), "fr"), "chat · commun");
  assert.equal(speciesLine(tamago(freshCareer(0)), "fr"), "encore un œuf");
});

test("reveal names the species with the right article", () => {
  assert.equal(reveal("Tamago", tamago({ ...career, species: "owl" })), "Tamago hatched: an owl, common!");
  assert.equal(reveal("Momo", tamago({ ...career, species: "dragon" })), "Momo hatched: a dragon, legendary!");
});

test("the reveal picks its article from the gender in French and the first letter in English", () => {
  assert.equal(reveal("Nono", tamago({ ...career, species: "owl" }), "en"), "Nono hatched: an owl, common!");
  assert.equal(reveal("Nono", tamago({ ...career, species: "owl" }), "fr"), "Nono a éclos : une chouette, commune !");
  assert.equal(reveal("Nono", tamago(career), "fr"), "Nono a éclos : un chat, commun !");
});

test("sheetLines hides the stats while still an egg, then draws one bar per behavior Stat, aligned", () => {
  assert.deepEqual(sheetLines(tamago(freshCareer(0))), [STATS_HIDDEN.en]);
  const hatched: Career = { ...career, hatchedAt: 1789113932488, species: "cat" }; // draw: energy 5, chatter 9, sensitivity 1, patience 6
  assert.deepEqual(sheetLines(tamago(hatched)), [
    "energy      [#####-----] 5",
    "chatter     [#########-] 9",
    "sensitivity [#---------] 1",
    "patience    [######----] 6",
  ]);
});

test("sheetLines hides the stats while still an egg, then draws one bar per behavior Stat, aligned, in French", () => {
  assert.deepEqual(sheetLines(tamago(freshCareer(0)), "fr"), [STATS_HIDDEN.fr]);
  const hatched: Career = { ...career, hatchedAt: 1789113932488, species: "cat" }; // draw: energy 5, chatter 9, sensitivity 1, patience 6
  assert.deepEqual(sheetLines(tamago(hatched), "fr"), [
    "énergie     [#####-----] 5",
    "bavardage   [#########-] 9",
    "sensibilité [#---------] 1",
    "patience    [######----] 6",
  ]);
});

test("sheetLines shows the Stats after the Modifiers of the Species", () => {
  const hatched: Career = { ...career, hatchedAt: 1789113932488, species: "owl" }; // energy −2, chatter −1, patience +2
  assert.deepEqual(sheetLines(tamago(hatched)), [
    "energy      [###-------] 3",
    "chatter     [########--] 8",
    "sensitivity [#---------] 1",
    "patience    [########--] 8",
  ]);
  const dragon: Career = { ...career, hatchedAt: 1789113932549, species: "dragon" }; // draw: energy 10, sensitivity 0; +2 and −2 clamp
  const lines = sheetLines(tamago(dragon));
  assert.equal(lines[0], "energy      [##########] 10");
  assert.equal(lines[2], "sensitivity [----------] 0");
});

test("traitLines shows the mark and the title of each held Trait", () => {
  const kept = tamago({ ...career, picks: { "evolution:hatchling": { trait: "hardy", at: 1 } } });
  assert.deepEqual(traitLines(kept), ["+ Hardy"]);
});

test("traitLines shows the mark and the title of each held Trait, in French", () => {
  const kept = tamago({ ...career, picks: { "evolution:hatchling": { trait: "hardy", at: 1 } } });
  assert.deepEqual(traitLines(kept, "fr"), ["+ Endurant"]);
});

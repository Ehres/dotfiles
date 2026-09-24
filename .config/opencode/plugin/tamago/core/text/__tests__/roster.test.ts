import { test } from "node:test";
import assert from "node:assert/strict";
import { blocked, line, stepsIn } from "../roster.ts";
import { freshCareer, type Career } from "../../career/career.ts";

const T0 = 1_700_000_000_000;
/** 2,000 sessions weigh 20,000 XP: elder for a cat. */
const elder = (hatchedAt: number, patch: Partial<Career> = {}): Career => ({ ...freshCareer(hatchedAt), species: "cat", sessions: 2_000, ...patch });
const egg = (hatchedAt: number, patch: Partial<Career> = {}): Career => ({ ...freshCareer(hatchedAt), species: "cat", ...patch });

test("blocked names who is still growing and what to wait for", () => {
  assert.equal(
    blocked(egg(T0, { name: { value: "Momo", at: 1 } }), "Tamago", "en"),
    "Momo is still an egg. Hatch when every Tamago is elder.",
  );
  assert.equal(blocked({ ...egg(T0), sessions: 20 }, "Tamago", "en"), "Tamago is still hatchling. Hatch when every Tamago is elder.");
});

test("blocked names who is still growing and what to wait for, in French", () => {
  assert.equal(
    blocked(egg(T0, { name: { value: "Momo", at: 1 } }), "Tamago", "fr"),
    "Momo est encore un œuf. Une éclosion demande que tous soient anciens.",
  );
  assert.equal(
    blocked({ ...egg(T0), sessions: 20 }, "Tamago", "fr"),
    "Tamago est encore nouveau-né. Une éclosion demande que tous soient anciens.",
  );
});

test("stepsIn announces a new egg or the Tamago that comes to the front", () => {
  assert.equal(stepsIn(egg(T0), "Tamago", "en"), "A new egg.");
  assert.equal(stepsIn(elder(T0, { name: { value: "Momo", at: 1 } }), "Tamago", "en"), "Momo steps in.");
  assert.equal(stepsIn(elder(T0), "Tamago", "en"), "Tamago steps in.");
});

test("stepsIn announces a new egg or the Tamago that comes to the front, in French", () => {
  assert.equal(stepsIn(egg(T0), "Tamago", "fr"), "Un nouvel œuf.");
  assert.equal(stepsIn(elder(T0, { name: { value: "Momo", at: 1 } }), "Tamago", "fr"), "Momo prend la place.");
  assert.equal(stepsIn(elder(T0), "Tamago", "fr"), "Tamago prend la place.");
});

test("line names the Tamago, its species and stage, marks the active one, and shows an egg by its stage alone", () => {
  const momo = elder(T0, { species: "owl", name: { value: "Momo", at: 1 } });
  assert.equal(line(momo, "Tamago", T0, "en"), "Momo · owl · elder · active");
  assert.equal(line(momo, "Tamago", T0 - 1, "en"), "Momo · owl · elder");
  assert.equal(line(egg(T0), "Tamago", T0 - 1, "en"), "Tamago · egg");
  assert.equal(line(egg(T0), "Tamago", T0, "en"), "Tamago · egg · active");
});

test("line names the Tamago, its species and stage, marks the active one, in French", () => {
  const momo = elder(T0, { species: "owl", name: { value: "Momo", at: 1 } });
  const pixel = elder(T0, { species: "cat", name: { value: "Pixel", at: 1 } });
  assert.equal(line(momo, "Tamago", T0, "fr"), "Momo · chouette · ancienne · active");
  assert.equal(line(momo, "Tamago", T0 - 1, "fr"), "Momo · chouette · ancienne");
  assert.equal(line(pixel, "Tamago", T0, "fr"), "Pixel · chat · ancien · actif");
  assert.equal(line(egg(T0), "Tamago", T0 - 1, "fr"), "Tamago · œuf");
  assert.equal(line(egg(T0), "Tamago", T0, "fr"), "Tamago · œuf · actif");
});

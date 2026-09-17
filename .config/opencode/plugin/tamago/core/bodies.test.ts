import { test } from "node:test";
import assert from "node:assert/strict";
import { BODIES } from "./bodies.ts";
import { SPECIES } from "./species.ts";
import { STAGES } from "./stage.ts";

test("every Species of the table has a body, and every body names a Species of the table", () => {
  for (const entry of SPECIES) assert.ok(Object.hasOwn(BODIES, entry.id), `${entry.id} has no body`);
  for (const id of Object.keys(BODIES)) assert.ok(SPECIES.some((entry) => entry.id === id), `${id} is not a Species`);
});

test("every body draws every Stage past the egg", () => {
  for (const [id, bodies] of Object.entries(BODIES)) {
    for (const { id: stage } of STAGES) {
      if (stage === "egg") continue;
      assert.equal(typeof bodies[stage], "function", `${id}/${stage}`);
    }
  }
});

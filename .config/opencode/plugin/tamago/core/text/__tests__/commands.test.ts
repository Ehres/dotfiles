import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMAND_IDS, command } from "../commands.ts";

test("COMMAND_IDS lists the eight palette commands; every title is filed under Tamago, never carries the Name, and the pet description mentions it", () => {
  assert.deepEqual(COMMAND_IDS, ["mute", "card", "pet", "rename", "hatch", "roster", "choose", "language"]);
  for (const id of COMMAND_IDS) {
    const { title } = command(id, "Mochi");
    assert.ok(title.startsWith("Tamago: "), title);
    assert.ok(!title.includes("Mochi"), title);
  }
  assert.ok(command("pet", "Mochi").description.includes("Mochi"));
});

test("the choose command says how many choices wait", () => {
  assert.equal(command("choose", "Pixel", 0).description, "Nothing to choose for Pixel yet");
  assert.equal(command("choose", "Pixel", 1).description, "One choice waits for Pixel");
  assert.equal(command("choose", "Pixel", 3).description, "3 choices wait for Pixel");
});

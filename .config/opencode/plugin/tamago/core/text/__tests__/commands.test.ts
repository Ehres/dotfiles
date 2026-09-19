import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMAND_IDS, command } from "../commands.ts";

test("COMMAND_IDS lists the six palette commands; every title is filed under Tamago, never carries the Name, and the pet description mentions it", () => {
  assert.deepEqual(COMMAND_IDS, ["mute", "card", "pet", "rename", "hatch", "roster"]);
  for (const id of COMMAND_IDS) {
    const { title } = command(id, "Mochi");
    assert.ok(title.startsWith("Tamago: "), title);
    assert.ok(!title.includes("Mochi"), title);
  }
  assert.ok(command("pet", "Mochi").description.includes("Mochi"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMAND_IDS, command } from "../commands.ts";

test("COMMAND_IDS lists the eight palette commands; every title is filed under Tamago, never carries the Name, and the pet description mentions it", () => {
  assert.deepEqual(COMMAND_IDS, ["mute", "card", "pet", "rename", "hatch", "roster", "choose", "language"]);
  for (const id of COMMAND_IDS) {
    const { title } = command(id, "Mochi", 0, "en");
    assert.ok(title.startsWith("Tamago: "), title);
    assert.ok(!title.includes("Mochi"), title);
  }
  assert.ok(command("pet", "Mochi", 0, "en").description.includes("Mochi"));
});

test("the choose command says how many choices wait", () => {
  assert.equal(command("choose", "Pixel", 0, "en").description, "Nothing to choose for Pixel yet");
  assert.equal(command("choose", "Pixel", 1, "en").description, "One choice waits for Pixel");
  assert.equal(command("choose", "Pixel", 3, "en").description, "3 choices wait for Pixel");
});

test("every command reads in French: titles filed under Tamago, choose counts, in-place phrases", () => {
  for (const id of COMMAND_IDS) {
    const { title } = command(id, "Mochi", 0, "fr");
    assert.ok(title.startsWith("Tamago: "), title);
    assert.ok(!title.includes("Mochi"), title);
  }
  assert.equal(command("mute", "Mochi", 0, "fr").title, "Tamago: bulles on-off");
  assert.equal(command("card", "Mochi", 0, "fr").title, "Tamago: voir la carte");
  assert.equal(command("pet", "Mochi", 0, "fr").title, "Tamago: caresser");
  assert.equal(command("rename", "Mochi", 0, "fr").title, "Tamago: renommer");
  assert.equal(command("hatch", "Mochi", 0, "fr").title, "Tamago: faire éclore un œuf");
  assert.equal(command("roster", "Mochi", 0, "fr").title, "Tamago: roster");
  assert.equal(command("choose", "Mochi", 0, "fr").title, "Tamago: choisir un trait");
  assert.equal(command("language", "Mochi", 0, "fr").title, "Tamago: langue");
  assert.equal(command("mute", "Mochi", 0, "fr").description, "Couper ou rendre la parole à Mochi");
  assert.equal(command("card", "Mochi", 0, "fr").description, "Qui est Mochi : espèce, stade, XP, âge, stats");
  assert.equal(command("pet", "Mochi", 0, "fr").description, "Faire une caresse à Mochi");
  assert.equal(command("rename", "Mochi", 0, "fr").description, "Donner un nouveau nom à Mochi, partagé par toutes les fenêtres");
  assert.equal(command("hatch", "Mochi", 0, "fr").description, "Faire éclore un œuf quand tous les Tamago sont anciens");
  assert.equal(command("roster", "Mochi", 0, "fr").description, "Tous les Tamago de cette machine ; en choisir un pour le mettre devant");
  assert.equal(command("language", "Mochi", 0, "fr").description, "Choisir la langue dans laquelle tout se lit");
  assert.equal(command("choose", "Pixel", 0, "fr").description, "Rien à choisir pour Pixel pour l'instant");
  assert.equal(command("choose", "Pixel", 1, "fr").description, "Un choix attend Pixel");
  assert.equal(command("choose", "Pixel", 3, "fr").description, "3 choix attendent Pixel");
});

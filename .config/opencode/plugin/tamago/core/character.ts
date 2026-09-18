import { sheet, temperamentOf, type Temperament } from "./sheet.ts";
import { REFERENCE, SPECIES, type Species, type SpeciesId } from "./species.ts";
import { WEIGHTS, stage, stageIndex, type Paced } from "./stage.ts";
import type { Career, Counters } from "./state.ts";

export type Craft = "scribe" | "shell" | "sage";
export type Stance = "prudent" | "bold";
export type Vocation = { craft: Craft; stance: Stance };
export type Character = { temperament: Temperament; vocation?: Vocation };

/** Counters a Craft may weigh. `other` tools belong to no Craft. */
type CraftInput = "read" | "edit" | "bash" | "filesEdited";

/**
 * Tuning table: a Craft is where the XP comes from, so it starts from the XP
 * weights. Order matters: ties go to the first entry.
 */
export const CRAFTS: Record<Craft, Partial<Record<CraftInput, number>>> = {
  scribe: { edit: WEIGHTS.tools.edit, filesEdited: WEIGHTS.filesEdited },
  shell: { bash: WEIGHTS.tools.bash },
  sage: { read: WEIGHTS.tools.read },
};

/** Tuning table: prudent when weighted questions reach weighted prompts, so 5 questions per 100 prompts. */
export const STANCE = { questions: 20, prompts: 1 };

/** The first Stage that has a Vocation. */
const VOCATION_FROM = stageIndex("young");

/**
 * The Temperament of a Tamago: the highest Temperament Stat of its Sheet.
 * Without a Species, the reference one, which has no Modifier: the hatch date
 * alone decides, exactly as before the Sheet existed.
 */
export function temperament(hatchedAt: number, id: SpeciesId = REFERENCE, table: readonly Species[] = SPECIES): Temperament {
  return temperamentOf(sheet(hatchedAt, id, table));
}

function input(counters: Counters, key: CraftInput): number {
  return key === "filesEdited" ? counters.filesEdited : counters.tools[key];
}

export function craft(counters: Counters): Craft {
  let best: Craft = "scribe";
  let bestScore = -1;
  for (const [name, weights] of Object.entries(CRAFTS) as [Craft, Partial<Record<CraftInput, number>>][]) {
    let score = 0;
    for (const [key, weight] of Object.entries(weights) as [CraftInput, number][]) score += input(counters, key) * weight;
    if (score > bestScore) {
      best = name;
      bestScore = score;
    }
  }
  return best;
}

export function stance(counters: Counters): Stance {
  if (counters.prompts === 0) return "bold";
  return counters.questions * STANCE.questions >= counters.prompts * STANCE.prompts ? "prudent" : "bold";
}

export function vocation(paced: Paced): Vocation | undefined {
  if (stageIndex(stage(paced)) < VOCATION_FROM) return undefined;
  return { craft: craft(paced), stance: stance(paced) };
}

export function character(career: Career): Character {
  const found = vocation(career);
  return { temperament: temperament(career.hatchedAt, career.species), ...(found === undefined ? {} : { vocation: found }) };
}

/** "sarcastic · prudent shell", or the Temperament alone before young. */
export function describe(character: Character): string {
  if (character.vocation === undefined) return character.temperament;
  return `${character.temperament} · ${character.vocation.stance} ${character.vocation.craft}`;
}

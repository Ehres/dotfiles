import type { Career } from "./career/career.ts";
import { growth, stage, xp, type StageId } from "./career/stage.ts";
import { behaviorOf, type Behavior } from "./creature/behavior.ts";
import { vocation, type Character } from "./creature/character.ts";
import { sheet as sheetOf, temperamentOf, type Sheet, type Speaker, type Temperament } from "./creature/sheet.ts";
import { SPECIES, species as speciesOf, type Species } from "./creature/species.ts";

/**
 * Everything the shell and the views read about a Tamago, derived from its
 * Career in one place: the same in every window, never stored. The shell
 * computes one per Career shown and passes it down; a view never derives.
 * `species` is the table entry, the reference one for an id this build does
 * not know, like everywhere else.
 */
export type Tamago = {
  career: Career;
  species: Species;
  stage: StageId;
  xp: number;
  growth: number;
  sheet: Sheet;
  temperament: Temperament;
  behavior: Behavior;
  character: Character;
  speaker: Speaker;
};

export function tamago(career: Career, table: readonly Species[] = SPECIES): Tamago {
  const sheet = sheetOf(career.hatchedAt, career.species, table);
  const temperament = temperamentOf(sheet);
  const found = vocation(career);
  return {
    career,
    species: speciesOf(career.species, table),
    stage: stage(career),
    xp: xp(career),
    growth: growth(career),
    sheet,
    temperament,
    behavior: behaviorOf(sheet),
    character: { temperament, ...(found === undefined ? {} : { vocation: found }) },
    speaker: { hatchedAt: career.hatchedAt, species: career.species, sheet },
  };
}

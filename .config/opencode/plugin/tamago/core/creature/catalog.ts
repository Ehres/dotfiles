import type { Bodies } from "../appearance/bodies.ts";
import type { Signature } from "../speech/signature.ts";
import type { SpeciesDef, SpeciesId } from "./species.ts";
import { COMMON } from "./species/common.ts";
import { EPIC } from "./species/epic.ts";
import { LEGENDARY } from "./species/legendary.ts";
import { RARE } from "./species/rare.ts";
import { UNCOMMON } from "./species/uncommon.ts";

/**
 * Every Species that can hatch, one file per Rarity, each entry complete:
 * Modifiers, bodies and Signature. A test bounds each Modifier to
 * ±MODIFIER_MAX and their sum to MODIFIERS_SUM_MAX. Order within a Rarity is
 * the order of the draw: never reorder once shipped. Tune a `sheet` line
 * before that Species has hatched anywhere: the Sheet is derived, so
 * changing it changes the Temperament and Behavior of every Tamago of that
 * Species already alive. Once one lives, leave its line alone and add a
 * sibling Species instead. The reference entry has no Modifier and never
 * will: that is what keeps every Career from before the Sheet unchanged.
 */
export const SPECIES: readonly SpeciesDef[] = [...COMMON, ...UNCOMMON, ...RARE, ...EPIC, ...LEGENDARY];

/** The Species of a Career that recorded none: the creature drawn before Species existed. */
export const REFERENCE: SpeciesId = "cat";

function entry(id: SpeciesId, table: readonly SpeciesDef[]): SpeciesDef | undefined {
  return table.find((one) => one.id === id);
}

/** Whether this build draws that Species itself; anything else draws as the reference. */
export function known(id: SpeciesId, table: readonly SpeciesDef[] = SPECIES): boolean {
  return entry(id, table) !== undefined;
}

/** The bodies to draw: the Species' own, else the reference's for a Species this build does not know. */
export function bodiesOf(id: SpeciesId, table: readonly SpeciesDef[] = SPECIES): Bodies {
  const found = entry(id, table) ?? entry(REFERENCE, table);
  if (found === undefined) throw new Error(`no reference Species "${REFERENCE}" in the table`);
  return found.bodies;
}

/** The Signature of a Species; undefined when this build does not know it, so its Temperament speaks in its place. */
export function signatureOf(id: SpeciesId, table: readonly SpeciesDef[] = SPECIES): Signature | undefined {
  return entry(id, table)?.signature;
}

import type { Signature } from "../signature.ts";
import type { SpeciesId } from "../species.ts";

/** Filled one Species at a time; a test fails while a Species of the table has no Signature. */
export const UNCOMMON: Record<SpeciesId, Signature> = {};

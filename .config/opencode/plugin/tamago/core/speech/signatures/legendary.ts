import type { Signature } from "../signature.ts";
import type { SpeciesId } from "../../creature/species.ts";

/** The legendary Species: the dragon alone, so it keeps its standing. */
export const LEGENDARY: Record<SpeciesId, Signature> = {
  dragon: {
    permission: ["Grant it, mortal.", "Permission? Amusing.", "I await. Briefly."],
    granted: ["Naturally.", "The gates open.", "As decreed."],
    denied: ["Denied? Me?", "Smoke. Just smoke.", "Your loss."],
    woke: ["The mountain stirs.", "Who wakes a dragon?", "Ashes. Then fire."],
    long_work: ["A siege, well fought.", "Long flight. Landed.", "The hoard grows."],
    big_diff: ["I scorched it all.", "The land reshaped.", "Behold the ruins."],
    streak: ["Sparks. Nothing more.", "Scales don't scratch.", "Is that all?"],
    compacted: ["Ash clears.", "Old fire, gone.", "Fresh embers."],
    retried: ["Fire, again.", "Once more, mortal.", "Dragons persist."],
    todos_done: ["The hoard is whole.", "All conquered.", "Nothing left. Good."],
    evolved: ["Wings feel bigger.", "More fire in me.", "Bow, if you like."],
    hatched: ["A dragon. Behold.", "Rare. As I should be.", "Smoke? Just me."],
  },
};

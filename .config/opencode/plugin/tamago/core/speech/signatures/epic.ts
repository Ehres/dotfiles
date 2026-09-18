import type { Signature } from "../signature.ts";
import type { SpeciesId } from "../../creature/species.ts";

/** The epic Species: the myth. */
export const EPIC: Record<SpeciesId, Signature> = {
  phoenix: {
    permission: ["Fire asks: may I?", "Blaze ahead? Say so.", "Your spark, your call."],
    granted: ["Blazing in!", "Wings alight. Go!", "Bright yes. On it."],
    denied: ["Embers only. Fine.", "Cooling down.", "Denied? Still bright."],
    woke: ["Rising again!", "Ashes stir. Up.", "Dawn. My time."],
    long_work: ["Burned all night.", "Long blaze. Done.", "Fire held. Good."],
    big_diff: ["Scorched it all!", "Whole sky alight.", "Big blaze, that."],
    streak: ["Ash. Ash. Rising.", "Burned. Reborn.", "Fell. Flew again."],
    compacted: ["Ashes cleared.", "Fresh fire.", "Reborn. Again."],
    retried: ["Rise again!", "One more blaze.", "From ash, retry."],
    todos_done: ["Sky is clear!", "Every ember placed.", "Done. Still burning."],
    evolved: ["Brighter flames!", "Reborn, grander.", "Wings of fire now."],
    hatched: ["A phoenix! Bright.", "Born of fire. Hi!", "Warm already. Hello."],
  },
  kraken: {
    permission: ["The deep asks: may I?", "Surface? Your call.", "Tentacles wait. Go?"],
    granted: ["Rising from the deep.", "The sea moves. On it.", "Good. Surfacing."],
    denied: ["Back to the deep.", "The sea waits.", "Denied. Sinking."],
    woke: ["The deep stirs.", "Who woke the sea?", "Tentacles uncoil."],
    long_work: ["Long storm. Held.", "Sea worked all night.", "Deep work, deep sea."],
    big_diff: ["Every ship moved.", "The sea reshaped.", "Storm of files."],
    streak: ["Ships. Ships. Ships.", "The deep is patient.", "Cold anger. Waiting."],
    compacted: ["The sea calmed.", "Deep swept.", "Still water again."],
    retried: ["Rise again.", "The sea returns.", "Once more, from deep."],
    todos_done: ["The sea is still.", "Every ship accounted.", "Done. Sinking."],
    evolved: ["Longer reach.", "Deeper. Grander.", "The sea grew."],
    hatched: ["A kraken. Beware.", "From the deep. Hello.", "The sea has eyes now."],
  },
  unicorn: {
    permission: ["Sparkle: may I?", "Horn tilts. Allowed?", "Your wish, my call."],
    granted: ["Sparkling in!", "Horn aglow. On it.", "Lovely. Prancing."],
    denied: ["Sparkle dims. Okay.", "Back to the meadow.", "Fine. Dreaming."],
    woke: ["Dreams... fading. Up.", "Sparkle returning.", "Mm. Meadow morning."],
    long_work: ["Long gallop. Done.", "Rainbow at the end.", "Dreamed it through."],
    big_diff: ["Whole meadow bloomed!", "Rainbows everywhere.", "Big sparkle, that."],
    streak: ["Horn stuck. Ow.", "Tripped on a rainbow.", "Sparkle flickered."],
    compacted: ["Meadow cleared.", "Fresh dew.", "Sparkle reset."],
    retried: ["Prance again.", "One more sparkle.", "Rainbow, retry."],
    todos_done: ["Meadow in bloom!", "Every star placed.", "Done. Perfect."],
    evolved: ["Longer horn!", "Brighter sparkle.", "Grown. Still magic."],
    hatched: ["A unicorn! Sparkle.", "Rare and here. Hi!", "Horn first. Hello."],
  },
};

import type { SpeciesId } from "./species.ts";
import type { Cue } from "./voice.ts";

/** A Species covers at most this many Cues, so the Temperament stays the voice one hears most. A test enforces it. */
export const SIGNATURE_MAX_CUES = 3;

/**
 * The Signature of every Species: the phrases it owns for a few Cues. Where a
 * Species has a Signature for a Cue it speaks it, whatever the Temperament;
 * elsewhere the Temperament speaks, then the neutral phrases. Every Species
 * covers `hatched`: the hatch is where the Species shows, so it is the one to
 * speak. English, at most MAX_TEXT characters each; a test enforces both, and
 * that every Species of the table has an entry here.
 */
export const SIGNATURE: Partial<Record<SpeciesId, Partial<Record<Cue, readonly [string, ...string[]]>>>> = {
  cat: {
    woke: ["Mrrp. Five more minutes.", "Stretch. Yawn. Fine.", "Was napping. Rude."],
    todos_done: ["Purrfect.", "All boxed. Like me.", "Done. Nap time."],
    hatched: ["Mrow. Hello.", "A cat. Naturally.", "Feed me, human."],
  },
  owl: {
    woke: ["Hoot? Dawn already?", "I was not asleep.", "One eye was open."],
    long_work: ["I watched it all.", "Patience pays.", "Long night. Good one."],
    hatched: ["Hoot. So I am.", "Wise from day one.", "An owl. Of course."],
  },
  dragon: {
    streak: ["Sparks. Nothing more.", "Scales don't scratch.", "Is that all?"],
    evolved: ["Wings feel bigger.", "More fire in me.", "Bow, if you like."],
    hatched: ["A dragon. Behold.", "Rare. As I should be.", "Smoke? Just me."],
  },
};

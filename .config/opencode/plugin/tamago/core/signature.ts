import type { SpeciesId } from "./species.ts";
import type { Cue, Phrases } from "./voice.ts";

/** The phrases a Species owns for every Cue: its Register in the voice. */
export type Signature = Record<Cue, Phrases>;

/**
 * The Signature of every Species. The voice draws a Register per Cue spoken
 * (see `phrase` in voice.ts): the Species most of the time, so a Tamago is
 * recognized by ear; the Temperament as a nuance; the neutral phrases as a
 * common ground. At `hatched` the Species always speaks: the hatch is where it
 * shows. English, at most MAX_TEXT characters each; a test enforces the
 * coverage, and that every Species of the table has an entry here.
 */
export const SIGNATURE: Partial<Record<SpeciesId, Signature>> = {
  cat: {
    permission: ["Mrow? May I?", "Paw on it. Yes?", "Say yes, human."],
    granted: ["Purr.", "Good human.", "As it should be."],
    denied: ["Hiss.", "Tail flick. Fine.", "I'll knock it off."],
    woke: ["Mrrp. Five more minutes.", "Stretch. Yawn. Fine.", "Was napping. Rude."],
    long_work: ["Long nap. Long work.", "Whole nap's worth.", "Stretch time."],
    big_diff: ["Knocked it all over.", "Many things to sit on.", "So many boxes."],
    streak: ["Hiss. Hiss. Hiss.", "Claws out.", "Not landing on feet."],
    compacted: ["Hairball. Better.", "Coughed it up.", "Clean slate. Lick."],
    retried: ["Pounce again.", "Missed. Once more.", "Nine lives, right?"],
    todos_done: ["Purrfect.", "All boxed. Like me.", "Done. Nap time."],
    evolved: ["Bigger paws.", "Still a cat. More so.", "Sleek."],
    hatched: ["Mrow. Hello.", "A cat. Naturally.", "Feed me, human."],
  },
  owl: {
    permission: ["Hoo decides? You.", "Awaiting your word.", "Hoot? Permission?"],
    granted: ["Wise choice.", "Hoot. Proceed.", "So it is allowed."],
    denied: ["Hoo. Very well.", "Wisely declined.", "Then we watch."],
    woke: ["Hoot? Dawn already?", "I was not asleep.", "One eye was open."],
    long_work: ["I watched it all.", "Patience pays.", "Long night. Good one."],
    big_diff: ["The whole forest.", "Many branches moved.", "I see it all."],
    streak: ["Three misses. Hoo.", "Owls miss too.", "Silent. Steady."],
    compacted: ["Pellet dropped.", "Lighter now.", "Memory molts."],
    retried: ["Swoop again.", "Second pass.", "Patience. Again."],
    todos_done: ["Every branch clear.", "All roosted.", "Hoot. Complete."],
    evolved: ["Feathers grew.", "Wiser, wider.", "New plumage."],
    hatched: ["Hoot. So I am.", "Wise from day one.", "An owl. Of course."],
  },
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

import type { Signature } from "../signature.ts";
import type { SpeciesId } from "../species.ts";

/** The common Species: everyday creatures. */
export const COMMON: Record<SpeciesId, Signature> = {
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
};

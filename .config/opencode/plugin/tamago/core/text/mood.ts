import type { Activity } from "../moment/session.ts";
import type { Language, Phrase } from "../language.ts";
import { say } from "../language.ts";

/** The short phrase shown next to the sprite for an Activity, in both Languages. */
export const MOOD_TEXT: Record<Activity, Phrase> = {
  idle: { en: "chilling", fr: "tranquille" },
  thinking: { en: "thinking...", fr: "réfléchit..." },
  working: { en: "working", fr: "travaille" },
  waiting: { en: "needs you", fr: "t'attend" },
  hurt: { en: "ouch", fr: "aïe" },
  sleeping: { en: "zzz", fr: "zzz" },
};

export function mood(activity: Activity, language: Language): string {
  return say(MOOD_TEXT[activity], language);
}

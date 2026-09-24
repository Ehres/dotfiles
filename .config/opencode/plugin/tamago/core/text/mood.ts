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

export function mood(activity: Activity, language: Language = "en"): string {
  return say(MOOD_TEXT[activity], language);
}

/** English only, kept for the sidebar's direct index until it switches to mood(). */
export const MOOD: Record<Activity, string> = {
  idle: MOOD_TEXT.idle.en,
  thinking: MOOD_TEXT.thinking.en,
  working: MOOD_TEXT.working.en,
  waiting: MOOD_TEXT.waiting.en,
  hurt: MOOD_TEXT.hurt.en,
  sleeping: MOOD_TEXT.sleeping.en,
};

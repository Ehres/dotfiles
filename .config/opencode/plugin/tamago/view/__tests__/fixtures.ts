import { freshCareer, type Career } from "../../core/career/career.ts";
import type { Activity, Session } from "../../core/moment/session.ts";
import type { FooterInfo } from "../sidebar.tsx";

/** The owner's real career on 2026-09-15: an adult cat, 9,166 xp, "cheerful · bold shell". */
export const OWNER: Career = {
  sessions: 30,
  prompts: 492,
  tools: { read: 2342, edit: 83, bash: 1188, other: 1025 },
  filesEdited: 378,
  errors: 109,
  questions: 0,
  hatchedAt: 1789113932488,
  species: "cat",
  picks: {},
};

/** A fresh egg hatched at the epoch: species drawn from 0, always the same. */
export const EGG: Career = freshCareer(0);

export function session(activity: Activity): Session {
  return { activity, since: 0, busy: activity === "thinking" || activity === "working" };
}

export const FOOTER: FooterInfo = { parent: "~/projects", name: "dotfiles:master", version: "1.18.31" };

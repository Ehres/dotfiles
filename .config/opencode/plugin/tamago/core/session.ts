export type Activity = "idle" | "thinking" | "working" | "waiting" | "hurt" | "sleeping";

/** The Tamago's momentary condition for one OpenCode session. Forgotten when the window closes. */
export type Session = {
  activity: Activity;
  since: number;
  /** Whether the OpenCode session is busy, per its own status. */
  busy: boolean;
};

export const ACTIVITIES: readonly Activity[] = ["idle", "thinking", "working", "waiting", "hurt", "sleeping"];

export function initialSession(now: number): Session {
  return { activity: "idle", since: now, busy: false };
}

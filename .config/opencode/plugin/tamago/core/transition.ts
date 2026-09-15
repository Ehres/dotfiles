import { HURT_MS, SLEEP_MS, type TamagoEvent } from "./events.ts";
import type { Activity, Session } from "./state.ts";

function at(session: Session, activity: Activity, now: number): Session {
  return session.activity === activity ? session : { ...session, activity, since: now };
}

function busy(session: Session, value: boolean): Session {
  return session.busy === value ? session : { ...session, busy: value };
}

/** Moves one Session through an event. Pure: counting lives in count.ts. */
export function transition(start: Session, event: TamagoEvent, now: number): Session {
  const session = event.type !== "tick" && start.activity === "sleeping" ? at(start, "idle", now) : start;
  switch (event.type) {
    case "prompt_sent":
      return busy(at(session, "thinking", now), true);
    case "tool_started":
      return busy(at(session, "working", now), true);
    case "question_replied":
    case "permission_replied":
      return busy(at(session, "working", now), true);
    case "session_busy":
      return busy(session.activity === "idle" ? at(session, "thinking", now) : session, true);
    case "tool_failed":
    case "session_error":
      return at(session, "hurt", now);
    case "question_asked":
    case "permission_asked":
      return at(session, "waiting", now);
    case "session_idle":
      return busy(at(session, "idle", now), false);
    case "tool_finished":
    case "tool_cancelled":
    case "file_edited":
    case "session_started":
    case "session_gone":
    case "session_compacted":
    case "session_retried":
    case "todos_updated":
    case "diff_updated":
    case "evolved":
      return session;
    case "tick": {
      if (session.activity === "hurt" && now - session.since >= HURT_MS) {
        return at(session, session.busy ? "working" : "idle", now);
      }
      if (session.activity === "idle" && now - session.since >= SLEEP_MS) {
        return at(session, "sleeping", now);
      }
      return session;
    }
  }
}

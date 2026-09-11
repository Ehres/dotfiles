import { HURT_MS, SLEEP_MS, type TamagoEvent } from "./events.ts";
import { EMPTY_DELTA, type Activity, type Delta, type Session, type ToolKind } from "./state.ts";

export type Reduced = { session: Session; delta: Delta };

function at(session: Session, activity: Activity, now: number): Session {
  return session.activity === activity ? session : { ...session, activity, since: now };
}

function counted(patch: Partial<Omit<Delta, "tools">>, kind?: ToolKind): Delta {
  const tools = { ...EMPTY_DELTA.tools };
  if (kind) tools[kind] = 1;
  return { ...EMPTY_DELTA, ...patch, tools };
}

function release(session: Session): Session {
  return { ...session, runningTools: Math.max(0, session.runningTools - 1) };
}

export function reduce(session: Session, event: TamagoEvent, now: number): Reduced {
  switch (event.type) {
    case "prompt_sent":
      return { session: at(session, "thinking", now), delta: counted({ prompts: 1 }) };
    case "tool_started":
      return {
        session: at({ ...session, runningTools: session.runningTools + 1 }, "working", now),
        delta: EMPTY_DELTA,
      };
    case "tool_finished": {
      const released = release(session);
      return {
        session: released.activity === "sleeping" ? at(released, "working", now) : released,
        delta: counted({}, event.kind),
      };
    }
    case "tool_failed":
      return { session: at(release(session), "hurt", now), delta: counted({ errors: 1 }) };
    case "session_error":
      return { session: at(session, "hurt", now), delta: counted({ errors: 1 }) };
    case "permission_asked":
      return { session: at(session, "waiting", now), delta: EMPTY_DELTA };
    case "permission_replied":
      return { session: at(session, "working", now), delta: EMPTY_DELTA };
    case "file_edited":
      return {
        session: session.activity === "sleeping" ? at(session, "idle", now) : session,
        delta: counted({ filesEdited: 1 }),
      };
    case "session_idle":
      return { session: at({ ...session, runningTools: 0 }, "idle", now), delta: EMPTY_DELTA };
    case "session_started":
      return {
        session: session.activity === "sleeping" ? at(session, "idle", now) : session,
        delta: counted({ sessions: 1 }),
      };
    case "tick": {
      if (session.activity === "hurt" && now - session.since >= HURT_MS) {
        return { session: at(session, session.runningTools > 0 ? "working" : "idle", now), delta: EMPTY_DELTA };
      }
      if (session.activity === "idle" && now - session.since >= SLEEP_MS) {
        return { session: at(session, "sleeping", now), delta: EMPTY_DELTA };
      }
      return { session, delta: EMPTY_DELTA };
    }
  }
}

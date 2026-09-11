import type { Event } from "@opencode-ai/sdk/v2";
import type { Addressed, TamagoEvent, Target } from "../core/events.ts";
import type { ToolKind } from "../core/state.ts";

/** Every SDK event type the translator handles. index.tsx subscribes to exactly this list. */
export const SUBSCRIBED = [
  "message.part.updated",
  "message.updated",
  "file.edited",
  "permission.asked",
  "permission.replied",
  "session.status",
  "session.idle",
  "session.error",
  "session.created",
  "session.deleted",
] as const;

const KIND_BY_TOOL: Record<string, ToolKind> = {
  read: "read",
  glob: "read",
  grep: "read",
  list: "read",
  edit: "edit",
  write: "edit",
  patch: "edit",
  multiedit: "edit",
  bash: "bash",
};

export function toolKind(name: string): ToolKind {
  return KIND_BY_TOOL[name] ?? "other";
}

/** Bounded set: forget everything once it grows past this many ids. */
const MAX_REMEMBERED = 5_000;

function remember(set: Set<string>, id: string): void {
  if (set.size >= MAX_REMEMBERED) set.clear();
  set.add(id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Exact texts OpenCode 1.18 puts in ToolStateError.error when the user, not the tool, stopped the call. */
const USER_DECISION_EXACT = new Set(["Tool execution aborted", "Cancelled"]);
const USER_DECISION_PREFIX = ["The user rejected permission", "The user dismissed this question"];

/** True when an errored tool part reflects the user's own decision (abort, refusal, dismissed question). */
export function isUserDecision(state: Record<string, unknown>): boolean {
  const metadata = isRecord(state.metadata) ? state.metadata : undefined;
  if (metadata?.interrupted === true) return true;
  const error = str(state.error);
  if (error === undefined) return false;
  return USER_DECISION_EXACT.has(error) || USER_DECISION_PREFIX.some((prefix) => error.startsWith(prefix));
}

export type TranslatorOptions = {
  /** Tells whether a session id belongs to a child (subagent) session the translator never saw being created. */
  isChild?: (sessionID: string) => boolean;
};

const NONE: Target = { type: "none" };
const EVERY: Target = { type: "every" };

export function createTranslator(options: TranslatorOptions = {}): (event: Event) => Addressed[] {
  const running = new Set<string>();
  const done = new Set<string>();
  const prompts = new Set<string>();
  const children = new Set<string>();

  const isChild = (id: string): boolean => children.has(id) || (options.isChild?.(id) ?? false);

  /** Work events: move the root session they belong to, or only count when they come from a child. */
  const work = (sessionID: string | undefined, events: TamagoEvent[]): Addressed[] => {
    if (sessionID === undefined) return [];
    const target: Target = isChild(sessionID) ? NONE : { type: "session", id: sessionID };
    return events.map((event) => ({ target, event }));
  };

  /** Mood events: move the root session they belong to, dropped entirely for children. */
  const mood = (sessionID: string | undefined, event: TamagoEvent): Addressed[] => {
    if (sessionID === undefined || isChild(sessionID)) return [];
    return [{ target: { type: "session", id: sessionID }, event }];
  };

  return (event) => {
    const props: unknown = isRecord(event) ? event.properties : undefined;
    const sessionID = isRecord(props) ? str(props.sessionID) : undefined;
    switch (event.type) {
      case "message.part.updated": {
        const part = isRecord(props) ? props.part : undefined;
        if (!isRecord(part) || part.type !== "tool") return [];
        const callID = str(part.callID) ?? "";
        const tool = str(part.tool) ?? "";
        const state = isRecord(part.state) ? part.state : undefined;
        const status = state ? str(state.status) ?? "" : "";
        if (status === "running") {
          if (running.has(callID) || done.has(callID)) return [];
          remember(running, callID);
          return work(sessionID, [{ type: "tool_started" }]);
        }
        if (status === "completed" || status === "error") {
          if (done.has(callID)) return [];
          remember(done, callID);
          const started = running.delete(callID);
          const out: TamagoEvent[] = started ? [] : [{ type: "tool_started" }];
          if (status === "completed") out.push({ type: "tool_finished", kind: toolKind(tool) });
          else out.push(state && isUserDecision(state) ? { type: "tool_cancelled" } : { type: "tool_failed" });
          return work(sessionID, out);
        }
        return [];
      }
      case "message.updated": {
        const info = isRecord(props) ? props.info : undefined;
        if (!isRecord(info) || info.role !== "user" || typeof info.id !== "string") return [];
        if (prompts.has(info.id)) return [];
        remember(prompts, info.id);
        return mood(sessionID, { type: "prompt_sent" });
      }
      case "file.edited":
        return [{ target: NONE, event: { type: "file_edited" } }];
      case "permission.asked":
        return mood(sessionID, { type: "permission_asked" });
      case "permission.replied":
        return mood(sessionID, { type: "permission_replied" });
      case "session.status": {
        const status = isRecord(props) && isRecord(props.status) ? str(props.status.type) : undefined;
        if (status === "idle") return mood(sessionID, { type: "session_idle" });
        if (status === "busy" || status === "retry") return mood(sessionID, { type: "session_busy" });
        return [];
      }
      case "session.idle":
        return mood(sessionID, { type: "session_idle" });
      case "session.error": {
        const error = isRecord(props) ? props.error : undefined;
        if (isRecord(error) && error.name === "MessageAbortedError") return [];
        if (sessionID === undefined) return [{ target: EVERY, event: { type: "session_error" } }];
        return work(sessionID, [{ type: "session_error" }]);
      }
      case "session.created": {
        const info = isRecord(props) ? props.info : undefined;
        const id = isRecord(info) ? str(info.id) : undefined;
        if (id === undefined) return [];
        if (isRecord(info) && typeof info.parentID === "string") {
          remember(children, id);
          return [];
        }
        return [{ target: { type: "session", id }, event: { type: "session_started" } }];
      }
      case "session.deleted": {
        const info = isRecord(props) ? props.info : undefined;
        const id = isRecord(info) ? str(info.id) : undefined;
        if (id === undefined) return [];
        children.delete(id);
        return [{ target: { type: "session", id }, event: { type: "session_gone" } }];
      }
      default:
        return [];
    }
  };
}

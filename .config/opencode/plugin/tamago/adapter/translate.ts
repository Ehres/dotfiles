import type { Addressed, TamagoEvent, Target } from "../core/moment/events.ts";
import type { ToolKind } from "../core/career/career.ts";

/** An OpenCode 2 event as the translator reads it: a type and its payload, nothing assumed of the payload's shape. */
export type HostEvent = { readonly type: string; readonly data?: unknown };

/** Every OpenCode 2 event type the translator handles. tui.tsx subscribes to exactly this list. */
export const SUBSCRIBED = [
  "session.tool.input.started",
  "session.tool.called",
  "session.tool.success",
  "session.tool.failed",
  "session.inbox.enqueued",
  "permission.asked",
  "permission.replied",
  "form.created",
  "form.replied",
  "form.cancelled",
  "session.status",
  "session.idle",
  "session.execution.failed",
  "session.created",
  "session.deleted",
  "session.compaction.ended",
  "session.retry.scheduled",
  "session.step.ended",
  "vcs.branch.updated",
  "worktree.updated",
  "filesystem.changed",
] as const;

const KIND_BY_TOOL: Record<string, ToolKind> = {
  read: "read",
  glob: "read",
  grep: "read",
  list: "read",
  edit: "edit",
  write: "edit",
  patch: "edit",
  apply_patch: "edit",
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

/** Error types OpenCode 2 puts on a failed tool when the user, not the tool, stopped the call. */
const USER_DECISION_TYPES = new Set(["aborted", "rejected", "permission.rejected", "execution-denied", "interrupted", "tool.interrupted", "form.cancelled"]);
const USER_DECISION_PREFIX = ["The user rejected permission", "The user dismissed this question", "The user declined this tool call", "The user aborted"];

/** True when a failed tool's error reflects the user's own decision (abort, refusal, dismissed question). */
export function isUserDecision(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const type = str(error.type);
  if (type !== undefined && USER_DECISION_TYPES.has(type)) return true;
  const message = str(error.message);
  return message !== undefined && USER_DECISION_PREFIX.some((prefix) => message.startsWith(prefix));
}

/** The tool that keeps the session's todo list; its input carries the whole list each time. */
const TODO_TOOLS = new Set(["todowrite", "todo"]);

export type TranslatorOptions = {
  /** Tells whether a session id belongs to a child (subagent) session the translator never saw being created. */
  isChild?: (sessionID: string) => boolean;
};

const NONE: Target = { type: "none" };
const EVERY: Target = { type: "every" };

export function createTranslator(options: TranslatorOptions = {}): (event: HostEvent) => Addressed[] {
  const running = new Set<string>();
  const done = new Set<string>();
  const prompts = new Set<string>();
  const questions = new Set<string>();
  const children = new Set<string>();
  /** Tool call id to tool name: only `session.tool.input.started` names the tool, the later events carry the id alone. */
  const names = new Map<string, string>();
  /** Per root session, every file a step has changed: OpenCode 2 publishes no session diff, so it is summed here. */
  const touched = new Map<string, Set<string>>();
  /** The branch last seen: undefined until the first `vcs.branch.updated`, whose value is the branch we started on, not a move. */
  let branch: string | undefined;

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

  /** A finished call: started first when we never saw it start, then the outcome. Its name is forgotten. */
  const settle = (sessionID: string | undefined, callID: string, outcome: (tool: string) => TamagoEvent[]): Addressed[] => {
    if (done.has(callID)) return [];
    remember(done, callID);
    const started = running.delete(callID);
    const tool = names.get(callID) ?? "";
    names.delete(callID);
    return work(sessionID, [...(started ? [] : [{ type: "tool_started" } as const]), ...outcome(tool)]);
  };

  return (event) => {
    const data: unknown = isRecord(event) ? event.data : undefined;
    const sessionID = isRecord(data) ? str(data.sessionID) : undefined;
    switch (event.type) {
      case "session.tool.input.started": {
        const callID = isRecord(data) ? str(data.id) : undefined;
        const name = isRecord(data) ? str(data.name) : undefined;
        if (callID === undefined || name === undefined) return [];
        if (names.size >= MAX_REMEMBERED) names.clear();
        names.set(callID, name);
        return [];
      }
      case "session.tool.called": {
        const callID = isRecord(data) ? str(data.id) ?? "" : "";
        if (running.has(callID) || done.has(callID)) return [];
        remember(running, callID);
        const out = work(sessionID, [{ type: "tool_started" }]);
        const input = isRecord(data) && isRecord(data.input) ? data.input : undefined;
        const todos = input !== undefined && Array.isArray(input.todos) ? (input.todos as unknown[]) : undefined;
        if (todos === undefined || !TODO_TOOLS.has(names.get(callID) ?? "")) return out;
        let total = 0;
        let finished = 0;
        for (const todo of todos) {
          const status = isRecord(todo) ? str(todo.status) : undefined;
          if (status === "cancelled") continue;
          total += 1;
          if (status === "completed") finished += 1;
        }
        return [...out, ...mood(sessionID, { type: "todos_updated", total, done: finished })];
      }
      case "session.tool.success": {
        const callID = isRecord(data) ? str(data.id) ?? "" : "";
        const out = settle(sessionID, callID, (tool) => [{ type: "tool_finished", kind: toolKind(tool) }]);
        // OpenCode 2 has no per-file edit event: a successful editing tool is one file edited.
        const edited = out.some(({ event: one }) => one.type === "tool_finished" && one.kind === "edit");
        return edited ? [...out, { target: NONE, event: { type: "file_edited" } }] : out;
      }
      case "session.tool.failed": {
        const callID = isRecord(data) ? str(data.id) ?? "" : "";
        const error = isRecord(data) ? data.error : undefined;
        return settle(sessionID, callID, () => [isUserDecision(error) ? { type: "tool_cancelled" } : { type: "tool_failed" }]);
      }
      case "session.inbox.enqueued": {
        const item = isRecord(data) ? data.item : undefined;
        const inboxID = isRecord(data) ? str(data.inboxID) : undefined;
        if (!isRecord(item) || item.type !== "user" || inboxID === undefined) return [];
        if (prompts.has(inboxID)) return [];
        remember(prompts, inboxID);
        return mood(sessionID, { type: "prompt_sent" });
      }
      case "permission.asked":
        return mood(sessionID, { type: "permission_asked" });
      case "permission.replied": {
        const reply = isRecord(data) ? str(data.reply) : undefined;
        const granted = reply === "once" || reply === "always";
        return mood(sessionID, { type: "permission_replied", granted });
      }
      case "form.created": {
        const form = isRecord(data) ? data.form : undefined;
        const id = isRecord(form) ? str(form.id) : undefined;
        if (id === undefined || questions.has(id)) return [];
        remember(questions, id);
        return work(isRecord(form) ? str(form.sessionID) : undefined, [{ type: "question_asked" }]);
      }
      case "form.replied":
      case "form.cancelled":
        return mood(sessionID, { type: "question_replied" });
      case "session.status": {
        const status = isRecord(data) && isRecord(data.status) ? str(data.status.type) : undefined;
        if (status === "idle") return mood(sessionID, { type: "session_idle" });
        if (status === "busy" || status === "retry") return mood(sessionID, { type: "session_busy" });
        return [];
      }
      case "session.idle":
        return mood(sessionID, { type: "session_idle" });
      case "session.execution.failed":
        // An interrupt by the user is its own event (`session.execution.interrupted`), never this one.
        return work(sessionID, [{ type: "session_error" }]);
      case "session.created": {
        if (sessionID === undefined) return [];
        if (isRecord(data) && typeof data.parentID === "string") {
          remember(children, sessionID);
          return [];
        }
        return [{ target: { type: "session", id: sessionID }, event: { type: "session_started" } }];
      }
      case "session.deleted": {
        if (sessionID === undefined) return [];
        children.delete(sessionID);
        touched.delete(sessionID);
        return [{ target: { type: "session", id: sessionID }, event: { type: "session_gone" } }];
      }
      case "session.compaction.ended":
        return mood(sessionID, { type: "session_compacted" });
      case "session.retry.scheduled":
        return mood(sessionID, { type: "session_retried" });
      case "session.step.ended": {
        const files = isRecord(data) && Array.isArray(data.files) ? data.files : undefined;
        if (sessionID === undefined || files === undefined || files.length === 0 || isChild(sessionID)) return [];
        if (!touched.has(sessionID) && touched.size >= MAX_REMEMBERED) touched.clear();
        const seen = touched.get(sessionID) ?? new Set<string>();
        touched.set(sessionID, seen);
        for (const file of files) if (typeof file === "string") seen.add(file);
        return mood(sessionID, { type: "diff_updated", files: seen.size });
      }
      case "vcs.branch.updated": {
        const current = isRecord(data) ? str(data.branch) : undefined;
        if (current === undefined || current === branch) return [];
        const first = branch === undefined; // the value seen at startup is the branch we are on, not a move
        branch = current;
        return first ? [] : [{ target: EVERY, event: { type: "branch_changed" } }];
      }
      case "worktree.updated":
        return [{ target: EVERY, event: { type: "worktree_ready" } }];
      case "filesystem.changed":
        return [{ target: EVERY, event: { type: "files_stirred" } }];
      default:
        return [];
    }
  };
}

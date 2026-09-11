import type { Event } from "@opencode-ai/sdk/v2";
import type { TamagoEvent } from "../core/events.ts";
import type { ToolKind } from "../core/state.ts";

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

export function createTranslator(): (event: Event) => TamagoEvent[] {
  const running = new Set<string>();
  const done = new Set<string>();
  const prompts = new Set<string>();

  return (event) => {
    const props: unknown = isRecord(event) ? event.properties : undefined;
    switch (event.type) {
      case "message.part.updated": {
        const part = isRecord(props) ? props.part : undefined;
        if (!isRecord(part) || part.type !== "tool") return [];
        const callID = typeof part.callID === "string" ? part.callID : "";
        const tool = typeof part.tool === "string" ? part.tool : "";
        const state = isRecord(part.state) ? part.state : undefined;
        const status = state && typeof state.status === "string" ? state.status : "";
        if (status === "running") {
          if (running.has(callID) || done.has(callID)) return [];
          remember(running, callID);
          return [{ type: "tool_started" }];
        }
        if (status === "completed" || status === "error") {
          if (done.has(callID)) return [];
          remember(done, callID);
          const started = running.delete(callID);
          const out: TamagoEvent[] = started ? [] : [{ type: "tool_started" }];
          out.push(status === "completed" ? { type: "tool_finished", kind: toolKind(tool) } : { type: "tool_failed" });
          return out;
        }
        return [];
      }
      case "message.updated": {
        const info = isRecord(props) ? props.info : undefined;
        if (!isRecord(info) || info.role !== "user" || typeof info.id !== "string") return [];
        if (prompts.has(info.id)) return [];
        remember(prompts, info.id);
        return [{ type: "prompt_sent" }];
      }
      case "file.edited":
        return [{ type: "file_edited" }];
      case "permission.asked":
        return [{ type: "permission_asked" }];
      case "permission.replied":
        return [{ type: "permission_replied" }];
      case "session.idle":
        return [{ type: "session_idle" }];
      case "session.error": {
        const error = isRecord(props) ? props.error : undefined;
        if (isRecord(error) && error.name === "MessageAbortedError") return [];
        return [{ type: "session_error" }];
      }
      case "session.created": {
        const info = isRecord(props) ? props.info : undefined;
        if (isRecord(info) && typeof info.parentID === "string") return [];
        return [{ type: "session_started" }];
      }
      default:
        return [];
    }
  };
}

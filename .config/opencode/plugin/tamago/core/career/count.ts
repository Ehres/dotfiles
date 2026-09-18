import type { TamagoEvent } from "../moment/events.ts";
import { EMPTY_DELTA, type Delta } from "./career.ts";

/** What an event adds to the Career. Independent of any Session. */
export function count(event: TamagoEvent): Delta {
  const delta: Delta = { ...EMPTY_DELTA, tools: { ...EMPTY_DELTA.tools } };
  switch (event.type) {
    case "prompt_sent":
      delta.prompts = 1;
      break;
    case "session_started":
      delta.sessions = 1;
      break;
    case "file_edited":
      delta.filesEdited = 1;
      break;
    case "tool_failed":
    case "session_error":
      delta.errors = 1;
      break;
    case "tool_finished":
      delta.tools[event.kind] = 1;
      break;
    case "question_asked":
      delta.questions = 1;
      break;
    default:
      break;
  }
  return delta;
}

import { NotifierPlugin } from "@mohak34/opencode-notifier";
import type { Plugin, PluginModule } from "@opencode-ai/plugin";

type RecordValue = Record<string, unknown>;
const DELETED_SESSION_GRACE_MS = 1_000;

function asRecord(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" ? (value as RecordValue) : null;
}

function nestedRecord(value: unknown, ...path: string[]): RecordValue | null {
  let current = value;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return null;
    current = record[key];
  }
  return asRecord(current);
}

function stringField(record: RecordValue | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function createNotificationPlugin(upstream: Plugin = NotifierPlugin): Plugin {
  return async (input, options) => {
    const hooks = await upstream(input, options);
    const childSessionIDs = new Set<string>();
    const topLevelSessionIDs = new Set<string>();
    const upstreamEvent = hooks.event;
    let eventQueue = Promise.resolve();

    const processEvent: NonNullable<typeof hooks.event> = async ({ event }) => {
      if (event.type === "session.created" || event.type === "session.updated") {
        const info = nestedRecord(event, "properties", "info");
        const id = stringField(info, "id");
        if (id) {
          if (stringField(info, "parentID")) {
            childSessionIDs.add(id);
            topLevelSessionIDs.delete(id);
          } else {
            topLevelSessionIDs.add(id);
            childSessionIDs.delete(id);
          }
        }
      }

      if (event.type === "session.idle") {
        const properties = nestedRecord(event, "properties");
        const sessionID = stringField(properties, "sessionID");
        if (sessionID) {
          if (childSessionIDs.delete(sessionID)) return;
          if (topLevelSessionIDs.has(sessionID)) {
            await upstreamEvent?.({ event });
            return;
          }

          try {
            const response = await input.client.session.get({ path: { id: sessionID } });
            if (!response.data) return;
            if (response.data.parentID) {
              return;
            }
            topLevelSessionIDs.add(sessionID);
          } catch {
            return;
          }
        }
      }

      await upstreamEvent?.({ event });

      if (event.type === "session.deleted") {
        const info = nestedRecord(event, "properties", "info");
        const id = stringField(info, "id");
        if (id && childSessionIDs.has(id)) {
          const timer = setTimeout(() => childSessionIDs.delete(id), DELETED_SESSION_GRACE_MS);
          (timer as { unref?: () => void }).unref?.();
        }
        if (id) topLevelSessionIDs.delete(id);
      }
    };

    return {
      ...hooks,
      event: (event) => {
        const result = eventQueue.then(() => processEvent(event));
        eventQueue = result.catch(() => undefined);
        return result;
      },
    };
  };
}

const plugin: PluginModule = {
  id: "filtered-opencode-notifier",
  server: createNotificationPlugin(),
};

export default plugin;

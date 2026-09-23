import assert from "node:assert/strict";
import test from "node:test";

import notificationModule, { createNotificationPlugin } from "../plugin/notification.ts";

type TestEvent = {
  type: string;
  properties: Record<string, unknown>;
};

const childCreated: TestEvent = {
  type: "session.created",
  properties: { info: { id: "child", parentID: "root" } },
};
const childDeleted: TestEvent = {
  type: "session.deleted",
  properties: { info: { id: "child", parentID: "root" } },
};
const childIdle: TestEvent = {
  type: "session.idle",
  properties: { sessionID: "child" },
};

async function createHarness(getSession: () => Promise<unknown> = async () => {
  throw new Error("unexpected session lookup");
}) {
  const forwarded: string[] = [];
  const upstream = async () => ({
    event: async ({ event }: { event: TestEvent }) => {
      forwarded.push(event.type);
    },
  });
  const plugin = createNotificationPlugin(upstream as never);
  const hooks = await plugin({ client: { session: { get: getSession } } } as never);

  return {
    forwarded,
    dispatch: async (event: TestEvent) => hooks.event?.({ event } as never),
  };
}

test("does not forward a child session idle event", async () => {
  const { dispatch, forwarded } = await createHarness();

  await dispatch(childCreated);
  await dispatch(childIdle);
  await dispatch(childDeleted);

  assert.deepEqual(forwarded, ["session.created", "session.deleted"]);
});

test("does not forward a child idle event received after deletion", async () => {
  const { dispatch, forwarded } = await createHarness();

  await dispatch(childCreated);
  await dispatch(childDeleted);
  await dispatch(childIdle);

  assert.deepEqual(forwarded, ["session.created", "session.deleted"]);
});

test("does not forward an untracked child session idle event", async () => {
  const { dispatch, forwarded } = await createHarness(async () => ({ data: { id: "child", parentID: "root" } }));

  await dispatch(childIdle);

  assert.deepEqual(forwarded, []);
});

test("does not forward an idle event when its session cannot be resolved", async () => {
  const { dispatch, forwarded } = await createHarness(async () => {
    throw new Error("session was deleted");
  });

  await dispatch({ type: "session.idle", properties: { sessionID: "deleted-child" } });

  assert.deepEqual(forwarded, []);
});

test("does not forward an idle event when the session lookup is empty", async () => {
  const { dispatch, forwarded } = await createHarness(async () => ({ data: undefined }));

  await dispatch({ type: "session.idle", properties: { sessionID: "deleted-child" } });

  assert.deepEqual(forwarded, []);
});

test("forwards a top-level session idle event", async () => {
  const { dispatch, forwarded } = await createHarness(async () => ({ data: { id: "root" } }));

  await dispatch({ type: "session.idle", properties: { sessionID: "root" } });

  assert.deepEqual(forwarded, ["session.idle"]);
});

test("forwards a known top-level idle event without a session lookup", async () => {
  const { dispatch, forwarded } = await createHarness();

  await dispatch({ type: "session.created", properties: { info: { id: "root" } } });
  await dispatch({ type: "session.idle", properties: { sessionID: "root" } });

  assert.deepEqual(forwarded, ["session.created", "session.idle"]);
});

test("preserves event order while resolving an idle session", async () => {
  let resolveSession: (value: unknown) => void = () => undefined;
  const session = new Promise((resolve) => {
    resolveSession = resolve;
  });
  const { dispatch, forwarded } = await createHarness(async () => session);

  const idle = dispatch({ type: "session.idle", properties: { sessionID: "root" } });
  const busy = dispatch({
    type: "session.status",
    properties: { sessionID: "root", status: { type: "busy" } },
  });
  resolveSession({ data: { id: "root" } });
  await Promise.all([idle, busy]);

  assert.deepEqual(forwarded, ["session.idle", "session.status"]);
});

test("preserves upstream hooks and plugin options", async () => {
  const permission = async () => undefined;
  const options = { source: "test" };
  let receivedOptions: unknown;
  const upstream = async (_input: unknown, upstreamOptions: unknown) => {
    receivedOptions = upstreamOptions;
    return { "permission.ask": permission };
  };
  const plugin = createNotificationPlugin(upstream as never);

  const hooks = await plugin({} as never, options);

  assert.equal(hooks["permission.ask"], permission);
  assert.equal(receivedOptions, options);
});

test("exports an OpenCode server plugin module", () => {
  assert.equal(notificationModule.id, "filtered-opencode-notifier");
  assert.equal(typeof notificationModule.server, "function");
});

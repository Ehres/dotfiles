/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import type { Event } from "@opencode-ai/sdk/v2";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSignal } from "solid-js";
import { logError } from "./adapter/log.ts";
import { createStore } from "./adapter/store.ts";
import { createTranslator } from "./adapter/translate.ts";
import type { TamagoEvent } from "./core/events.ts";
import { merge } from "./core/merge.ts";
import { reduce } from "./core/reduce.ts";
import { stage, stageIndex, type StageId } from "./core/stage.ts";
import { EMPTY_DELTA, addDelta, initialSession, isEmpty, type Career, type Delta, type Session } from "./core/state.ts";
import { HomeView } from "./view/home.tsx";
import { SidebarView, type FooterInfo } from "./view/sidebar.tsx";

const id = "opencode-tamago";
const DATA_DIR = join(homedir(), ".local", "share", "opencode-tamago");
const TICK_MS = 500;
const FLUSH_MS = 2_000;
/** Slow animations advance once every this many ticks (2 s). */
const SLOW_FRAME_TICKS = 4;
/** Below the built-in footer's order (100) so we win the single_winner slot. */
const FOOTER_ORDER = 50;

const SUBSCRIBED = [
  "message.part.updated",
  "message.updated",
  "file.edited",
  "permission.asked",
  "permission.replied",
  "session.idle",
  "session.error",
  "session.created",
] as const;

const tui: TuiPlugin = async (api, options) => {
  const name = typeof options?.name === "string" && options.name.trim() ? options.name.trim() : "Tamago";
  const store = createStore(DATA_DIR);
  const translate = createTranslator();

  const loaded = store.load();
  const [career, setCareer] = createSignal<Career>(loaded.career);
  const [session, setSession] = createSignal<Session>(initialSession(Date.now()));
  const [ticks, setTicks] = createSignal(0);
  let pending: Delta = EMPTY_DELTA;
  let known: StageId = stage(loaded.career);

  if (loaded.corrupt) {
    api.ui.toast({ variant: "warning", title: name, message: "Saved progress was unreadable. Starting from a fresh egg." });
  }

  const guard =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      try {
        fn(...args);
      } catch (err) {
        logError(DATA_DIR, err);
      }
    };

  const announce = (next: Career) => {
    const current = stage(next);
    if (stageIndex(current) > stageIndex(known)) {
      api.ui.toast({ variant: "success", title: name, message: `${name} evolved: ${current}!` });
    }
    known = current;
  };

  const show = (next: Career) => {
    setCareer(next);
    announce(next);
  };

  const apply = (event: TamagoEvent) => {
    const out = reduce(session(), event, Date.now());
    setSession(out.session);
    if (isEmpty(out.delta)) return;
    pending = addDelta(pending, out.delta);
    show(merge(career(), out.delta));
  };

  const onEvent = guard((event: Event) => {
    for (const internal of translate(event)) apply(internal);
  });
  for (const type of SUBSCRIBED) api.lifecycle.onDispose(api.event.on(type, onEvent));

  const tick = setInterval(
    guard(() => {
      apply({ type: "tick" });
      setTicks((t) => t + 1);
    }),
    TICK_MS,
  );

  const flush = guard(() => {
    if (isEmpty(pending)) {
      // Nothing of ours to write, but other instances may have progressed.
      const fresh = store.load();
      if (!fresh.corrupt) show(fresh.career);
      return;
    }
    const merged = store.flush(pending);
    if (!merged) return; // lock held elsewhere: keep the delta, retry next time
    pending = EMPTY_DELTA;
    show(merged);
  });
  const flusher = setInterval(flush, FLUSH_MS);

  api.lifecycle.onDispose(() => {
    clearInterval(tick);
    clearInterval(flusher);
    if (!isEmpty(pending) && store.flush(pending)) pending = EMPTY_DELTA;
  });

  const frame = () => {
    const activity = session().activity;
    if (activity === "working" || activity === "thinking") return ticks();
    if (activity === "sleeping") return 0;
    return Math.floor(ticks() / SLOW_FRAME_TICKS);
  };

  const footer = (sessionID: string) => (): FooterInfo => {
    const info = api.state.session.get(sessionID);
    const dir = info?.directory || api.state.path.directory;
    const home = homedir();
    const short = dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir;
    const branch = info?.directory === api.state.path.directory ? api.state.vcs?.branch : undefined;
    const parts = (branch ? `${short}:${branch}` : short).split("/");
    return { parent: parts.slice(0, -1).join("/"), name: parts.at(-1) ?? "", version: api.app.version };
  };

  api.slots.register({
    order: FOOTER_ORDER,
    slots: {
      sidebar_footer(ctx, props) {
        return (
          <SidebarView
            name={name}
            theme={() => ctx.theme.current}
            session={session}
            career={career}
            frame={frame}
            footer={footer(props.session_id)}
          />
        );
      },
    },
  });

  api.slots.register({
    slots: {
      home_logo(ctx) {
        return <HomeView name={name} theme={() => ctx.theme.current} career={career} frame={frame} />;
      },
    },
  });
};

const plugin: TuiPluginModule & { id: string } = { id, tui };

export default plugin;

/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import type { Event } from "@opencode-ai/sdk/v2";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSignal } from "solid-js";
import { logError } from "./adapter/log.ts";
import { createStore, type Loaded } from "./adapter/store.ts";
import { SUBSCRIBED, createTranslator } from "./adapter/translate.ts";
import { count } from "./core/count.ts";
import type { Addressed, TamagoEvent } from "./core/events.ts";
import { merge } from "./core/merge.ts";
import { stage, stageIndex, type StageId } from "./core/stage.ts";
import { transition } from "./core/transition.ts";
import {
  EMPTY_DELTA,
  addDelta,
  freshCareer,
  initialSession,
  isEmpty,
  type Career,
  type Delta,
  type Session,
} from "./core/state.ts";
import { HomeView } from "./view/home.tsx";
import { SidebarView, type FooterInfo } from "./view/sidebar.tsx";

const id = "opencode-tamago";
const DATA_DIR = join(homedir(), ".local", "share", "opencode-tamago");
const TICK_MS = 500;
const FLUSH_MS = 2_000;
/** Below the built-in footer's order (100) so we win the single_winner slot. */
const FOOTER_ORDER = 50;
/** home_bottom is additive: below 100 renders above the built-in tips, keeping the OpenCode logo intact. */
const HOME_BOTTOM_ORDER = 50;

const tui: TuiPlugin = async (api, options) => {
  const name = typeof options?.name === "string" && options.name.trim() ? options.name.trim() : "Tamago";
  const store = createStore(DATA_DIR);
  const translate = createTranslator({ isChild: (id) => typeof api.state.session.get(id)?.parentID === "string" });

  let loaded: Loaded;
  try {
    loaded = store.load();
  } catch (err) {
    logError(DATA_DIR, err);
    loaded = { career: freshCareer(Date.now()), corrupt: true };
  }

  try {
    const [career, setCareer] = createSignal<Career>(loaded.career);
    /** One mood per root OpenCode session, keyed by session id. Never persisted. */
    const [sessions, setSessions] = createSignal<Record<string, Session>>({});
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
        known = current;
      }
    };

    const show = (next: Career) => {
      setCareer(next);
      announce(next);
    };

    const move = (ids: readonly string[], event: TamagoEvent, now: number) => {
      if (ids.length === 0) return;
      setSessions((all) => {
        const next = { ...all };
        for (const id of ids) next[id] = transition(all[id] ?? initialSession(now), event, now);
        return next;
      });
    };

    const apply = ({ target, event }: Addressed) => {
      const now = Date.now();
      if (event.type === "session_gone") {
        if (target.type === "session") setSessions(({ [target.id]: _gone, ...rest }) => rest);
      } else if (target.type === "session") {
        move([target.id], event, now);
      } else if (target.type === "every") {
        move(Object.keys(sessions()), event, now);
      }
      const delta = count(event);
      if (isEmpty(delta)) return;
      pending = addDelta(pending, delta);
      show(merge(career(), delta));
    };

    const onEvent = guard((event: Event) => {
      for (const addressed of translate(event)) apply(addressed);
    });
    for (const type of SUBSCRIBED) api.lifecycle.onDispose(api.event.on(type, onEvent));

    const tick = setInterval(
      guard(() => {
        move(Object.keys(sessions()), { type: "tick" }, Date.now());
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

    api.lifecycle.onDispose(
      guard(() => {
        clearInterval(tick);
        clearInterval(flusher);
        if (!isEmpty(pending) && store.flush(pending)) pending = EMPTY_DELTA;
      }),
    );

    const sessionOf = (id: string) => () => sessions()[id] ?? initialSession(0);

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
              session={sessionOf(props.session_id)}
              career={career}
              ticks={ticks}
              footer={footer(props.session_id)}
            />
          );
        },
      },
    });

    api.slots.register({
      order: HOME_BOTTOM_ORDER,
      slots: {
        home_bottom(ctx) {
          return <HomeView name={name} theme={() => ctx.theme.current} career={career} ticks={ticks} />;
        },
      },
    });
  } catch (err) {
    logError(DATA_DIR, err);
    return;
  }
};

const plugin: TuiPluginModule & { id: string } = { id, tui };

export default plugin;

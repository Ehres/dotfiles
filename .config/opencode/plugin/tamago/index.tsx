/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import type { Event } from "@opencode-ai/sdk/v2";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSignal } from "solid-js";
import { createErrorLog } from "./adapter/log.ts";
import { createStore, type Loaded } from "./adapter/store.ts";
import { SUBSCRIBED, createTranslator } from "./adapter/translate.ts";
import { count } from "./core/count.ts";
import type { Addressed, TamagoEvent } from "./core/events.ts";
import { footerPath } from "./core/footer.ts";
import { merge } from "./core/merge.ts";
import { WARN_AFTER, backoff } from "./core/retry.ts";
import { evolution } from "./core/stage.ts";
import { transition } from "./core/transition.ts";
import {
  EMPTY_DELTA,
  addDelta,
  freshCareer,
  initialSession,
  isEmpty,
  sameCareer,
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
/** Longest pause between two flush attempts while the disk keeps failing. */
const FLUSH_MAX_MS = 60_000;
/** Below the built-in footer's order (100) so we win the single_winner slot. */
const FOOTER_ORDER = 50;
/** home_bottom is additive: below 100 renders above the built-in tips, keeping the OpenCode logo intact. */
const HOME_BOTTOM_ORDER = 50;

const tui: TuiPlugin = async (api, options) => {
  const name = typeof options?.name === "string" && options.name.trim() ? options.name.trim() : "Tamago";
  const store = createStore(DATA_DIR);
  const logError = createErrorLog(DATA_DIR);
  const translate = createTranslator({ isChild: (id) => typeof api.state.session.get(id)?.parentID === "string" });

  let loaded: Loaded;
  try {
    loaded = store.load();
  } catch (err) {
    logError(err);
    loaded = { career: freshCareer(Date.now()), corrupt: false };
  }

  try {
    const [career, setCareer] = createSignal<Career>(loaded.career, { equals: sameCareer });
    /** One mood per root OpenCode session, keyed by session id. Never persisted. */
    const [sessions, setSessions] = createSignal<Record<string, Session>>({});
    const [ticks, setTicks] = createSignal(0);
    let pending: Delta = EMPTY_DELTA;

    let warnedCorrupt = false;
    const warnCorrupt = () => {
      if (warnedCorrupt) return;
      warnedCorrupt = true;
      api.ui.toast({
        variant: "warning",
        title: name,
        message: "Saved progress was unreadable. It is kept aside as career.json.corrupt-*; starting from a fresh egg.",
      });
    };
    if (loaded.corrupt) warnCorrupt();

    const guard =
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        try {
          fn(...args);
        } catch (err) {
          logError(err);
        }
      };

    const show = (next: Career) => {
      const reached = evolution(career(), next);
      setCareer(next);
      if (reached) api.ui.toast({ variant: "success", title: name, message: `${name} evolved: ${reached}!` });
    };

    const move = (ids: readonly string[], event: TamagoEvent, now: number) => {
      if (ids.length === 0) return;
      setSessions((all) => {
        let changed = false;
        const next = { ...all };
        for (const id of ids) {
          const before = all[id] ?? initialSession(now);
          const after = transition(before, event, now);
          next[id] = after;
          if (after !== before) changed = true;
        }
        return changed ? next : all; // same object: nobody re-renders on a quiet tick
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

    /** Returns true when this window's delta reached the disk. Throws on disk errors. */
    const persist = (): boolean => {
      if (isEmpty(pending)) {
        // Nothing of ours to write, but other instances may have progressed.
        const fresh = store.load();
        if (fresh.corrupt) warnCorrupt();
        else show(fresh.career);
        return true;
      }
      const result = store.flush(pending);
      if (result.outcome === "busy") return false; // lock held elsewhere: keep the delta, retry next time
      if (result.outcome === "corrupt") {
        warnCorrupt();
        return false; // the file was set aside; the next flush writes over a fresh egg
      }
      pending = EMPTY_DELTA;
      show(result.career);
      return true;
    };

    /** Consecutive disk failures. Drives the backoff and the single "cannot save" toast. */
    let failures = 0;
    let flusher: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      flusher = setTimeout(flush, backoff(failures, FLUSH_MS, FLUSH_MAX_MS));
    };
    const flush = () => {
      try {
        persist();
        failures = 0;
      } catch (err) {
        logError(err);
        failures += 1;
        if (failures === WARN_AFTER) {
          api.ui.toast({ variant: "error", title: name, message: `${name} cannot save its progress. See ${DATA_DIR}/error.log.` });
        }
      }
      schedule();
    };
    schedule();

    api.lifecycle.onDispose(
      guard(() => {
        clearInterval(tick);
        if (flusher !== undefined) clearTimeout(flusher);
        if (!isEmpty(pending) && store.flush(pending).outcome === "written") pending = EMPTY_DELTA;
      }),
    );

    const sessionOf = (id: string) => () => sessions()[id] ?? initialSession(0);

    const footer = (sessionID: string) => (): FooterInfo => {
      const info = api.state.session.get(sessionID);
      const dir = info?.directory || api.state.path.directory;
      const branch = info?.directory === api.state.path.directory ? api.state.vcs?.branch : undefined;
      return { ...footerPath(dir, homedir(), branch), version: api.app.version };
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
    logError(err);
    return;
  }
};

const plugin: TuiPluginModule & { id: string } = { id, tui };

export default plugin;

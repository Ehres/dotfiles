/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import type { Event } from "@opencode-ai/sdk/v2";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSignal } from "solid-js";
import { createErrorLog } from "./adapter/log.ts";
import { tickInterval } from "./core/cadence.ts";
import { character } from "./core/character.ts";
import { createStore, type Loaded } from "./adapter/store.ts";
import { SUBSCRIBED, createTranslator } from "./adapter/translate.ts";
import { count } from "./core/count.ts";
import type { Addressed, TamagoEvent } from "./core/events.ts";
import { footerPath } from "./core/footer.ts";
import { merge } from "./core/merge.ts";
import { cleanName } from "./core/name.ts";
import { WARN_AFTER, backoff } from "./core/retry.ts";
import { evolution } from "./core/stage.ts";
import { PET_MS } from "./core/sprites.ts";
import { transition } from "./core/transition.ts";
import { initialVoice, speak, type Voice } from "./core/voice.ts";
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
import { CardView } from "./view/card.tsx";
import { HomeView } from "./view/home.tsx";
import { SidebarView, type FooterInfo } from "./view/sidebar.tsx";

const id = "opencode-tamago";
const DATA_DIR = join(homedir(), ".local", "share", "opencode-tamago");
const FLUSH_MS = 2_000;
/** Longest pause between two flush attempts while the disk keeps failing. */
const FLUSH_MAX_MS = 60_000;
/** Below the built-in footer's order (100) so we win the single_winner slot. */
const FOOTER_ORDER = 50;
/** home_bottom is additive: below 100 renders above the built-in tips, keeping the OpenCode logo intact. */
const HOME_BOTTOM_ORDER = 50;

const tui: TuiPlugin = async (api, options) => {
  /** The plugin option: the Name until the user renames the creature. */
  const defaultName = typeof options?.name === "string" && options.name.trim() ? options.name.trim() : "Tamago";
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
    /** The Name lives in the Career, so a rename in one window reaches the others on flush. */
    const name = (): string => career().name?.value ?? defaultName;
    /** Computed from the Career like the Stage: never stored, identical in every window. */
    const persona = () => character(career());
    /** One mood per root OpenCode session, keyed by session id. Never persisted. */
    const [sessions, setSessions] = createSignal<Record<string, Session>>({});
    /** One Voice per root OpenCode session, keyed like `sessions`. Never persisted. */
    const [voices, setVoices] = createSignal<Record<string, Voice>>({});
    /** True while the sprite wears the heart after a pet. Per window, like the sprite itself. */
    const [heart, setHeart] = createSignal(false);
    /** Persisted through api.kv; when muted no Cue is heard and every Bubble is cleared. */
    const [muted, setMuted] = createSignal(api.kv.get<boolean>("tamago.muted", false) === true);
    /** Milliseconds since the plugin started; drives animation frames. */
    const started = Date.now();
    const [clock, setClock] = createSignal(0);
    let pending: Delta = EMPTY_DELTA;

    let warnedCorrupt = false;
    const warnCorrupt = () => {
      if (warnedCorrupt) return;
      warnedCorrupt = true;
      api.ui.toast({
        variant: "warning",
        title: name(),
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
      const renamed = next.name?.value !== career().name?.value;
      setCareer(next);
      if (renamed) registerCommands(); // palette titles carry the Name and are fixed at registration
      if (!reached) return;
      api.ui.toast({ variant: "success", title: name(), message: `${name()} evolved: ${reached}!` });
      move(Object.keys(sessions()), { type: "evolved" }, Date.now());
    };

    const move = (ids: readonly string[], event: TamagoEvent, now: number) => {
      if (ids.length === 0) return;
      const before = sessions();
      const after: Record<string, Session> = { ...before };
      let changed = false;
      for (const id of ids) {
        const was = before[id] ?? initialSession(now);
        const is = transition(was, event, now);
        after[id] = is;
        if (is !== was) changed = true;
      }
      if (changed) setSessions(after); // untouched otherwise: nobody re-renders on a quiet tick
      if (muted()) return;
      setVoices((all) => {
        let spoke = false;
        const next = { ...all };
        for (const id of ids) {
          const voice = all[id] ?? initialVoice();
          const heard = speak(voice, event, before[id] ?? initialSession(now), after[id] ?? initialSession(now), now, persona().temperament);
          next[id] = heard;
          if (heard !== voice) spoke = true;
        }
        return spoke ? next : all;
      });
    };

    const apply = ({ target, event }: Addressed) => {
      const now = Date.now();
      if (event.type === "session_gone") {
        if (target.type === "session") {
          setSessions(({ [target.id]: _gone, ...rest }) => rest);
          setVoices(({ [target.id]: _silent, ...rest }) => rest);
        }
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

    /** Fast while a session shows effort, slow otherwise: same frames, four times fewer wake-ups when calm. */
    let ticker: ReturnType<typeof setTimeout> | undefined;
    const scheduleTick = () => {
      const activities = Object.values(sessions()).map((session) => session.activity);
      ticker = setTimeout(tick, tickInterval(activities));
    };
    const tick = guard(() => {
      const now = Date.now();
      move(Object.keys(sessions()), { type: "tick" }, now);
      setClock(now - started);
      scheduleTick();
    });
    scheduleTick();

    const setMute = (value: boolean) => {
      setMuted(value);
      api.kv.set("tamago.muted", value);
      if (!value) return;
      setVoices((all) => {
        const next: Record<string, Voice> = {};
        for (const [id, voice] of Object.entries(all)) next[id] = voice.bubble === undefined ? voice : { ...voice, bubble: undefined };
        return next;
      });
    };

    /** The dialog stack wraps the card in OpenCode's own centered Dialog; nothing to position here. */
    const showCard = () => {
      api.ui.dialog.replace(() => (
        <CardView
          name={name()}
          theme={() => api.theme.current}
          career={career}
          clock={clock}
          heart={heart}
          temperament={() => persona().temperament}
          character={persona}
          now={Date.now}
        />
      ));
    };

    /** The heart is drawn wherever the sprite is, in this window; petting counts nothing. */
    let heartTimer: ReturnType<typeof setTimeout> | undefined;
    const pet = () => {
      setHeart(true);
      if (heartTimer !== undefined) clearTimeout(heartTimer);
      heartTimer = setTimeout(
        guard(() => setHeart(false)),
        PET_MS,
      );
    };
    api.lifecycle.onDispose(() => {
      if (heartTimer !== undefined) clearTimeout(heartTimer);
    });

    /** A rename is a Delta: shown at once here, flushed like the counters, latest wins across windows. */
    const rename = (input: string) => {
      const value = cleanName(input);
      if (value === undefined || value === name()) return;
      const delta: Delta = { ...EMPTY_DELTA, rename: { value, at: Date.now() } };
      pending = addDelta(pending, delta);
      show(merge(career(), delta));
    };

    const askName = () => {
      api.ui.dialog.replace(() => (
        <api.ui.DialogPrompt
          title="Rename"
          placeholder="A name for the creature"
          value={name()}
          onConfirm={guard((value: string) => {
            api.ui.dialog.clear();
            rename(value);
          })}
          onCancel={() => api.ui.dialog.clear()}
        />
      ));
    };

    let unregisterCommands: (() => void) | undefined;
    function registerCommands(): void {
      unregisterCommands?.();
      const title = name();
      unregisterCommands = api.keymap.registerLayer({
        commands: [
          {
            name: "tamago.mute",
            title: `${title}: toggle bubbles`,
            description: "Mute or unmute what the creature says",
            category: title,
            /** What lists a command in the palette; OpenCode's own commands carry it. */
            namespace: "palette",
            run: guard(() => setMute(!muted())),
          },
          {
            name: "tamago.card",
            title: `${title}: show card`,
            description: "Who the creature is: stage, XP, age",
            category: title,
            namespace: "palette",
            run: guard(showCard),
          },
          {
            name: "tamago.pet",
            title: `${title}: pet`,
            description: "Give the creature a pat",
            category: title,
            namespace: "palette",
            run: guard(pet),
          },
          {
            name: "tamago.rename",
            title: `${title}: rename`,
            description: "Give the creature a new name, shared by every window",
            category: title,
            namespace: "palette",
            run: guard(askName),
          },
        ],
      });
    }
    registerCommands();
    api.lifecycle.onDispose(() => unregisterCommands?.());

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
          api.ui.toast({ variant: "error", title: name(), message: `${name()} cannot save its progress. See ${DATA_DIR}/error.log.` });
        }
      }
      schedule();
    };
    schedule();

    api.lifecycle.onDispose(
      guard(() => {
        if (ticker !== undefined) clearTimeout(ticker);
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
              name={name()}
              theme={() => ctx.theme.current}
              session={sessionOf(props.session_id)}
              career={career}
              clock={clock}
              footer={footer(props.session_id)}
              bubble={() => voices()[props.session_id]?.bubble}
              heart={heart}
              temperament={() => persona().temperament}
            />
          );
        },
      },
    });

    api.slots.register({
      order: HOME_BOTTOM_ORDER,
      slots: {
        home_bottom(ctx) {
          return (
            <HomeView
              name={name()}
              theme={() => ctx.theme.current}
              career={career}
              clock={clock}
              heart={heart}
              temperament={() => persona().temperament}
            />
          );
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

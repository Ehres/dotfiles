/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import type { Event } from "@opencode-ai/sdk/v2";
import { homedir } from "node:os";
import { join } from "node:path";
import { createMemo, createSignal } from "solid-js";
import { createErrorLog } from "./adapter/log.ts";
import { behavior } from "./core/creature/behavior.ts";
import { tickInterval } from "./core/moment/cadence.ts";
import { createStore, type Loaded } from "./adapter/store.ts";
import { SUBSCRIBED, createTranslator } from "./adapter/translate.ts";
import { reveal } from "./core/appearance/card.ts";
import { footerPath } from "./core/appearance/footer.ts";
import { WARN_AFTER, backoff } from "./core/store/retry.ts";
import { PET_MS } from "./core/appearance/sprites.ts";
import type { Voice } from "./core/speech/voice.ts";
import { freshCareer, isEmpty, sameCareer, type Career } from "./core/career/career.ts";
import { tamago, type Tamago } from "./core/tamago.ts";
import { initialSession, type Session } from "./core/moment/session.ts";
import {
  adopt,
  flushed,
  freshWindow,
  receive,
  rename as renameWindow,
  setMuted as muteWindow,
  tick as tickWindow,
  type Step,
  type Window,
} from "./core/window.ts";
import { blocked, blockers, idOf, line, ordered, stepsIn } from "./core/roster/roster.ts";
import { CardView } from "./view/card.tsx";
import { HomeView } from "./view/home.tsx";
import { RosterView } from "./view/roster.tsx";
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
/** What the palette commands are filed under. Fixed on purpose: the user searches for the plugin, not for a Name they may change. */
const PALETTE = "Tamago";

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
    loaded = { career: freshCareer(Date.now()), corrupt: false, present: false };
  }

  try {
    /**
     * The Window is the truth; core/window.ts moves it. Its parts are mirrored
     * into one signal each, so a view re-renders only for the part it reads.
     */
    let window: Window = freshWindow(loaded.career, api.kv.get<boolean>("tamago.muted", false) === true);
    const [career, setCareer] = createSignal<Career>(window.career, { equals: sameCareer });
    /** One mood per root OpenCode session, keyed by session id. Never persisted. */
    const [sessions, setSessions] = createSignal<Record<string, Session>>(window.sessions);
    /** One Voice per root OpenCode session, keyed like `sessions`. Never persisted. */
    const [voices, setVoices] = createSignal<Record<string, Voice>>(window.voices);
    /** Persisted through api.kv; when muted no Cue is heard and every Bubble is cleared. */
    const [muted, setMuted] = createSignal(window.muted);
    /** The Name lives in the Career, so a rename in one window reaches the others on flush. */
    const name = (): string => career().name?.value ?? defaultName;
    /** The active Tamago, read from the Career once per change: Stage, Sheet, Behavior, Character. Derived, never stored; every window computes the same. */
    const active = createMemo(() => tamago(career()));
    /** True while the sprite wears the heart after a pet. Per window, like the sprite itself. */
    const [heart, setHeart] = createSignal(false);
    /** Milliseconds since the plugin started; drives animation frames. */
    const started = Date.now();
    const [clock, setClock] = createSignal(0);

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

    /** Makes `next` the Window and mirrors each changed part into its signal; an untouched part re-renders nobody. */
    const commit = (next: Window) => {
      const prev = window;
      window = next;
      if (next.career !== prev.career) setCareer(next.career);
      if (next.sessions !== prev.sessions) setSessions(next.sessions);
      if (next.voices !== prev.voices) setVoices(next.voices);
      if (next.muted !== prev.muted) setMuted(next.muted);
    };

    /** Commits a Step, then performs its effects with the new Name already on screen. */
    const run = ({ window: next, effects }: Step) => {
      commit(next);
      for (const effect of effects) {
        if (effect.type === "renamed") registerCommands(); // palette descriptions carry the Name and are fixed at registration
        else if (effect.type === "switched") {
          registerCommands();
          api.ui.toast({ variant: "info", title: name(), message: stepsIn(career(), defaultName) });
        } else if (effect.stage === "hatchling") api.ui.toast({ variant: "success", title: name(), message: reveal(name(), active()) });
        else api.ui.toast({ variant: "success", title: name(), message: `${name()} evolved: ${effect.stage}!` });
      }
    };

    const onEvent = guard((event: Event) => {
      for (const addressed of translate(event)) run(receive(window, addressed, Date.now()));
    });
    for (const type of SUBSCRIBED) api.lifecycle.onDispose(api.event.on(type, onEvent));

    /** Fast while a session shows effort, slow otherwise, at the pace of the active Career's Sheet. */
    let ticker: ReturnType<typeof setTimeout> | undefined;
    const scheduleTick = () => {
      const activities = Object.values(window.sessions).map((session) => session.activity);
      ticker = setTimeout(tick, tickInterval(activities, behavior(window.career)));
    };
    const tick = guard(() => {
      const now = Date.now();
      commit(tickWindow(window, now));
      setClock(now - started);
      scheduleTick();
    });
    scheduleTick();

    const setMute = (value: boolean) => {
      commit(muteWindow(window, value));
      api.kv.set("tamago.muted", value);
    };

    /** The dialog stack wraps the card in OpenCode's own centered Dialog; nothing to position here. */
    const showCard = () => {
      api.ui.dialog.replace(() => (
        <CardView name={name()} theme={api.theme.current} tamago={active()} clock={clock()} heart={heart()} now={started + clock()} />
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
    const rename = (input: string) => run(renameWindow(window, input, Date.now(), name()));

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

    const BUSY = "Another window is writing. Try again.";

    /** The Delta must reach its own Career before the active one changes. False, with a toast, when the disk is busy; disk errors throw and `guard` logs them. */
    const settle = (): boolean => {
      if (persist()) return true;
      api.ui.toast({ variant: "warning", title: name(), message: BUSY });
      return false;
    };

    const switchTo = (id: number) => {
      if (!settle()) return;
      if (id === window.career.hatchedAt) return; // another window brought it to the front while we flushed
      const result = store.switch(id);
      if (result.outcome === "written") run(flushed(window, result.career, Date.now()));
      else if (result.outcome === "missing") api.ui.toast({ variant: "warning", title: name(), message: "That Tamago is gone from the roster." });
      else if (result.outcome === "corrupt") warnCorrupt();
      else api.ui.toast({ variant: "warning", title: name(), message: BUSY });
    };

    /** The roster dialog: every Tamago of the machine, the highlighted one's card underneath; Enter on a resting one is a Switch. */
    const showRoster = () => {
      const { roster, corrupt } = store.roster();
      if (corrupt) {
        warnCorrupt();
        return;
      }
      const careers = ordered(roster);
      const shown = careers.map((one) => tamago(one));
      const activeId = idOf(roster.active);
      const lines = careers.map((one) => line(one, defaultName, activeId));
      api.ui.dialog.replace(() => (
        <RosterView
          theme={api.theme.current}
          tamagos={shown}
          lines={lines}
          clock={clock()}
          now={started + clock()}
          onSelect={guard((chosen: Tamago) => {
            api.ui.dialog.clear();
            if (idOf(chosen.career) !== activeId) switchTo(idOf(chosen.career));
          })}
        />
      ));
    };

    const lay = () => {
      if (!settle()) return;
      const result = store.hatch(Date.now());
      if (result.outcome === "written") run(flushed(window, result.career, Date.now()));
      else if (result.outcome === "corrupt") warnCorrupt();
      else api.ui.toast({ variant: "warning", title: name(), message: BUSY });
    };

    const askHatch = () => {
      if (!settle()) return;
      const { roster, corrupt } = store.roster();
      if (corrupt) {
        warnCorrupt();
        return;
      }
      const first = blockers(roster)[0];
      if (first !== undefined) {
        api.ui.toast({ variant: "warning", title: name(), message: blocked(first, defaultName) });
        return;
      }
      api.ui.dialog.replace(() => (
        <api.ui.DialogConfirm
          title="Hatch a new egg?"
          message={`${name()} rests in the roster; switch back anytime.`}
          onConfirm={guard(() => {
            api.ui.dialog.clear();
            lay();
          })}
          onCancel={() => api.ui.dialog.clear()}
        />
      ));
    };

    let unregisterCommands: (() => void) | undefined;
    function registerCommands(): void {
      unregisterCommands?.();
      const who = name();
      unregisterCommands = api.keymap.registerLayer({
        commands: [
          {
            name: "tamago.mute",
            title: `${PALETTE}: toggle bubbles`,
            description: `Mute or unmute what ${who} says`,
            category: PALETTE,
            /** What lists a command in the palette; OpenCode's own commands carry it. */
            namespace: "palette",
            run: guard(() => setMute(!muted())),
          },
          {
            name: "tamago.card",
            title: `${PALETTE}: show card`,
            description: `Who ${who} is: species, stage, XP, age, stats`,
            category: PALETTE,
            namespace: "palette",
            run: guard(showCard),
          },
          {
            name: "tamago.pet",
            title: `${PALETTE}: pet`,
            description: `Give ${who} a pat`,
            category: PALETTE,
            namespace: "palette",
            run: guard(pet),
          },
          {
            name: "tamago.rename",
            title: `${PALETTE}: rename`,
            description: `Give ${who} a new name, shared by every window`,
            category: PALETTE,
            namespace: "palette",
            run: guard(askName),
          },
          {
            name: "tamago.hatch",
            title: `${PALETTE}: hatch a new egg`,
            description: "Hatch a new egg once every Tamago is elder",
            category: PALETTE,
            namespace: "palette",
            run: guard(askHatch),
          },
          {
            name: "tamago.roster",
            title: `${PALETTE}: roster`,
            description: "Every Tamago of this machine; pick one to bring it to the front",
            category: PALETTE,
            namespace: "palette",
            run: guard(showRoster),
          },
        ],
      });
    }
    registerCommands();
    api.lifecycle.onDispose(() => unregisterCommands?.());

    /** Returns true when this window's delta reached the disk. Throws on disk errors. */
    const persist = (): boolean => {
      if (isEmpty(window.pending)) {
        // Nothing of ours to write, but other instances may have progressed.
        const fresh = store.load();
        if (fresh.corrupt) warnCorrupt();
        else if (fresh.present) run(adopt(window, fresh.career, Date.now())); // nothing on disk yet: keep showing our own egg
        return true;
      }
      const result = store.flush(window.pending, window.career.hatchedAt); // the pending Delta was earned under the Career shown
      if (result.outcome === "busy") return false; // lock held elsewhere: keep the delta, retry next time
      if (result.outcome === "corrupt") {
        warnCorrupt();
        return false; // the file was set aside; the next flush writes over a fresh egg
      }
      run(flushed(window, result.career, Date.now()));
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
        if (!isEmpty(window.pending)) store.flush(window.pending, window.career.hatchedAt);
      }),
    );

    const footer = (sessionID: string): FooterInfo => {
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
              theme={ctx.theme.current}
              session={sessions()[props.session_id] ?? initialSession(0)}
              tamago={active()}
              clock={clock()}
              footer={footer(props.session_id)}
              bubble={voices()[props.session_id]?.bubble}
              heart={heart()}
            />
          );
        },
      },
    });

    api.slots.register({
      order: HOME_BOTTOM_ORDER,
      slots: {
        home_bottom(ctx) {
          return <HomeView name={name()} theme={ctx.theme.current} tamago={active()} clock={clock()} heart={heart()} />;
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

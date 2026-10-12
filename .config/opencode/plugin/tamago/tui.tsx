/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSignal } from "solid-js";
import { createErrorLog } from "./adapter/log.ts";
import { createStore, type Loaded } from "./adapter/store.ts";
import { SUBSCRIBED, createTranslator, type HostEvent } from "./adapter/translate.ts";
import { freshCareer, isEmpty } from "./core/career/career.ts";
import { MEDIAN, behavior } from "./core/creature/behavior.ts";
import { resolveLanguage, say } from "./core/language.ts";
import { tickInterval } from "./core/moment/cadence.ts";
import { WARN_AFTER } from "./core/store/retry.ts";
import { reveal } from "./core/text/card.ts";
import { stepsIn } from "./core/text/roster.ts";
import { CORRUPT, cannotSave, evolved } from "./core/text/toasts.ts";
import { freshWindow, receive, tick as tickWindow } from "./core/window.ts";
import { createActions, type Prefs } from "./shell/actions.ts";
import { createDialogs } from "./shell/dialogs.tsx";
import { createFlushLoop } from "./shell/flush.ts";
import { createGuard } from "./shell/guard.ts";
import { createMirror } from "./shell/mirror.ts";
import { registerPalette } from "./shell/palette.ts";
import { registerSlots } from "./shell/slots.tsx";
import { createTicker } from "./shell/tick.ts";
import { openCodeTheme } from "./view/theme.tsx";

const id = "opencode-tamago";
const DATA_DIR = join(homedir(), ".local", "share", "opencode-tamago");
const FLUSH_MS = 2_000;
/** Longest pause between two flush attempts while the disk keeps failing. */
const FLUSH_MAX_MS = 60_000;
/** Pause between two flushes of a window with nothing of its own to write: it only watches what the other windows do. */
const FLUSH_IDLE_MS = 10_000;

export default Plugin.define({
  id,
  setup(api) {
    const options = api.options;
    /** The plugin option: the Name until the user renames the creature. */
    const defaultName = typeof options.name === "string" && options.name.trim() ? options.name.trim() : "Tamago";
    const store = createStore(DATA_DIR);
    const logError = createErrorLog(DATA_DIR);
    const guard = createGuard(logError);
    const translate = createTranslator({ isChild: (id) => typeof api.data.session.get(id)?.parentID === "string" });

    let loaded: Loaded;
    try {
      loaded = store.load();
    } catch (err) {
      logError(err);
      loaded = { career: freshCareer(Date.now()), corrupt: false, present: false };
    }

    try {
      /** Milliseconds since the plugin started; drives animation frames. */
      const started = Date.now();
      const [clock, setClock] = createSignal(0);
      const theme = openCodeTheme(() => api.theme);
      const [prefs, updatePrefs] = api.storage.store<Prefs>("prefs", { initial: { muted: false } });
      const savePrefs = (mutation: (draft: Prefs) => void) => {
        updatePrefs(mutation).catch(logError);
      };

      const language = resolveLanguage(prefs.language, options.language);
      const mirror = createMirror(
        freshWindow(loaded.career, prefs.muted === true, language),
        defaultName,
        (effect) => {
          const name = mirror.name();
          if (effect.type === "renamed" || effect.type === "chosen") return; // the palette layer re-reads the Name and the choices on its own
          if (effect.type === "switched")
            api.ui.toast.show({ variant: "info", title: name, message: stepsIn(mirror.career(), defaultName, mirror.language()) });
          else if (effect.stage === "hatchling")
            api.ui.toast.show({ variant: "success", title: name, message: reveal(name, mirror.active(), mirror.language()) });
          else {
            const gender = mirror.active().species.gender;
            api.ui.toast.show({ variant: "success", title: name, message: evolved(name, effect.stage, gender, mirror.language()) });
          }
        },
      );

      let warnedCorrupt = false;
      const warnCorrupt = () => {
        if (warnedCorrupt) return;
        warnedCorrupt = true;
        api.ui.toast.show({ variant: "warning", title: mirror.name(), message: say(CORRUPT, mirror.language()) });
      };
      if (loaded.corrupt) warnCorrupt();

      const actions = createActions({ api, store, mirror, warnCorrupt, guard, savePrefs });
      const dialogs = createDialogs({ api, theme, store, mirror, actions, clock, started, defaultName, warnCorrupt, guard });
      registerPalette({ api, mirror, actions, dialogs, guard });

      /**
       * The background service streams the events of every location it serves; this window counts only
       * its own, as each OpenCode 1 window did with its own server. An event with no location is global.
       */
      const here = api.location?.directory;
      const onEvent = guard((event: HostEvent & { readonly location?: { readonly directory: string } }) => {
        if (here !== undefined && event.location !== undefined && event.location.directory !== here) return;
        for (const addressed of translate(event)) mirror.run(receive(mirror.current(), addressed, Date.now()));
      });
      const unsubscribe = SUBSCRIBED.map((type) => api.data.on(type, onEvent));

      /** Fast while a session shows effort, slow otherwise, at the pace of the active Career's Sheet. */
      const ticker = createTicker({
        /** `guard` covers `onTick`; this covers the interval, read outside it: the loop never dies and never throws into the event loop. */
        interval: () => {
          try {
            return tickInterval(Object.values(mirror.current().sessions).map((session) => session.activity), behavior(mirror.current().career));
          } catch (err) {
            logError(err);
            return MEDIAN.slowMs;
          }
        },
        onTick: guard((now: number) => {
          mirror.commit(tickWindow(mirror.current(), now));
          setClock(now - started);
        }),
      });
      ticker.start();

      const flusher = createFlushLoop({
        persist: actions.persist,
        onError: (err, failures) => {
          logError(err);
          if (failures === WARN_AFTER)
            api.ui.toast.show({ variant: "error", title: mirror.name(), message: cannotSave(mirror.name(), DATA_DIR, mirror.language()) });
        },
        base: FLUSH_MS,
        idle: FLUSH_IDLE_MS,
        /** `guard` covers `persist`; this covers the choice of delay, read outside it: the loop never dies and never throws into the event loop. */
        isIdle: () => {
          try {
            const window = mirror.current();
            return isEmpty(window.pending) && !Object.values(window.sessions).some((session) => session.busy);
          } catch (err) {
            logError(err);
            return false; // the delay we always had
          }
        },
        max: FLUSH_MAX_MS,
      });
      flusher.start();

      registerSlots({ api, theme, mirror, actions, clock });

      /** The palette layer and the slot go with the plugin on their own; the rest is ours to stop. */
      return guard(() => {
        for (const stop of unsubscribe) stop();
        ticker.stop();
        flusher.stop();
        actions.dispose();
        const window = mirror.current();
        if (!isEmpty(window.pending)) store.flush(window.pending, window.career.hatchedAt);
      });
    } catch (err) {
      logError(err);
      return;
    }
  },
});

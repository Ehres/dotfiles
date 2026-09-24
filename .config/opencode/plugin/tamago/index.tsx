/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui";
import type { Event } from "@opencode-ai/sdk/v2";
import { homedir } from "node:os";
import { join } from "node:path";
import { createSignal } from "solid-js";
import { createErrorLog } from "./adapter/log.ts";
import { createStore, type Loaded } from "./adapter/store.ts";
import { SUBSCRIBED, createTranslator } from "./adapter/translate.ts";
import { footerPath } from "./core/appearance/footer.ts";
import { freshCareer, isEmpty } from "./core/career/career.ts";
import { MEDIAN, behavior } from "./core/creature/behavior.ts";
import { resolveLanguage, say } from "./core/language.ts";
import { tickInterval } from "./core/moment/cadence.ts";
import { WARN_AFTER } from "./core/store/retry.ts";
import { reveal } from "./core/text/card.ts";
import { stepsIn } from "./core/text/roster.ts";
import { CORRUPT, cannotSave, evolved } from "./core/text/toasts.ts";
import { freshWindow, receive, tick as tickWindow } from "./core/window.ts";
import { createActions } from "./shell/actions.ts";
import { createDialogs } from "./shell/dialogs.tsx";
import { createFlushLoop } from "./shell/flush.ts";
import { createGuard } from "./shell/guard.ts";
import { createMirror } from "./shell/mirror.ts";
import { createPalette } from "./shell/palette.ts";
import { registerSlots } from "./shell/slots.tsx";
import { createTicker } from "./shell/tick.ts";
import type { FooterInfo } from "./view/sidebar.tsx";

const id = "opencode-tamago";
const DATA_DIR = join(homedir(), ".local", "share", "opencode-tamago");
const FLUSH_MS = 2_000;
/** Longest pause between two flush attempts while the disk keeps failing. */
const FLUSH_MAX_MS = 60_000;
/** Pause between two flushes of a window with nothing of its own to write: it only watches what the other windows do. */
const FLUSH_IDLE_MS = 10_000;

const tui: TuiPlugin = async (api, options) => {
  /** The plugin option: the Name until the user renames the creature. */
  const defaultName = typeof options?.name === "string" && options.name.trim() ? options.name.trim() : "Tamago";
  const store = createStore(DATA_DIR);
  const logError = createErrorLog(DATA_DIR);
  const guard = createGuard(logError);
  const translate = createTranslator({ isChild: (id) => typeof api.state.session.get(id)?.parentID === "string" });

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
    let palette: ReturnType<typeof createPalette> | undefined;

    const language = resolveLanguage(api.kv.get<unknown>("tamago.language"), options?.language);
    const mirror = createMirror(
      freshWindow(loaded.career, api.kv.get<boolean>("tamago.muted", false) === true, language),
      defaultName,
      (effect) => {
        const name = mirror.name();
        // palette descriptions carry the Name and the choice count, both fixed at registration
        if (effect.type === "renamed" || effect.type === "chosen") palette?.register();
        else if (effect.type === "switched") {
          palette?.register();
          api.ui.toast({ variant: "info", title: name, message: stepsIn(mirror.career(), defaultName, mirror.language()) });
        } else {
          palette?.register(); // an Evolution is what makes a Draw appear
          const gender = mirror.active().species.gender ?? "m";
          if (effect.stage === "hatchling")
            api.ui.toast({ variant: "success", title: name, message: reveal(name, mirror.active(), mirror.language()) });
          else api.ui.toast({ variant: "success", title: name, message: evolved(name, effect.stage, gender, mirror.language()) });
        }
      },
    );

    let warnedCorrupt = false;
    const warnCorrupt = () => {
      if (warnedCorrupt) return;
      warnedCorrupt = true;
      api.ui.toast({ variant: "warning", title: mirror.name(), message: say(CORRUPT, mirror.language()) });
    };
    if (loaded.corrupt) warnCorrupt();

    const actions = createActions({ api, store, mirror, warnCorrupt, guard, onLanguage: () => palette?.register() });
    const dialogs = createDialogs({ api, store, mirror, actions, clock, started, defaultName, warnCorrupt, guard });
    palette = createPalette({ api, mirror, actions, dialogs, guard });
    palette.register();

    const onEvent = guard((event: Event) => {
      for (const addressed of translate(event)) mirror.run(receive(mirror.current(), addressed, Date.now()));
    });
    for (const type of SUBSCRIBED) api.lifecycle.onDispose(api.event.on(type, onEvent));

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
          api.ui.toast({ variant: "error", title: mirror.name(), message: cannotSave(mirror.name(), DATA_DIR, mirror.language()) });
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

    const footer = (sessionID: string): FooterInfo => {
      const info = api.state.session.get(sessionID);
      const dir = info?.directory || api.state.path.directory;
      const branch = info?.directory === api.state.path.directory ? api.state.vcs?.branch : undefined;
      return { ...footerPath(dir, homedir(), branch), version: api.app.version };
    };
    registerSlots({ api, mirror, actions, clock, footer });

    api.lifecycle.onDispose(
      guard(() => {
        ticker.stop();
        flusher.stop();
        actions.dispose();
        palette?.dispose();
        const window = mirror.current();
        if (!isEmpty(window.pending)) store.flush(window.pending, window.career.hatchedAt);
      }),
    );
  } catch (err) {
    logError(err);
    return;
  }
};

const plugin: TuiPluginModule & { id: string } = { id, tui };
export default plugin;

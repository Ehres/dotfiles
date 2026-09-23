import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import { createSignal, type Accessor } from "solid-js";
import type { Store } from "../adapter/store.ts";
import { PET_MS } from "../core/appearance/sprites.ts";
import { isEmpty } from "../core/career/career.ts";
import type { MilestoneId, TraitId } from "../core/career/pick.ts";
import type { Language } from "../core/language.ts";
import type { CareerId } from "../core/roster/roster.ts";
import { BUSY, GONE } from "../core/text/toasts.ts";
import {
  adopt,
  flushed,
  pick as pickWindow,
  rename as renameWindow,
  setLanguage as languageWindow,
  setMuted as muteWindow,
} from "../core/window.ts";
import type { Guard } from "./guard.ts";
import type { Mirror } from "./mirror.ts";

export type Actions = {
  persist(): boolean;
  settle(): boolean;
  switchTo(id: CareerId): void;
  lay(): void;
  rename(input: string): void;
  setMute(value: boolean): void;
  setLanguage(value: Language): void;
  pet(): void;
  choose(milestone: MilestoneId, trait: TraitId): void;
  /** True while the sprite wears the heart after a pet. Per window, like the sprite itself. */
  heart: Accessor<boolean>;
  dispose(): void;
};

/** What the palette does to the store and the Window. */
export function createActions(deps: {
  api: TuiPluginApi;
  store: Store;
  mirror: Mirror;
  warnCorrupt: () => void;
  guard: Guard;
  now?: () => number;
  /** The palette titles carry the Language's own words, fixed at registration: a switch must rebuild them. */
  onLanguage: () => void;
}): Actions {
  const { api, store, mirror, warnCorrupt, guard, onLanguage } = deps;
  const now = deps.now ?? Date.now;
  const [heart, setHeart] = createSignal(false);

  /** Returns true when this window's delta reached the disk. Throws on disk errors. */
  const persist = (): boolean => {
    if (isEmpty(mirror.current().pending)) {
      // Nothing of ours to write, but other instances may have progressed.
      const fresh = store.load();
      if (fresh.corrupt) warnCorrupt();
      else if (fresh.present) mirror.run(adopt(mirror.current(), fresh.career, now())); // nothing on disk yet: keep showing our own egg
      return true;
    }
    const result = store.flush(mirror.current().pending, mirror.current().career.hatchedAt); // the pending Delta was earned under the Career shown
    if (result.outcome === "busy") return false; // lock held elsewhere: keep the delta, retry next time
    if (result.outcome === "corrupt") {
      warnCorrupt();
      return false; // the file was set aside; the next flush writes over a fresh egg
    }
    mirror.run(flushed(mirror.current(), result.career, now()));
    return true;
  };

  /** The Delta must reach its own Career before the active one changes. False, with a toast, when the disk is busy; disk errors throw and `guard` logs them. */
  const settle = (): boolean => {
    if (persist()) return true;
    api.ui.toast({ variant: "warning", title: mirror.name(), message: BUSY });
    return false;
  };

  const switchTo = (id: CareerId) => {
    if (!settle()) return;
    if (id === mirror.current().career.hatchedAt) return; // another window brought it to the front while we flushed
    const result = store.switch(id);
    if (result.outcome === "written") mirror.run(flushed(mirror.current(), result.career, now()));
    else if (result.outcome === "missing") api.ui.toast({ variant: "warning", title: mirror.name(), message: GONE });
    else if (result.outcome === "corrupt") warnCorrupt();
    else api.ui.toast({ variant: "warning", title: mirror.name(), message: BUSY });
  };

  const lay = () => {
    if (!settle()) return;
    const result = store.hatch(now());
    if (result.outcome === "written") mirror.run(flushed(mirror.current(), result.career, now()));
    else if (result.outcome === "corrupt") warnCorrupt();
    else api.ui.toast({ variant: "warning", title: mirror.name(), message: BUSY });
  };

  /** A rename is a Delta: shown at once here, flushed like the counters, latest wins across windows. */
  const rename = (input: string) => mirror.run(renameWindow(mirror.current(), input, now(), mirror.name()));

  /** A Pick is a Delta, like a rename: shown at once, flushed with the counters, the earliest Pick wins across windows. */
  const choose = (milestone: MilestoneId, trait: TraitId) => mirror.run(pickWindow(mirror.current(), milestone, trait, now()));

  const setMute = (value: boolean) => {
    mirror.commit(muteWindow(mirror.current(), value));
    api.kv.set("tamago.muted", value);
  };

  /** The Language is a window-and-machine preference, never a Delta: it does not touch the Career and never reaches the disk. */
  const setLanguage = (value: Language) => {
    const current = mirror.current();
    if (current.language === value) return;
    mirror.commit(languageWindow(current, value));
    api.kv.set("tamago.language", value);
    onLanguage();
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

  return {
    persist,
    settle,
    switchTo,
    lay,
    rename,
    setMute,
    setLanguage,
    pet,
    choose,
    heart,
    dispose() {
      if (heartTimer !== undefined) clearTimeout(heartTimer);
    },
  };
}

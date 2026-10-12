/** @jsxImportSource @opentui/solid */
import type { Context } from "@opencode/plugin/tui/context";
import type { Accessor } from "solid-js";
import { initialSession } from "../core/moment/session.ts";
import { LanguageProvider } from "../view/language.tsx";
import { SidebarView } from "../view/sidebar.tsx";
import { ThemeProvider, type Theme } from "../view/theme.tsx";
import type { Actions } from "./actions.ts";
import type { Mirror } from "./mirror.ts";

/** The one slot the plugin draws into: the end of the sidebar footer, after OpenCode's own content. */
export function registerSlots(deps: { api: Context; theme: Theme; mirror: Mirror; actions: Actions; clock: Accessor<number> }): void {
  const { api, theme, mirror, actions, clock } = deps;

  api.ui.slot({
    append: "sidebar.footer",
    render: (input) => (
      <ThemeProvider theme={theme}>
        <LanguageProvider language={mirror.language()}>
          <SidebarView
            name={mirror.name()}
            session={mirror.sessions()[input.sessionID] ?? initialSession(0)}
            tamago={mirror.active()}
            clock={clock()}
            bubble={mirror.voices()[input.sessionID]?.bubble}
            heart={actions.heart()}
          />
        </LanguageProvider>
      </ThemeProvider>
    ),
  });
}

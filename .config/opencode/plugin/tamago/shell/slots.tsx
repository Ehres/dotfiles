/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { Accessor } from "solid-js";
import { initialSession } from "../core/moment/session.ts";
import { LanguageProvider } from "../view/language.tsx";
import { SidebarView } from "../view/sidebar.tsx";
import { ThemeProvider } from "../view/theme.tsx";
import type { Actions } from "./actions.ts";
import type { Mirror } from "./mirror.ts";

/** Below the built-in footer's order (100) so we win the single_winner slot. */
const FOOTER_ORDER = 50;

/** The one slot the plugin draws into: the sidebar footer. */
export function registerSlots(deps: { api: TuiPluginApi; mirror: Mirror; actions: Actions; clock: Accessor<number> }): void {
  const { api, mirror, actions, clock } = deps;

  api.slots.register({
    order: FOOTER_ORDER,
    slots: {
      sidebar_footer(ctx, props) {
        return (
          <ThemeProvider theme={ctx.theme}>
            <LanguageProvider language={mirror.language()}>
              <SidebarView
                name={mirror.name()}
                session={mirror.sessions()[props.session_id] ?? initialSession(0)}
                tamago={mirror.active()}
                clock={clock()}
                bubble={mirror.voices()[props.session_id]?.bubble}
                heart={actions.heart()}
              />
            </LanguageProvider>
          </ThemeProvider>
        );
      },
    },
  });
}

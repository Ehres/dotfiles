/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import type { Accessor } from "solid-js";
import { initialSession } from "../core/moment/session.ts";
import { HomeView } from "../view/home.tsx";
import { SidebarView, type FooterInfo } from "../view/sidebar.tsx";
import { ThemeProvider } from "../view/theme.tsx";
import type { Actions } from "./actions.ts";
import type { Mirror } from "./mirror.ts";

/** Below the built-in footer's order (100) so we win the single_winner slot. */
const FOOTER_ORDER = 50;
/** home_bottom is additive: below 100 renders above the built-in tips, keeping the OpenCode logo intact. */
const HOME_BOTTOM_ORDER = 50;

/** The two slots the plugin draws into: the sidebar footer and the home screen. */
export function registerSlots(deps: {
  api: TuiPluginApi;
  mirror: Mirror;
  actions: Actions;
  clock: Accessor<number>;
  footer: (sessionID: string) => FooterInfo;
}): void {
  const { api, mirror, actions, clock, footer } = deps;

  api.slots.register({
    order: FOOTER_ORDER,
    slots: {
      sidebar_footer(ctx, props) {
        return (
          <ThemeProvider theme={ctx.theme}>
            <SidebarView
              name={mirror.name()}
              session={mirror.sessions()[props.session_id] ?? initialSession(0)}
              tamago={mirror.active()}
              clock={clock()}
              footer={footer(props.session_id)}
              bubble={mirror.voices()[props.session_id]?.bubble}
              heart={actions.heart()}
            />
          </ThemeProvider>
        );
      },
    },
  });

  api.slots.register({
    order: HOME_BOTTOM_ORDER,
    slots: {
      home_bottom(ctx) {
        return (
          <ThemeProvider theme={ctx.theme}>
            <HomeView name={mirror.name()} tamago={mirror.active()} clock={clock()} heart={actions.heart()} />
          </ThemeProvider>
        );
      },
    },
  });
}

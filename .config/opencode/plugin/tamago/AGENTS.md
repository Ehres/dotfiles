# AGENTS.md — opencode-tamago

Shared TypeScript rules and the toolchain landmine live in the repository
AGENTS.md. Vocabulary lives in `CONTEXT.md`; use those terms.

## Rules

- `core/` is pure data and strings, tested with `node:test`. `adapter/` is the
  only layer that reads SDK event shapes or touches the disk. `index.tsx` is
  the only module that touches `api.*` and timers. Views take accessors and
  return JSX.
- Moving a Session (`transition`) and counting XP (`count`) are separate pure
  functions; an event may move several Sessions but is counted once.
- What an event, a tick, a flush or a palette command does to the Window is a
  pure function in `core/window.ts`, tested. `index.tsx` only feeds it, mirrors
  the result into signals and performs the returned effects (toast, palette
  refresh). New behavior goes in the reducer, not in `index.tsx`.
- Child (subagent) sessions never move a Session. Their work counts, their
  prompts do not.
- Stage, and anything else derived from counters, is computed, never stored.
- Errors never change XP.
- Every Frame of a Stage has the same size; colors come from the theme.
- Every handler is wrapped by `guard`: the TUI never crashes because of this
  plugin.
- Counters only grow; `merge` stays commutative and preserves `hatchedAt`.
- A new Career field is listed in `CAREER_KEYS` (a plain counter in
  `COUNTER_KEYS`), or the build fails. The store carries any key it does not
  know verbatim, so an older build still running never erases a newer one's
  data.
- Weights and thresholds are tuned in the `stage.ts` tables, not in code paths.

## Verify

`node --test "core/*.test.ts" "adapter/*.test.ts"` and
`./node_modules/.bin/tsc --noEmit`, then launch OpenCode for views. Two
instances side by side for persistence changes.

## Scope

`IDEAS.md` is a backlog, not a decision; a retained idea gets a design spec
first. No penalties, no death, no reading of prompt content, no network.

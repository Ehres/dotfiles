/** Every handler is wrapped: the TUI never crashes because of this plugin. */
export function createGuard(
  logError: (err: unknown) => void,
): <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => void {
  return <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      try {
        fn(...args);
      } catch (err) {
        logError(err);
      }
    };
}

export type Guard = ReturnType<typeof createGuard>;

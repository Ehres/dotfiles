import type { Action, Intent, Mode } from "./types.ts";

export class UsageError extends Error {}

/** Passthrough flags that consume the following argument. */
const PASSTHROUGH_WITH_VALUE = new Set(["--theme", "--appearance", "--repo-url"]);

export function parseArgs(argv: string[]): Intent {
  let action: Action = "launch";
  let mode: Mode | null = null;
  let pathFilter: string | null = null;
  const passthrough: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    const value = (): string => {
      const next = argv[i + 1];
      if (next === undefined) throw new UsageError(`${arg} needs a value`);
      i += 1;
      return next;
    };
    const target = (next: Mode): void => {
      if (mode) throw new UsageError(`two targets given: ${mode.kind} and ${next.kind}`);
      mode = next;
    };

    switch (arg) {
      case "-h":
      case "--help":
        action = "help";
        break;
      case "--plan":
        action = "plan";
        break;
      case "--dry-run":
        action = "dry-run";
        break;
      case "--exec":
        action = "exec";
        break;
      case "-w":
      case "--working-tree":
        target({ kind: "working-tree" });
        break;
      case "--since-last":
        target({ kind: "since-last" });
        break;
      case "-r":
      case "--revisions":
        target({ kind: "revset", revset: value() });
        break;
      case "--file":
        target({ kind: "file", path: value() });
        break;
      case "pr":
      case "mr":
        target({ kind: "pr", target: value() });
        break;
      case "-p":
      case "--path":
        pathFilter = value();
        break;
      default:
        passthrough.push(arg);
        if (PASSTHROUGH_WITH_VALUE.has(arg)) passthrough.push(value());
    }
  }

  return { action, mode: mode ?? { kind: "auto" }, pathFilter, passthrough };
}

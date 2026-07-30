import { readFileSync } from "node:fs";
import { computeMetrics } from "./compute-metrics.ts";
import { formatReport } from "./format-report.ts";
import { DEFAULT_CONFIG } from "./types.ts";
import type { Config, NormalizedEvent } from "./types.ts";

function main(): void {
  const [eventsPath, configPath] = process.argv.slice(2);
  if (!eventsPath || !configPath) {
    console.error("Usage: node run.ts <events.json> <config.json>");
    process.exit(1);
  }

  const events: NormalizedEvent[] = JSON.parse(readFileSync(eventsPath, "utf8"));
  const overrides: Partial<Config> = JSON.parse(readFileSync(configPath, "utf8"));

  if (!overrides.windowStart || !overrides.windowEnd) {
    console.error("config must include windowStart and windowEnd (YYYY-MM-DD)");
    process.exit(1);
  }

  const config: Config = { ...DEFAULT_CONFIG, ...overrides, windowStart: overrides.windowStart, windowEnd: overrides.windowEnd };
  console.log(formatReport(computeMetrics(events, config)));
}

main();

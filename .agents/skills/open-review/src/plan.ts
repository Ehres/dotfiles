import { LIST_LIMIT } from "./constants.ts";
import type { PlanInput } from "./types.ts";

export function renderPlan(input: PlanInput): string {
  const { target, facts, base, shortstat, churn, untracked, untrackedTotal } = input;
  const lines: string[] = [`mode: ${target.description}`];

  if (base !== null) {
    lines.push(`base: ${base.ref} (${base.how}) frozen at ${base.mergeBase}`);
    lines.push(`commits: ${base.commits}    working tree: ${describeWork(facts)}`);
  } else {
    lines.push(`working tree: ${describeWork(facts)}`);
  }

  lines.push(`tuicr: ${target.tuicrArgs.join(" ")}`);

  switch (target.stat.kind) {
    case "none":
      lines.push(`stat: ${target.stat.reason}`);
      break;
    case "file": {
      const stat = target.stat;
      const row = untracked.find((entry) => entry.path === stat.path);
      lines.push(`file: ${stat.path}${row ? ` (${row.lines} lines)` : ""}`);
      break;
    }
    case "diff":
      lines.push(`stat: ${shortstat?.trim() || "no textual changes"}`);
      break;
  }

  // git diff cannot see untracked files, but the review will — so list them
  // rather than reporting a count that says they are missing. Capped like
  // churn below: an untracked build/ directory with `--untracked-files=all`
  // in scope would otherwise turn the plan into thousands of lines.
  if (target.stat.kind === "diff" && untrackedTotal > 0) {
    lines.push("untracked (not in the stat above):");
    for (const row of untracked) lines.push(`  ${String(row.lines).padStart(6)}  ${row.path}`);
    if (untrackedTotal > untracked.length) {
      lines.push(`  … and ${untrackedTotal - untracked.length} more`);
    }
  }

  if (churn.length > 0) {
    lines.push(`churn (added+deleted, top ${LIST_LIMIT}):`);
    for (const row of churn.slice(0, LIST_LIMIT)) {
      lines.push(`  ${String(row.changed).padStart(6)}  ${row.path}`);
    }
  }

  for (const note of target.notes) lines.push(`note: ${note}`);

  return lines.join("\n");
}

function describeWork(input: PlanInput["facts"]): string {
  const { staged, unstaged, untracked } = input.work;
  if (!input.work.dirty) return "clean";
  return `dirty (${staged} staged, ${unstaged} unstaged, ${untracked.length} untracked)`;
}

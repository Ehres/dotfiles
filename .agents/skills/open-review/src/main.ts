import { execFileSync } from "node:child_process";
import { parseArgs, UsageError } from "./args.ts";
import { chooseBase } from "./base.ts";
import {
  collectFacts,
  commitsBetween,
  countLines,
  isAncestor,
  numstat,
  shortstat,
} from "./git.ts";
import { renderPlan } from "./plan.ts";
import { electSession, renderCommentIndex } from "./session.ts";
import { awaitPlan, clearPlan, readLastReviewed, writeLastReviewed, writePlan } from "./state.ts";
import { insideTmux, openPopup, popupAlive, waitForPopupGone } from "./tmux.ts";
import { listSessions, readComments } from "./tuicr.ts";
import { buildPrTarget, buildTarget } from "./target.ts";
import { EXIT } from "./constants.ts";
import type { Action, BaseChoice, LastReviewed, RepoFacts, Target } from "./types.ts";

export type Resolution = {
  facts: RepoFacts;
  base: BaseChoice | null;
  target: Target;
  plan: string;
};

/**
 * Everything up to, but not including, side effects on the terminal.
 *
 * `known` lets a caller that has already collected the facts hand them over:
 * collecting costs ~0.6 s on a large repository, and `main` needs them before
 * it can clear the plan file, so collecting twice would double the wait before
 * the popup appears. Tests omit it and let it collect.
 */
export function resolve(cwd: string, argv: string[], known?: RepoFacts): Resolution {
  const intent = parseArgs(argv);
  const facts = known ?? collectFacts(cwd);
  if (facts === null) throw new Error("not a git repository");

  const base = facts.head === null ? null : chooseBase(facts);
  const target = buildTarget({
    intent,
    facts,
    base,
    lastReviewed: readLastReviewedState(cwd, facts),
  });

  const { pathFilter } = intent;
  const spec = target.stat;
  const plan = renderPlan({
    target,
    facts,
    base,
    shortstat: spec.kind === "diff" ? shortstat(cwd, spec, pathFilter) : null,
    churn: spec.kind === "diff" ? numstat(cwd, spec, pathFilter) : [],
    untracked:
      spec.kind === "file"
        ? [countLines(cwd, spec.path)]
        : facts.work.untracked.map((path) => countLines(cwd, path)),
  });

  return { facts, base, target, plan };
}

function readLastReviewedState(cwd: string, facts: RepoFacts): LastReviewed | null {
  if (facts.head === null) return null;
  const sha = readLastReviewed(facts.commonDir, facts.branch);
  if (sha === null) return null;
  const ancestor = isAncestor(cwd, sha, "HEAD");
  return {
    sha,
    isAncestor: ancestor,
    commits: ancestor ? commitsBetween(cwd, sha, "HEAD") : 0,
  };
}

const USAGE = `open-review — open a tuicr review in a tmux popup

  open-review                 auto: this branch's commits and/or working tree
  open-review --since-last    only what changed since the last review
  open-review -w              the working tree (staged, unstaged, untracked)
  open-review -r <revset>     an explicit range
  open-review pr <n|url>      a pull request, passed through
  open-review --file <path>   a document, no VCS needed
  open-review ... -p <path>   filter to a file or directory

  open-review --plan          print the plan of the launch in flight
  open-review --dry-run       resolve and print, no popup
  open-review --exec          resolve, then exec tuicr in place (tmux binding)`;

export async function main(argv: string[], cwd: string): Promise<number> {
  let intent;
  try {
    intent = parseArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      process.stderr.write(`open-review: ${error.message}\n\n${USAGE}\n`);
      return EXIT.error;
    }
    throw error;
  }

  if (intent.action === "help") {
    process.stdout.write(`${USAGE}\n`);
    return EXIT.ok;
  }

  if (intent.action === "plan") {
    const facts = collectFacts(cwd);
    if (facts === null) {
      process.stderr.write("open-review: not a git repository\n");
      return EXIT.error;
    }
    const plan = await awaitPlan(facts.gitDir);
    if (plan === null) {
      process.stderr.write("open-review: no plan yet — run open-review first\n");
      return EXIT.error;
    }
    process.stdout.write(`${plan}\n`);
    return EXIT.ok;
  }

  const facts = collectFacts(cwd);
  // Every launch clears the plan before resolving, so --plan can never inherit
  // a previous run's answer.
  if (facts !== null) clearPlan(facts.gitDir);

  if (facts === null) {
    // pr is the one mode that needs no checkout — `tuicr pr <url>` resolves
    // from anywhere — and the one mode with no local plan to print.
    if (intent.mode.kind !== "pr") {
      process.stderr.write("open-review: not a git repository\n");
      return EXIT.error;
    }
    const target = buildPrTarget(intent);
    process.stdout.write(
      `mode: ${target.description}\ntuicr: ${target.tuicrArgs.join(" ")}\nstat: pass-through, no local stat\n`,
    );
    // Same short-circuit as the with-facts path below: --dry-run resolves and
    // prints, and must never reach the popup. `launch` only special-cases
    // "exec", so without this a dry run outside a repository would open one.
    if (intent.action === "dry-run") return EXIT.ok;
    return await launch(cwd, target, null, intent.action);
  }

  // Hand over the facts already collected above rather than paying for them twice.
  const resolution = resolve(cwd, argv, facts);
  process.stdout.write(`${resolution.plan}\n`);

  if (resolution.target.emptyReason !== null) {
    process.stderr.write(`open-review: nothing to review — ${resolution.target.emptyReason}\n`);
    return EXIT.nothing;
  }

  writePlan(facts.gitDir, resolution.plan);
  if (intent.action === "dry-run") {
    clearPlan(facts.gitDir);
    return EXIT.ok;
  }

  return await launch(facts.root, resolution.target, facts, intent.action);
}

/**
 * The popup and the read-back. `facts` is null only on the repository-less pr
 * path, which has no state to record.
 */
async function launch(
  root: string,
  target: Target,
  facts: RepoFacts | null,
  action: Action,
): Promise<number> {
  if (action === "exec") {
    // The tmux binding's path: the human owns the popup, so there is nothing
    // to wait for and nothing to read back.
    execFileSync("tuicr", target.tuicrArgs, { stdio: "inherit" });
    return EXIT.ok;
  }

  if (!insideTmux()) {
    process.stderr.write(
      `open-review: not inside tmux — run 'tuicr ${target.tuicrArgs.join(" ")}' directly\n`,
    );
    return EXIT.error;
  }

  // tmux-popup attaches an existing session and ignores the command it was
  // given, so a live review would silently stand in for the requested one.
  if (popupAlive()) {
    process.stderr.write(
      "open-review: a review is already open — close it with C-q, or reattach with prefix + R\n",
    );
    return EXIT.busy;
  }

  const before = listSessions();
  openPopup(root, target.tuicrArgs);
  await waitForPopupGone();

  const elected = electSession(before, listSessions());
  if (facts !== null && facts.head !== null) {
    writeLastReviewed(facts.commonDir, facts.branch, facts.head);
  }

  if (elected === null || elected.comment_count === 0) {
    process.stdout.write("open-review: review closed with no comments\n");
    return EXIT.noComments;
  }

  const comments = readComments(elected.path);
  process.stdout.write(`session: ${elected.slug}\n`);
  process.stdout.write(`${renderCommentIndex(comments)}\n\n`);
  process.stdout.write(`comments (json):\n${JSON.stringify(comments, null, 2)}\n`);
  return EXIT.ok;
}

if (process.argv[1]?.endsWith("main.ts")) {
  process.exitCode = await main(process.argv.slice(2), process.cwd());
}

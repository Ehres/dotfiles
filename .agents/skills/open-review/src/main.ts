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
import { execInPlace, listSessions, readComments } from "./tuicr.ts";
import { buildPrTarget, buildTarget } from "./target.ts";
import { EXIT, LIST_LIMIT } from "./constants.ts";
import type { Action, BaseChoice, ChurnRow, LastReviewed, RepoFacts, Target, UntrackedRow } from "./types.ts";

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

  // An explicit -r, pr or --file names its own target; detecting a base for
  // them is wasted work, and reporting one it never used would be a lie the
  // plan tells about a review the agent relays verbatim.
  const detectsBase = intent.mode.kind === "auto" || intent.mode.kind === "since-last" || intent.mode.kind === "working-tree";
  const base = detectsBase && facts.head !== null ? chooseBase(facts) : null;
  let target = buildTarget({
    intent,
    facts,
    base,
    lastReviewed: detectsBase ? readLastReviewedState(cwd, facts) : null,
  });

  const { pathFilter } = intent;
  let shortstatResult: string | null = null;
  let churn: ChurnRow[] = [];
  let untrackedPaths: string[] = [];

  if (target.stat.kind === "diff") {
    const spec = target.stat;
    shortstatResult = shortstat(cwd, spec, pathFilter);
    untrackedPaths = facts.work.untracked.filter((path) => inScope(path, pathFilter));

    if (shortstatResult === null) {
      // The diff itself failed — an unresolvable revset, most often — which is
      // not "no textual changes": that phrasing tells the agent the review was
      // empty when in fact nothing could be compared at all.
      const reason = `could not diff ${spec.args.join(" ")} — check the revset`;
      target = { ...target, stat: { kind: "none", reason }, emptyReason: reason };
    } else if (shortstatResult.trim() === "" && untrackedPaths.length === 0) {
      // A real diff, genuinely empty, with nothing untracked in scope either
      // (a working tree dirty only with untracked files is still a real
      // review — that case never reaches here, since untrackedPaths is
      // nonempty for it). Caught here rather than left to open an empty
      // popup: the session then dies at once and gets reported as "closed
      // with no comments", which reads as the human's own choice.
      const reason = "no changes in scope";
      target = { ...target, stat: { kind: "none", reason }, emptyReason: reason };
    } else {
      churn = numstat(cwd, spec, pathFilter);
    }
  } else if (target.stat.kind === "file") {
    untrackedPaths = [target.stat.path];
  }

  let untracked: UntrackedRow[] = [];
  if (target.stat.kind === "file") {
    untracked = untrackedPaths.map((path) => countLines(cwd, path));
  } else if (target.stat.kind === "diff") {
    // Capped before reading, not just before printing: an untracked build/ of
    // hundreds of files must not turn every launch into hundreds of reads.
    untracked = untrackedPaths.slice(0, LIST_LIMIT).map((path) => countLines(cwd, path));
  }

  const plan = renderPlan({
    target,
    facts,
    base,
    shortstat: target.stat.kind === "diff" ? shortstatResult : null,
    churn: target.stat.kind === "diff" ? churn : [],
    untracked,
    untrackedTotal: untrackedPaths.length,
  });

  return { facts, base, target, plan };
}

/** A path counts toward a path-filtered review the same way `git diff -- <pathFilter>` does. */
export function inScope(path: string, pathFilter: string | null): boolean {
  if (pathFilter === null) return true;
  const normalized = pathFilter.replace(/\/+$/, "");
  return path === normalized || path.startsWith(`${normalized}/`);
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
 * The four functions launch performs a side effect through, plus popupAlive
 * (checked twice: once before opening, once as the fallback when opening
 * itself reports failure). Every field is optional, defaulting to the real
 * implementation, so no existing caller needs to change — only a test that
 * wants to drive an exit-code decision without tmux or tuicr.
 */
export type LaunchDeps = {
  popupAlive?: typeof popupAlive;
  openPopup?: typeof openPopup;
  waitForPopupGone?: typeof waitForPopupGone;
  listSessions?: typeof listSessions;
  readComments?: typeof readComments;
  writeLastReviewed?: typeof writeLastReviewed;
};

/**
 * The popup and the read-back. `facts` is null only on the repository-less pr
 * path, which has no state to record.
 */
export async function launch(
  root: string,
  target: Target,
  facts: RepoFacts | null,
  action: Action,
  deps: LaunchDeps = {},
): Promise<number> {
  const doPopupAlive = deps.popupAlive ?? popupAlive;
  const doOpenPopup = deps.openPopup ?? openPopup;
  const doWait = deps.waitForPopupGone ?? waitForPopupGone;
  const doListSessions = deps.listSessions ?? listSessions;
  const doReadComments = deps.readComments ?? readComments;
  const doWriteLastReviewed = deps.writeLastReviewed ?? writeLastReviewed;

  // Every exit below that does not open a popup must not leave the plan on
  // disk for --plan to find: the agent's next call would print a plan for a
  // review that never happened. Exits that did open a popup leave it alone —
  // --plan has already served its purpose by the time one of those is reached.
  const clearPlanIfLive = (): void => {
    if (facts !== null) clearPlan(facts.gitDir);
  };

  if (action === "exec") {
    // The tmux binding's path: the human owns the popup, so there is nothing
    // to wait for and nothing to read back.
    execInPlace(target.tuicrArgs);
    return EXIT.ok;
  }

  if (!insideTmux()) {
    clearPlanIfLive();
    process.stderr.write(
      `open-review: not inside tmux — run 'tuicr ${target.tuicrArgs.join(" ")}' directly\n`,
    );
    return EXIT.error;
  }

  // tmux-popup attaches an existing session and ignores the command it was
  // given, so a live review would silently stand in for the requested one.
  if (doPopupAlive()) {
    clearPlanIfLive();
    process.stderr.write(
      "open-review: a review is already open — close it with C-q, or reattach with prefix + R\n",
    );
    return EXIT.busy;
  }

  const before = doListSessions();
  const opened = doOpenPopup(root, target.tuicrArgs);
  // display-popup can report failure (Escape dismissing it, for instance)
  // while tuicr keeps running in its own session. Abandoning the review here
  // on that basis alone would tell the agent it never started while a human
  // is still looking at it — so a live session is treated as success.
  if (!opened && !doPopupAlive()) {
    clearPlanIfLive();
    process.stderr.write(
      `open-review: could not open the popup — run 'tuicr ${target.tuicrArgs.join(" ")}' directly\n`,
    );
    return EXIT.error;
  }
  await doWait();

  const after = doListSessions();
  const elected = electSession(before, after);
  if (facts !== null && facts.head !== null) {
    doWriteLastReviewed(facts.commonDir, facts.branch, facts.head);
  }

  if (elected === null) {
    process.stdout.write("open-review: review closed with no comments\n");
    return EXIT.noComments;
  }

  // A local session is keyed on branch + HEAD sha, so re-reviewing at the
  // same HEAD reuses it, and its comment_count already includes whatever the
  // previous review produced. Comparing against the count this session had
  // before this launch is what stops those from being served as this
  // review's own output — including the case where nothing new was written
  // at all but tuicr still touched the session at startup.
  const previousCount = before.find((row) => row.path === elected.path)?.comment_count ?? 0;
  if (elected.comment_count <= previousCount) {
    process.stdout.write(
      elected.comment_count === 0
        ? "open-review: review closed with no comments\n"
        : `open-review: review closed with no new comments (${elected.comment_count} carried over from a previous review)\n`,
    );
    return EXIT.noComments;
  }

  const comments = doReadComments(elected.path);
  if (comments === null) {
    process.stderr.write(
      `open-review: could not read back comments — run 'tuicr review comments --session ${elected.path}' to see them\n`,
    );
    return EXIT.error;
  }
  process.stdout.write(`session: ${elected.slug}\n`);
  // There is no CLI to resolve or delete a tuicr comment, so a session's
  // comments are append-only — the first `previousCount` are exactly the ones
  // that predate this review. The index shows only the new ones; the JSON
  // stays complete, since the agent may still need the older comments for
  // context, and only the index and the summary line must not misrepresent
  // which comments this review produced.
  const newComments = comments.slice(Math.min(previousCount, comments.length));
  if (previousCount > 0) {
    process.stdout.write(
      `${newComments.length} new comment${newComments.length === 1 ? "" : "s"} (${previousCount} carried over from a previous review):\n`,
    );
  }
  process.stdout.write(`${renderCommentIndex(newComments)}\n\n`);
  process.stdout.write(`comments (json):\n${JSON.stringify(comments, null, 2)}\n`);
  return EXIT.ok;
}

if (process.argv[1]?.endsWith("main.ts")) {
  process.exitCode = await main(process.argv.slice(2), process.cwd());
}

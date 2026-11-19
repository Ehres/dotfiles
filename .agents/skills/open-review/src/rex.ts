import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const REVIEW_LABEL = "open-review";

export type RexAnchor = { session: string; block: string };

export function rexAnchor(env: NodeJS.ProcessEnv = process.env): RexAnchor | null {
  const session = env["REX_SESSION"];
  const block = env["REX_BLOCK"];
  return session && block ? { session, block } : null;
}

export function reviewSplitArgs(root: string, anchor: RexAnchor, tuicrArgs: string[]): string[] {
  return [
    "split", "-s", anchor.session, "-b", anchor.block, "--split=right", "--ratio", "60",
    "--label", REVIEW_LABEL, "-c", root, "--wait", "--", "tuicr", ...tuicrArgs,
  ];
}

export async function reviewAlreadyOpen(anchor: RexAnchor): Promise<boolean> {
  const { stdout } = await run("rex", ["block", "ls", "-s", anchor.session, "--json"]);
  const state: unknown = JSON.parse(stdout);
  if (typeof state !== "object" || state === null || !("blocks" in state) || !Array.isArray(state.blocks)) {
    throw new Error("Rex did not return a block list");
  }
  return state.blocks.some((block: unknown) =>
    typeof block === "object" && block !== null && "label" in block && block.label === REVIEW_LABEL
  );
}

/** Rex waits for the terminal child's exit, not merely for the block to be created. */
export async function runReviewPane(root: string, anchor: RexAnchor, tuicrArgs: string[]): Promise<void> {
  await run("rex", reviewSplitArgs(root, anchor, tuicrArgs));
}

import type { Comment, SessionRow } from "./types.ts";

const INDEX_WIDTH = 80;

/**
 * Newest first, by parsed instant rather than by string.
 *
 * tuicr writes microsecond precision with a numeric offset
 * (`2026-08-05T14:02:21.603027+00:00`). Comparing those as strings only happens
 * to work while every row has identical field widths: a variable-width fraction
 * followed by `Z` inverts the order, since `Z` sorts above the digits and
 * `…21.6Z` would then outrank `…21.6003Z`. `localeCompare` is worse again —
 * collations may treat punctuation as variable weight.
 *
 * Date.parse truncates to milliseconds, so the raw string breaks ties below
 * that, and the path breaks the remaining ties so the answer never depends on
 * the order the caller happened to pass.
 */
function newestFirst(left: SessionRow, right: SessionRow): number {
  const byInstant = Date.parse(right.updated_at) - Date.parse(left.updated_at);
  if (byInstant !== 0 && !Number.isNaN(byInstant)) return byInstant;
  if (right.updated_at !== left.updated_at) return right.updated_at < left.updated_at ? -1 : 1;
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
}

/**
 * The session this launch touched, deduced rather than guessed: tuicr writes
 * its session file at startup, so the review that just happened is the one
 * that appeared or whose updated_at moved.
 */
export function electSession(before: SessionRow[], after: SessionRow[]): SessionRow | null {
  const seen = new Map(before.map((row) => [row.path, row.updated_at]));
  const moved = after.filter((row) => seen.get(row.path) !== row.updated_at);
  const sorted = [...moved].sort(newestFirst);
  return sorted[0] ?? null;
}

export function renderCommentIndex(comments: Comment[]): string {
  if (comments.length === 0) return "(no comments)";
  return comments.map((comment) => `${anchor(comment)} — ${excerpt(comment.content)}`).join("\n");
}

function anchor(comment: Comment): string {
  if (comment.path === null) return "(review)";
  const side = comment.side === "old" ? " (old side)" : "";
  if (comment.start_line === null) return comment.path;
  const range =
    comment.end_line !== null && comment.end_line !== comment.start_line
      ? `${comment.start_line}-${comment.end_line}`
      : String(comment.start_line);
  return `${comment.path}:${range}${side}`;
}

function excerpt(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length <= INDEX_WIDTH ? flat : `${flat.slice(0, INDEX_WIDTH)}…`;
}

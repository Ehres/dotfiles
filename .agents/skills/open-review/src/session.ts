import type { Comment, SessionRow } from "./types.ts";

const INDEX_WIDTH = 80;

/**
 * The session this launch touched, deduced rather than guessed: tuicr writes
 * its session file at startup, so the review that just happened is the one
 * that appeared or whose updated_at moved.
 */
export function electSession(before: SessionRow[], after: SessionRow[]): SessionRow | null {
  const seen = new Map(before.map((row) => [row.path, row.updated_at]));
  const moved = after.filter((row) => seen.get(row.path) !== row.updated_at);
  const sorted = [...moved].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
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

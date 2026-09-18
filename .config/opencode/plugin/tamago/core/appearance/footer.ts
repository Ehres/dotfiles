import { isAbsolute, relative, sep } from "node:path";

/** Same rule as OpenCode's own footer: only a path at or under home is shortened. */
export function abbreviateHome(dir: string, home: string): string {
  if (!home) return dir;
  const rel = relative(home, dir);
  if (rel === "") return "~";
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return dir;
  return `~${sep}${rel}`;
}

/** The two spans of the sidebar footer: everything before the last segment, and that segment with the branch. */
export function footerPath(dir: string, home: string, branch?: string): { parent: string; name: string } {
  const parts = abbreviateHome(dir, home).split("/");
  const last = parts.at(-1) ?? "";
  return { parent: parts.slice(0, -1).join("/"), name: branch ? `${last}:${branch}` : last };
}
